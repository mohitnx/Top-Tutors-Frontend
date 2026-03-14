import api from './client';
import { unwrapData } from './unwrap';
import { User } from '../types';

export interface CreateUserData {
  email: string;
  name: string;
  role: 'ADMINISTRATOR' | 'TEACHER' | 'TUTOR' | 'STUDENT';
  schoolId?: string;
  sectionId?: string;  // Required for TEACHER and STUDENT
  subject?: string;    // Required for TEACHER
}

export interface BulkCreateUsersData {
  users: CreateUserData[];
}

export interface BulkCreateUsersResponse {
  created: User[];
  failed: { email: string; reason: string }[];
}

export interface UpdateUserData {
  name?: string;
  isActive?: boolean;
}

export interface UsersListResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export const usersApi = {
  // Get all users (paginated) - ADMIN only
  getUsers: async (page = 1, limit = 20): Promise<UsersListResponse> => {
    const response = await api.get('/admin/users', {
      params: { page, limit },
    });
    return unwrapData<UsersListResponse>(response.data);
  },

  // Get user by ID - ADMIN only
  getUserById: async (id: string): Promise<User> => {
    const response = await api.get(`/admin/users/${id}`);
    return unwrapData<User>(response.data);
  },

  // Create user (sends invitation email) - ADMIN only
  createUser: async (data: CreateUserData): Promise<User> => {
    const response = await api.post('/admin/users', data);
    return unwrapData<User>(response.data);
  },

  // Bulk create users - ADMIN only
  bulkCreateUsers: async (data: BulkCreateUsersData): Promise<BulkCreateUsersResponse> => {
    const response = await api.post('/admin/users/bulk', data);
    return unwrapData<BulkCreateUsersResponse>(response.data);
  },

  // Resend invitation email - ADMIN only
  resendInvitation: async (id: string): Promise<void> => {
    await api.post(`/admin/users/${id}/resend-invitation`);
  },

  // Update user - ADMIN only
  updateUser: async (id: string, data: UpdateUserData): Promise<User> => {
    const response = await api.patch(`/admin/users/${id}`, data);
    return unwrapData<User>(response.data);
  },

  // Delete user - ADMIN only
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },
};

export default usersApi;
