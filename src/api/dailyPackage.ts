import api from './client';
import { unwrapData } from './unwrap';
import { DailyPackageUpload, DailyPackageUploadDetail } from '../types';

export interface UploadResponse {
  uploadId: string;
  status: string;
}

export const dailyPackageApi = {
  // Upload question images - TEACHER or ADMINISTRATOR
  uploadQuestions: async (sectionId: string, subject: string, images: File[]): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('sectionId', sectionId);
    formData.append('subject', subject);
    images.forEach((img) => {
      formData.append('files', img);
    });

    const response = await api.post<UploadResponse>('/daily-package/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min for large uploads
    });
    return unwrapData<UploadResponse>(response.data);
  },

  // List uploads - TEACHER (own) or ADMINISTRATOR (school-wide)
  getMyUploads: async (page = 1, limit = 20): Promise<{ data: DailyPackageUpload[]; total: number; page: number; limit: number }> => {
    const response = await api.get('/daily-package/uploads', {
      params: { page, limit },
    });
    return unwrapData<{ data: DailyPackageUpload[]; total: number; page: number; limit: number }>(response.data);
  },

  // Get upload detail (includes extracted questions, images)
  getUploadDetail: async (id: string): Promise<DailyPackageUploadDetail> => {
    const response = await api.get<DailyPackageUploadDetail>(`/daily-package/uploads/${id}`);
    return unwrapData<DailyPackageUploadDetail>(response.data);
  },
};

export default dailyPackageApi;
