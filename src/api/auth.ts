import api, { API_BASE_URL } from './client';
import { ApiResponse, AuthResponse, User, LoginForm, RegisterForm } from '../types';

export const authApi = {
  // Login user
  login: async (data: LoginForm): Promise<ApiResponse<AuthResponse>> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data;
  },

  // Register student
  registerStudent: async (data: Omit<RegisterForm, 'confirmPassword'>): Promise<ApiResponse<AuthResponse>> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register/student', data);
    return response.data;
  },

  // Get current user profile
  getProfile: async (): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>('/auth/profile');
    return response.data;
  },

  // Logout
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors - we'll clear local storage anyway
    }
  },

  // Get Google OAuth URL
  getGoogleAuthUrl: (): string => {
    return `${API_BASE_URL}/auth/google`;
  },
};

export default authApi;

