import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Role } from '../types';

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || getDashboardPath(user?.role);

  function getDashboardPath(role?: Role) {
    switch (role) {
      case Role.ADMIN:
        return '/admin';
      case Role.TUTOR:
        return '/dashboard/tutor';
      default:
        return '/dashboard/student';
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      
      // Get the role from the stored user after login
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        navigate(getDashboardPath(userData.role), { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      
      // More detailed error handling
      const error = err as { 
        response?: { data?: { message?: string }; status?: number };
        message?: string;
        code?: string;
      };
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        setError('Cannot connect to server. Make sure the backend is running on http://localhost:3000');
      } else if (error.response?.status === 401) {
        setError('Invalid email or password');
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleAuthUrl();
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-600">Sign in to continue to Top Tutors</p>
        </div>

        <div className="bg-white border border-gray-200 rounded p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={isLoading}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={isLoading}
            />

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
              disabled={isLoading}
            >
              Sign in
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="link font-medium">
              Sign up
            </Link>
          </p>
        </div>

        {/* Test Accounts Info */}
        <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
          <p className="font-medium text-gray-700 mb-2">Test Accounts:</p>
          <div className="space-y-1 text-gray-600 text-xs">
            <p><strong>Admin:</strong> admin@toptutor.com / Admin123!</p>
            <p><strong>Tutor:</strong> john.tutor@toptutor.com / Tutor123!</p>
            <p><strong>Student:</strong> jane.student@toptutor.com / Student123!</p>
          </div>
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
            <strong>Note:</strong> Make sure the backend server is running on <code className="bg-amber-100 px-1">http://localhost:3000</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
