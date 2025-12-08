import api from './client';
import { ApiResponse, User, PaginatedResponse } from '../types';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  isActive?: boolean;
}

export const usersApi = {
  // Get all users (paginated)
  getUsers: async (page = 1, limit = 10): Promise<ApiResponse<PaginatedResponse<User>>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<User>>>('/users', {
      params: { page, limit },
    });
    return response.data;
  },

  // Get user by ID
  getUserById: async (id: string): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>(`/users/${id}`);
    return response.data;
  },

  // Create user
  createUser: async (data: CreateUserData): Promise<ApiResponse<User>> => {
    const response = await api.post<ApiResponse<User>>('/users', data);
    return response.data;
  },

  // Update user
  updateUser: async (id: string, data: UpdateUserData): Promise<ApiResponse<User>> => {
    const response = await api.patch<ApiResponse<User>>(`/users/${id}`, data);
    return response.data;
  },

  // Delete user
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

export default usersApi;


