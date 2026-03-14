import api from './client';
import { unwrapData } from './unwrap';
import { ClassSection, CreateSectionData, UpdateSectionData, GroupedSectionsResponse, AvailableStudent, AvailableTeacher } from '../types';

export const sectionsApi = {
  // List sections grouped by grade - ADMIN/ADMINISTRATOR
  // Returns { grades: { "10": [...], "11": [...] }, total: N }
  getSections: async (): Promise<GroupedSectionsResponse> => {
    const response = await api.get('/admin/sections');
    return unwrapData<GroupedSectionsResponse>(response.data);
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

  // Remove teacher from section
  removeTeacher: async (sectionId: string, teacherId: string): Promise<void> => {
    await api.delete(`/admin/sections/${sectionId}/teachers/${teacherId}`);
  },

  // Add students to section (bulk) - 409 if student already in another section
  addStudents: async (sectionId: string, studentIds: string[]): Promise<{ added: number }> => {
    const response = await api.post(`/admin/sections/${sectionId}/students`, { studentIds });
    return unwrapData<{ added: number }>(response.data);
  },

  // Remove student from section
  removeStudent: async (sectionId: string, studentId: string): Promise<void> => {
    await api.delete(`/admin/sections/${sectionId}/students/${studentId}`);
  },

  // Get students not in any section
  getAvailableStudents: async (): Promise<AvailableStudent[]> => {
    const response = await api.get('/admin/sections/available-students');
    return unwrapData<AvailableStudent[]>(response.data);
  },

  // Get teachers with their current section assignments
  getAvailableTeachers: async (): Promise<AvailableTeacher[]> => {
    const response = await api.get('/admin/sections/available-teachers');
    return unwrapData<AvailableTeacher[]>(response.data);
  },
};

export default sectionsApi;
