import api from './client';
import { unwrapData } from './unwrap';
import {
  ProjectResponse,
  ProjectResourceResponse,
  ProjectChatSessionResponse,
  ProjectMessageResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  SendProjectMessageRequest,
  GenerateQuizRequest,
  SessionResourceResponse,
} from '../types';

// ============================================
// Projects API
// ============================================

export interface GetProjectsParams {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  search?: string;
}

export interface GetProjectsResponse {
  projects: ProjectResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetProjectDetailResponse {
  project: ProjectResponse;
  resources: ProjectResourceResponse[];
}

export interface GetChatSessionResponse {
  session: ProjectChatSessionResponse;
  messages: ProjectMessageResponse[];
}

export interface SendMessageResponse {
  messageId: string;
  sessionId: string;
  projectId: string;
  streaming: boolean;
  message?: string;
  attachments?: number;
}

export interface GenerateQuizResponse {
  messageId: string;
  sessionId: string;
  projectId: string;
  streaming: boolean;
  message?: string;
}

export interface StreamStateResponse {
  found: boolean;
  content?: string;
  complete?: boolean;
}

export const projectsApi = {
  // =====================
  // Projects CRUD
  // =====================

  getProjects: async (params?: GetProjectsParams): Promise<GetProjectsResponse> => {
    const response = await api.get('/projects', { params });
    return unwrapData<GetProjectsResponse>(response.data);
  },

  getProject: async (projectId: string): Promise<GetProjectDetailResponse> => {
    const response = await api.get(`/projects/${projectId}`);
    return unwrapData<GetProjectDetailResponse>(response.data);
  },

  createProject: async (data: CreateProjectRequest): Promise<ProjectResponse> => {
    const response = await api.post('/projects', data);
    return unwrapData<ProjectResponse>(response.data);
  },

  updateProject: async (projectId: string, data: UpdateProjectRequest): Promise<ProjectResponse> => {
    const response = await api.put(`/projects/${projectId}`, data);
    return unwrapData<ProjectResponse>(response.data);
  },

  deleteProject: async (projectId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/projects/${projectId}`);
    return unwrapData<{ success: boolean }>(response.data);
  },

  // =====================
  // Resources
  // =====================

  getResources: async (projectId: string): Promise<ProjectResourceResponse[]> => {
    const response = await api.get(`/projects/${projectId}/resources`);
    return unwrapData<ProjectResourceResponse[]>(response.data);
  },

  uploadResource: async (
    projectId: string,
    file: File,
    title: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<ProjectResourceResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const response = await api.post(`/projects/${projectId}/resources`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(progress);
        }
      },
    });
    return unwrapData<ProjectResourceResponse>(response.data);
  },

  deleteResource: async (
    projectId: string,
    resourceId: string
  ): Promise<{ success: boolean }> => {
    const response = await api.delete(`/projects/${projectId}/resources/${resourceId}`);
    return unwrapData<{ success: boolean }>(response.data);
  },

  getResourcePreview: async (
    projectId: string,
    resourceId: string
  ): Promise<{ url: string; mimeType: string; title: string }> => {
    const response = await api.get(`/projects/${projectId}/resources/${resourceId}/preview`);
    return unwrapData<{ url: string; mimeType: string; title: string }>(response.data);
  },

  // =====================
  // Chat Sessions
  // =====================

  getChatSessions: async (projectId: string): Promise<ProjectChatSessionResponse[]> => {
    const response = await api.get(`/projects/${projectId}/chat/sessions`);
    return unwrapData<ProjectChatSessionResponse[]>(response.data);
  },

  getChatSession: async (
    projectId: string,
    sessionId: string
  ): Promise<GetChatSessionResponse> => {
    const response = await api.get(`/projects/${projectId}/chat/sessions/${sessionId}`);
    return unwrapData<GetChatSessionResponse>(response.data);
  },

  createChatSession: async (
    projectId: string,
    title?: string
  ): Promise<ProjectChatSessionResponse> => {
    const response = await api.post(`/projects/${projectId}/chat/sessions`, { title });
    return unwrapData<ProjectChatSessionResponse>(response.data);
  },

  deleteChatSession: async (
    projectId: string,
    sessionId: string
  ): Promise<{ success: boolean }> => {
    const response = await api.delete(`/projects/${projectId}/chat/sessions/${sessionId}`);
    return unwrapData<{ success: boolean }>(response.data);
  },

  // =====================
  // Messages
  // =====================

  sendMessage: async (
    projectId: string,
    data: SendProjectMessageRequest
  ): Promise<SendMessageResponse> => {
    const response = await api.post(`/projects/${projectId}/chat/messages`, data);
    return unwrapData<SendMessageResponse>(response.data);
  },

  sendMessageWithAttachments: async (
    projectId: string,
    files: File[],
    content?: string,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void,
    options?: { deepThink?: boolean; deepResearch?: boolean; councilMode?: boolean }
  ): Promise<SendMessageResponse> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (content) formData.append('content', content);
    if (sessionId) formData.append('sessionId', sessionId);
    if (options?.deepThink) formData.append('deepThink', 'true');
    if (options?.deepResearch) formData.append('deepResearch', 'true');
    if (options?.councilMode) formData.append('councilMode', 'true');

    const response = await api.post(
      `/projects/${projectId}/chat/messages/with-attachments`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(progress);
          }
        },
      }
    );
    return unwrapData<SendMessageResponse>(response.data);
  },

  addFeedback: async (
    projectId: string,
    messageId: string,
    feedback: 'GOOD' | 'BAD'
  ): Promise<ProjectMessageResponse> => {
    const response = await api.post(
      `/projects/${projectId}/chat/messages/${messageId}/feedback`,
      { feedback }
    );
    return unwrapData<ProjectMessageResponse>(response.data);
  },

  getStreamState: async (
    projectId: string,
    streamId: string
  ): Promise<StreamStateResponse> => {
    const response = await api.get(`/projects/${projectId}/chat/streams/${streamId}`);
    return unwrapData<StreamStateResponse>(response.data);
  },

  // =====================
  // Quiz
  // =====================

  generateQuiz: async (
    projectId: string,
    data: GenerateQuizRequest
  ): Promise<GenerateQuizResponse> => {
    const response = await api.post(`/projects/${projectId}/quiz/generate`, data);
    return unwrapData<GenerateQuizResponse>(response.data);
  },

  generateQuizPdf: async (
    projectId: string,
    data: GenerateQuizRequest
  ): Promise<Blob> => {
    const token = localStorage.getItem('accessToken');
    const baseURL = api.defaults.baseURL || '';
    const res = await fetch(`${baseURL}/projects/${projectId}/quiz/generate/pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Failed to generate PDF');
      throw new Error(errorText);
    }
    return res.blob();
  },

  // =====================
  // Session Resources
  // =====================

  getSessionResources: async (
    projectId: string,
    sessionId: string
  ): Promise<SessionResourceResponse[]> => {
    const response = await api.get(
      `/projects/${projectId}/chat/sessions/${sessionId}/resources`
    );
    return unwrapData<SessionResourceResponse[]>(response.data);
  },

  uploadSessionResource: async (
    projectId: string,
    sessionId: string,
    file: File,
    title: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<SessionResourceResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const response = await api.post(
      `/projects/${projectId}/chat/sessions/${sessionId}/resources`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(progress);
          }
        },
      }
    );
    return unwrapData<SessionResourceResponse>(response.data);
  },

  deleteSessionResource: async (
    projectId: string,
    _sessionId: string,
    resourceId: string
  ): Promise<{ success: boolean }> => {
    // Same delete endpoint for both project-level and session-level resources
    const response = await api.delete(
      `/projects/${projectId}/resources/${resourceId}`
    );
    return unwrapData<{ success: boolean }>(response.data);
  },

  getSessionResourcePreview: async (
    projectId: string,
    _sessionId: string,
    resourceId: string
  ): Promise<{ url: string; mimeType: string; title: string }> => {
    // Same preview endpoint for both project-level and session-level resources
    const response = await api.get(
      `/projects/${projectId}/resources/${resourceId}/preview`
    );
    return unwrapData<{ url: string; mimeType: string; title: string }>(response.data);
  },
};

export default projectsApi;
