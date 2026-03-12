import api from './client';
import { unwrapData } from './unwrap';
import { Teacher, TeacherSection } from '../types';

export const teachersApi = {
  // List teachers - ADMIN/ADMINISTRATOR
  // ADMINISTRATOR: auto-filtered to their school
  // ADMIN: returns all teachers
  getTeachers: async (): Promise<Teacher[]> => {
    const response = await api.get('/admin/teachers');
    return unwrapData<Teacher[]>(response.data);
  },

  // Get teacher by ID
  getTeacher: async (id: string): Promise<Teacher> => {
    const response = await api.get<Teacher>(`/admin/teachers/${id}`);
    return unwrapData<Teacher>(response.data);
  },

  // Delete teacher - ADMIN/ADMINISTRATOR
  deleteTeacher: async (id: string): Promise<void> => {
    await api.delete(`/admin/teachers/${id}`);
  },

  // Get current teacher's profile - TEACHER only
  getMyProfile: async (): Promise<Teacher> => {
    const response = await api.get<Teacher>('/teachers/me');
    return unwrapData<Teacher>(response.data);
  },

  // Get current teacher's assigned sections - TEACHER only
  getMySections: async (): Promise<TeacherSection[]> => {
    const response = await api.get<TeacherSection[]>('/teachers/me/sections');
    return unwrapData<TeacherSection[]>(response.data);
  },
};

export default teachersApi;
