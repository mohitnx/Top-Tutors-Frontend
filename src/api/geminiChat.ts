import api from './client';
import {
  ApiResponse,
  AIChatSession,
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
}

export interface GetSessionResponse {
  session: AIChatSession;
  messages: AIMessage[];
}

export interface UpdateSessionData {
  title?: string;
  isPinned?: boolean;
  isArchived?: boolean;
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
  message: string;
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

  // Get all sessions (for sidebar)
  getSessions: async (params?: GetSessionsParams): Promise<ApiResponse<GetSessionsResponse>> => {
    const response = await api.get<ApiResponse<GetSessionsResponse>>(
      '/gemini-chat/sessions',
      { params }
    );
    return response.data;
  },

  // Create new session
  createSession: async (data?: CreateSessionData): Promise<ApiResponse<{ session: AIChatSession }>> => {
    const response = await api.post<ApiResponse<{ session: AIChatSession }>>(
      '/gemini-chat/sessions',
      data || {}
    );
    return response.data;
  },

  // Get single session with messages
  getSession: async (sessionId: string): Promise<ApiResponse<GetSessionResponse>> => {
    const response = await api.get<ApiResponse<GetSessionResponse>>(
      `/gemini-chat/sessions/${sessionId}`
    );
    return response.data;
  },

  // Update session (rename, pin, archive)
  updateSession: async (
    sessionId: string,
    data: UpdateSessionData
  ): Promise<ApiResponse<{ session: AIChatSession }>> => {
    const response = await api.put<ApiResponse<{ session: AIChatSession }>>(
      `/gemini-chat/sessions/${sessionId}`,
      data
    );
    return response.data;
  },

  // Delete session
  deleteSession: async (sessionId: string): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await api.delete<ApiResponse<{ success: boolean }>>(
      `/gemini-chat/sessions/${sessionId}`
    );
    return response.data;
  },

  // =====================
  // Messages
  // =====================

  // Send text message (streaming by default)
  sendMessage: async (data: SendMessageData): Promise<ApiResponse<SendMessageResponse>> => {
    const response = await api.post<ApiResponse<SendMessageResponse>>(
      '/gemini-chat/messages',
      { ...data, stream: data.stream !== false }
    );
    return response.data;
  },

  // Send text message (non-streaming)
  sendMessageSync: async (
    data: Omit<SendMessageData, 'stream'>
  ): Promise<ApiResponse<SendMessageNonStreamingResponse>> => {
    const response = await api.post<ApiResponse<SendMessageNonStreamingResponse>>(
      '/gemini-chat/messages',
      { ...data, stream: false }
    );
    return response.data;
  },

  // Send message with attachments (images/PDFs)
  sendMessageWithAttachments: async (
    files: File[],
    content?: string,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<ApiResponse<SendMessageResponse>> => {
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

    const response = await api.post<ApiResponse<SendMessageResponse>>(
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
    return response.data;
  },

  // Send audio message
  sendAudioMessage: async (
    audio: File,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<ApiResponse<SendMessageResponse>> => {
    const formData = new FormData();
    formData.append('audio', audio);
    
    if (sessionId) {
      formData.append('sessionId', sessionId);
    }

    const response = await api.post<ApiResponse<SendMessageResponse>>(
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
    return response.data;
  },

  // Retry failed message
  retryMessage: async (messageId: string): Promise<ApiResponse<SendMessageResponse>> => {
    const response = await api.post<ApiResponse<SendMessageResponse>>(
      `/gemini-chat/messages/${messageId}/retry`
    );
    return response.data;
  },

  // Add feedback (like/dislike)
  addFeedback: async (
    messageId: string,
    feedback: 'GOOD' | 'BAD'
  ): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await api.post<ApiResponse<{ success: boolean }>>(
      `/gemini-chat/messages/${messageId}/feedback`,
      { feedback }
    );
    return response.data;
  },

  // Get stream state (for page reload recovery)
  getStreamState: async (streamId: string): Promise<ApiResponse<StreamStateResponse>> => {
    const response = await api.get<ApiResponse<StreamStateResponse>>(
      `/gemini-chat/streams/${streamId}`
    );
    return response.data;
  },

  // =====================
  // Tutor Request
  // =====================

  // Request a human tutor
  requestTutor: async (data: RequestTutorData): Promise<ApiResponse<TutorRequestResponse>> => {
    const response = await api.post<ApiResponse<TutorRequestResponse>>(
      '/gemini-chat/tutor/request',
      data
    );
    return response.data;
  },

  // Get tutor request status
  getTutorStatus: async (sessionId: string): Promise<ApiResponse<TutorStatusResponse>> => {
    const response = await api.get<ApiResponse<TutorStatusResponse>>(
      `/gemini-chat/tutor/status/${sessionId}`
    );
    return response.data;
  },

  // Cancel tutor request
  cancelTutorRequest: async (sessionId: string): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await api.delete<ApiResponse<{ success: boolean }>>(
      `/gemini-chat/tutor/request/${sessionId}`
    );
    return response.data;
  },
};

export default geminiChatApi;

