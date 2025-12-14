import api from './client';
import { ApiResponse, StudentProfile, TutorProfile, User } from '../types';

// Student Profile API
export const studentProfileApi = {
  // Get my student profile
  getMyProfile: () => 
    api.get<ApiResponse<StudentProfile>>('/profiles/student/me'),

  // Update my student profile
  updateMyProfile: (data: Partial<StudentProfile>) =>
    api.put<ApiResponse<StudentProfile>>('/profiles/student/me', data),

  // Get student profile by ID
  getProfileById: (id: string) =>
    api.get<ApiResponse<StudentProfile>>(`/profiles/student/${id}`),
};

// Tutor Profile API
export const tutorProfileApi = {
  // Get my tutor profile
  getMyProfile: () =>
    api.get<ApiResponse<TutorProfile>>('/profiles/tutor/me'),

  // Update my tutor profile
  updateMyProfile: (data: Partial<TutorProfile>) =>
    api.put<ApiResponse<TutorProfile>>('/profiles/tutor/me', data),

  // Get tutor profile by ID (public)
  getProfileById: (id: string) =>
    api.get<ApiResponse<TutorProfile>>(`/profiles/tutor/${id}`),

  // List verified tutors
  listTutors: (params?: {
    subjects?: string;
    minRating?: number;
    maxHourlyRate?: number;
    page?: number;
    limit?: number;
  }) =>
    api.get<ApiResponse<{ data: TutorProfile[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>('/profiles/tutors', { params }),

  // Add certificate
  addCertificate: (data: {
    name: string;
    issuedBy: string;
    issuedDate?: string;
    expiryDate?: string;
    url?: string;
  }) =>
    api.post<ApiResponse<TutorProfile>>('/profiles/tutor/certificates', data),

  // Upload certificate document
  uploadCertificate: (file: File, data: { name: string; issuedBy: string; issuedDate?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);
    formData.append('issuedBy', data.issuedBy);
    if (data.issuedDate) formData.append('issuedDate', data.issuedDate);
    
    return api.post<ApiResponse<TutorProfile>>('/profiles/tutor/certificates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Remove certificate
  removeCertificate: (certificateId: string) =>
    api.delete<ApiResponse<TutorProfile>>(`/profiles/tutor/certificates/${certificateId}`),
};

// Common Profile API
export const profileApi = {
  // Upload avatar
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post<ApiResponse<User>>('/profiles/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Update display name
  updateName: (name: string) =>
    api.put<ApiResponse<User>>('/profiles/name', { name }),
};

export default {
  student: studentProfileApi,
  tutor: tutorProfileApi,
  common: profileApi,
};

