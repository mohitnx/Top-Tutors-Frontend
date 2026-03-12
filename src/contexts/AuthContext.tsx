import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Role } from '../types';
import { authApi } from '../api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { connectGeminiSocket, disconnectGeminiSocket } from '../services/geminiSocket';
import { disconnectProjectSocket } from '../services/projectSocket';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  acceptInvitation: (token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: Role | Role[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const storeAuthAndConnect = (accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    connectSocket(accessToken);
    connectGeminiSocket(accessToken);
  };

  // Initialize auth state from localStorage
  useEffect(() => {
    let isMounted = true;

    const clearAuth = () => {
      disconnectSocket();
      disconnectGeminiSocket();
      disconnectProjectSocket();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      if (isMounted) setUser(null);
    };

    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    // If we have cached auth, render immediately for a better refresh UX,
    // then verify the token in the background.
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        if (isMounted) {
          setUser(parsedUser);
          setIsLoading(false);
        }

        connectSocket(token);
        connectGeminiSocket(token);

        authApi.getProfile()
          .then((userData) => {
            if (!isMounted) return;
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          })
          .catch(() => {
            if (!isMounted) return;
            clearAuth();
          });
      } catch {
        // Corrupt cached user; fall back to verifying token only.
        localStorage.removeItem('user');
      }
    }

    // If we only have a token (no cached user), we do need to block once to fetch the user.
    if (token && !localStorage.getItem('user')) {
      connectSocket(token);
      connectGeminiSocket(token);

      authApi.getProfile()
        .then((userData) => {
          if (!isMounted) return;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        })
        .catch(() => {
          if (!isMounted) return;
          clearAuth();
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else if (!token) {
      if (isMounted) setIsLoading(false);
    }

    return () => {
      isMounted = false;
      disconnectSocket();
      disconnectGeminiSocket();
      disconnectProjectSocket();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { accessToken, refreshToken, user: userData } = await authApi.login({ email, password });
      storeAuthAndConnect(accessToken, refreshToken, userData);
      toast.success('Welcome back!');
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string | string[] } };
        message?: string;
      };

      const status = err.response?.status;
      const rawMessage = err.response?.data?.message;
      const backendMessage = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;

      let message = backendMessage;

      if (!message) {
        if (status === 401) {
          message = 'Invalid email or password';
        } else if (status === 403) {
          message = 'Account inactive. Please check your email for an invitation link.';
        } else if (!status) {
          message = 'Unable to reach server. Please check your connection and try again.';
        } else {
          message = 'Something went wrong while logging in. Please try again.';
        }
      }

      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acceptInvitation = useCallback(async (token: string, password: string) => {
    setIsLoading(true);
    try {
      const { accessToken, refreshToken, user: userData } = await authApi.acceptInvitation({ token, password });
      storeAuthAndConnect(accessToken, refreshToken, userData);
      toast.success('Account activated successfully!');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string | string[] } } };
      const message = err.response?.data?.message;
      const errorMessage = Array.isArray(message) ? message[0] : message || 'Failed to accept invitation';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }

    disconnectSocket();
    disconnectGeminiSocket();
    disconnectProjectSocket();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  const hasRole = useCallback((roles: Role | Role[]) => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getProfile();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        acceptInvitation,
        logout,
        hasRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
