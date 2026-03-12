import api from './client';
import { unwrapData } from './unwrap';
import {
  AIChatSession,
  AIChatMode,
  AIMessage,
  Subject,
  TutorRequestResponse,
  TutorStatusResponse,
  AIUrgency,
} from '../types';

// ============================================
// Gemini Chat API
// ============================================

export interface GetSessionsParams {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  subject?: Subject;
  search?: string;
}

export interface GetSessionsResponse {
  sessions: AIChatSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSessionData {
  title?: string;
  subject?: Subject;
  mode?: AIChatMode;
}

export interface GetSessionResponse {
  session: AIChatSession;
  messages: AIMessage[];
}

export interface UpdateSessionData {
  title?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  mode?: AIChatMode;
}

export interface SendMessageData {
  content: string;
  sessionId?: string;
  stream?: boolean;
}

export interface SendMessageResponse {
  messageId: string;
  sessionId: string;
  streaming: boolean;
  message?: string;
}

export interface SendMessageNonStreamingResponse {
  userMessage: AIMessage;
  aiMessage: AIMessage;
  session: AIChatSession;
}

export interface StreamStateResponse {
  found: boolean;
  content?: string;
  complete?: boolean;
}

export interface RequestTutorData {
  sessionId: string;
  subject?: Subject;
  urgency?: AIUrgency;
}

export const geminiChatApi = {
  // =====================
  // Sessions
  // =====================

  getSessions: async (params?: GetSessionsParams): Promise<GetSessionsResponse> => {
    const response = await api.get<GetSessionsResponse>(
      '/gemini-chat/sessions',
      { params }
    );
    return unwrapData<GetSessionsResponse>(response.data);
  },

  createSession: async (data?: CreateSessionData): Promise<AIChatSession> => {
    const response = await api.post<AIChatSession>(
      '/gemini-chat/sessions',
      data || {}
    );
    return unwrapData<AIChatSession>(response.data);
  },

  getSession: async (sessionId: string): Promise<GetSessionResponse> => {
    const response = await api.get<GetSessionResponse>(
      `/gemini-chat/sessions/${sessionId}`
    );
    return unwrapData<GetSessionResponse>(response.data);
  },

  updateSession: async (
    sessionId: string,
    data: UpdateSessionData
  ): Promise<AIChatSession> => {
    const response = await api.put<AIChatSession>(
      `/gemini-chat/sessions/${sessionId}`,
      data
    );
    return unwrapData<AIChatSession>(response.data);
  },

  deleteSession: async (sessionId: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(
      `/gemini-chat/sessions/${sessionId}`
    );
    return unwrapData<{ success: boolean }>(response.data);
  },

  // =====================
  // Messages
  // =====================

  sendMessage: async (data: SendMessageData): Promise<SendMessageResponse> => {
    const response = await api.post<SendMessageResponse>(
      '/gemini-chat/messages',
      { ...data, stream: data.stream !== false }
    );
    return unwrapData<SendMessageResponse>(response.data);
  },

  sendMessageSync: async (
    data: Omit<SendMessageData, 'stream'>
  ): Promise<SendMessageNonStreamingResponse> => {
    const response = await api.post<SendMessageNonStreamingResponse>(
      '/gemini-chat/messages',
      { ...data, stream: false }
    );
    return unwrapData<SendMessageNonStreamingResponse>(response.data);
  },

  sendMessageWithAttachments: async (
    files: File[],
    content?: string,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<SendMessageResponse> => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    if (content) {
      formData.append('content', content);
    }

    if (sessionId) {
      formData.append('sessionId', sessionId);
    }

    const response = await api.post<SendMessageResponse>(
      '/gemini-chat/messages/with-attachments',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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

  sendAudioMessage: async (
    audio: File,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<SendMessageResponse> => {
    const formData = new FormData();
    formData.append('audio', audio);

    if (sessionId) {
      formData.append('sessionId', sessionId);
    }

    const response = await api.post<SendMessageResponse>(
      '/gemini-chat/messages/audio',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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

  retryMessage: async (messageId: string): Promise<SendMessageResponse> => {
    const response = await api.post<SendMessageResponse>(
      `/gemini-chat/messages/${messageId}/retry`
    );
    return unwrapData<SendMessageResponse>(response.data);
  },

  addFeedback: async (
    messageId: string,
    feedback: 'GOOD' | 'BAD'
  ): Promise<AIMessage> => {
    const response = await api.post<AIMessage>(
      `/gemini-chat/messages/${messageId}/feedback`,
      { feedback }
    );
    return unwrapData<AIMessage>(response.data);
  },

  getStreamState: async (streamId: string): Promise<StreamStateResponse> => {
    const response = await api.get<StreamStateResponse>(
      `/gemini-chat/streams/${streamId}`
    );
    return unwrapData<StreamStateResponse>(response.data);
  },

  // =====================
  // Tutor Request
  // =====================

  requestTutor: async (data: RequestTutorData): Promise<TutorRequestResponse> => {
    const response = await api.post<TutorRequestResponse>(
      '/gemini-chat/tutor/request',
      data
    );
    return unwrapData<TutorRequestResponse>(response.data);
  },

  getTutorStatus: async (sessionId: string): Promise<TutorStatusResponse> => {
    const response = await api.get<TutorStatusResponse>(
      `/gemini-chat/tutor/status/${sessionId}`
    );
    return unwrapData<TutorStatusResponse>(response.data);
  },

  cancelTutorRequest: async (sessionId: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(
      `/gemini-chat/tutor/request/${sessionId}`
    );
    return unwrapData<{ success: boolean }>(response.data);
  },
};

export default geminiChatApi;
