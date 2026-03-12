import api from './client';
import { unwrapData } from './unwrap';

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  createdAt: string;
  administrator?: { id: string; name: string; email: string } | null;
  _count?: { students: number };
}

export interface CreateSchoolData {
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateSchoolData {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface SchoolStudent {
  id: string;        // student profile ID (use for section assignment)
  userId: string;
  name: string | null;
  email: string;
  isActive: boolean;
  grade?: string | null;
  profileCompleted?: boolean;
  // Legacy nested field (backend may still return this)
  schoolId?: string;
  users?: { name: string | null; email: string };
}

export const schoolsApi = {
  // Create school - ADMIN only
  createSchool: async (data: CreateSchoolData): Promise<School> => {
    const response = await api.post('/admin/schools', data);
    return unwrapData<School>(response.data);
  },

  // List all schools - ADMIN only
  getSchools: async (): Promise<School[]> => {
    const response = await api.get('/admin/schools');
    return unwrapData<School[]>(response.data);
  },

  // Get school by ID - ADMIN or ADMINISTRATOR
  getSchool: async (id: string): Promise<School> => {
    const response = await api.get(`/admin/schools/${id}`);
    return unwrapData<School>(response.data);
  },

  // Update school - ADMIN only
  updateSchool: async (id: string, data: UpdateSchoolData): Promise<School> => {
    const response = await api.patch(`/admin/schools/${id}`, data);
    return unwrapData<School>(response.data);
  },

  // List students in a school - ADMIN or ADMINISTRATOR
  getSchoolStudents: async (schoolId: string): Promise<SchoolStudent[]> => {
    const response = await api.get(`/admin/schools/${schoolId}/students`);
    return unwrapData<SchoolStudent[]>(response.data);
  },
};

export default schoolsApi;
