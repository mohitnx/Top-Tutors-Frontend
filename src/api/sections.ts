import api from './client';
import { unwrapData } from './unwrap';
import { ClassSection, CreateSectionData, UpdateSectionData } from '../types';

export const sectionsApi = {
  // List sections - ADMIN/ADMINISTRATOR
  // ADMINISTRATOR: auto-filtered to their school
  // ADMIN: returns all sections
  getSections: async (): Promise<ClassSection[]> => {
    const response = await api.get('/admin/sections');
    return unwrapData<ClassSection[]>(response.data);
  },

  // Get section by ID with teachers and students
  getSection: async (id: string): Promise<ClassSection> => {
    const response = await api.get<ClassSection>(`/admin/sections/${id}`);
    return unwrapData<ClassSection>(response.data);
  },

  // Create section - ADMIN/ADMINISTRATOR
  createSection: async (data: CreateSectionData): Promise<ClassSection> => {
    const response = await api.post<ClassSection>('/admin/sections', data);
    return unwrapData<ClassSection>(response.data);
  },

  // Update section - ADMIN/ADMINISTRATOR
  updateSection: async (id: string, data: UpdateSectionData): Promise<ClassSection> => {
    const response = await api.patch<ClassSection>(`/admin/sections/${id}`, data);
    return unwrapData<ClassSection>(response.data);
  },

  // Delete section - ADMIN/ADMINISTRATOR
  deleteSection: async (id: string): Promise<void> => {
    await api.delete(`/admin/sections/${id}`);
  },

  // Assign teacher to section with subject
  assignTeacher: async (sectionId: string, teacherId: string, subject: string): Promise<void> => {
    await api.post(`/admin/sections/${sectionId}/teachers`, { teacherId, subject });
  },

  // Add students to section (bulk)
  addStudents: async (sectionId: string, studentIds: string[]): Promise<{ added: number }> => {
    const response = await api.post(`/admin/sections/${sectionId}/students`, { studentIds });
    return unwrapData<{ added: number }>(response.data);
  },

  // Remove student from section
  removeStudent: async (sectionId: string, studentId: string): Promise<void> => {
    await api.delete(`/admin/sections/${sectionId}/students/${studentId}`);
  },
};

export default sectionsApi;
