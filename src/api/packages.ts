import api from './client';
import { unwrapData } from './unwrap';
import { StudentDailyPackage } from '../types';

export const packagesApi = {
  // Get daily packages - STUDENT only
  getDailyPackages: async (date?: string): Promise<StudentDailyPackage[]> => {
    const response = await api.get<StudentDailyPackage[]>('/packages/daily', {
      params: date ? { date } : undefined,
    });
    return unwrapData<StudentDailyPackage[]>(response.data);
  },

  // Get weekly packages - STUDENT only (returns flat array)
  getWeeklyPackages: async (weekStart?: string): Promise<{ weekStart: string; weekEnd: string; packages: StudentDailyPackage[] }> => {
    const response = await api.get('/packages/weekly', {
      params: weekStart ? { weekStart } : undefined,
    });
    return unwrapData<{ weekStart: string; weekEnd: string; packages: StudentDailyPackage[] }>(response.data);
  },

  // Get signed download URL for a package's PDF
  getPackageDownload: async (id: string): Promise<{ url: string }> => {
    const response = await api.get<{ url: string }>(`/packages/${id}/download`);
    return unwrapData<{ url: string }>(response.data);
  },
};

export default packagesApi;
