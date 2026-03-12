import api from './client';
import { unwrapData } from './unwrap';
import { AuthResponse, User, LoginForm, AcceptInvitationForm, InvitationInfo } from '../types';

// Auth endpoints return data as { user, tokens: { accessToken, refreshToken } }
function unwrapAuth(raw: unknown): AuthResponse {
  const unwrapped = unwrapData<Record<string, unknown>>(raw);

  // Nested tokens: { user, tokens: { accessToken, refreshToken } }
  if (unwrapped.tokens && typeof unwrapped.tokens === 'object') {
    const tokens = unwrapped.tokens as { accessToken: string; refreshToken: string };
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: unwrapped.user as User,
    };
  }

  // Flat: { accessToken, refreshToken, user }
  return unwrapped as unknown as AuthResponse;
}

export const authApi = {
  // Login user
  login: async (data: LoginForm): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return unwrapAuth(response.data);
  },

  // Verify invitation token
  verifyInvitation: async (token: string): Promise<InvitationInfo> => {
    const response = await api.get(`/auth/verify-invitation/${token}`);
    return unwrapData<InvitationInfo>(response.data);
  },

  // Accept invitation and set password
  acceptInvitation: async (data: AcceptInvitationForm): Promise<AuthResponse> => {
    const response = await api.post('/auth/accept-invitation', data);
    return unwrapAuth(response.data);
  },

  // Get current user profile
  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/profile');
    return unwrapData<User>(response.data);
  },

  // Logout
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors - we'll clear local storage anyway
    }
  },
};

export default authApi;
