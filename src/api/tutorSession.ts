import api from './client';
import {
  ApiResponse,
  PendingHelpRequest,
  AcceptSessionResponse,
  ChatHistoryResponse,
  ConsentStatusResponse,
  DailyRoom,
  AIUrgency,
} from '../types';

// ============================================
// Tutor Session API
// ============================================

// Request Tutor Help Data
export interface RequestTutorHelpData {
  aiSessionId: string;
  urgency?: AIUrgency;
}

// Request Tutor Help Response
export interface RequestTutorHelpResponse {
  success: boolean;
  tutorSessionId: string;
  summary: string;
  topic: string;
  subject: string;
}

// Update Consent Response
export interface UpdateConsentResponse {
  success: boolean;
  liveSharingEnabled: boolean;
}

// Start/End Session Response
export interface SessionActionResponse {
  success: boolean;
  status: string;
  duration?: number;
}

export const tutorSessionApi = {
  // =====================
  // Student Endpoints
  // =====================

  // Request tutor help (analyzes entire AI conversation)
  requestTutorHelp: async (
    data: RequestTutorHelpData
  ): Promise<ApiResponse<RequestTutorHelpResponse>> => {
    const response = await api.post<ApiResponse<RequestTutorHelpResponse>>(
      '/tutor-session/request',
      data
    );
    return response.data;
  },

  // Update live sharing consent
  updateConsent: async (
    sessionId: string,
    enabled: boolean
  ): Promise<ApiResponse<UpdateConsentResponse>> => {
    const response = await api.put<ApiResponse<UpdateConsentResponse>>(
      `/tutor-session/consent/${sessionId}`,
      { enabled }
    );
    return response.data;
  },

  // Get consent status
  getConsentStatus: async (
    sessionId: string
  ): Promise<ApiResponse<ConsentStatusResponse>> => {
    const response = await api.get<ApiResponse<ConsentStatusResponse>>(
      `/tutor-session/consent/${sessionId}`
    );
    return response.data;
  },

  // Get student room token (for joining video call)
  getStudentRoomToken: async (
    tutorSessionId: string
  ): Promise<ApiResponse<DailyRoom>> => {
    const response = await api.get<ApiResponse<DailyRoom>>(
      `/tutor-session/student-room-token/${tutorSessionId}`
    );
    return response.data;
  },

  // Get tutor room token (for joining video call as host)
  getTutorRoomToken: async (
    tutorSessionId: string
  ): Promise<ApiResponse<DailyRoom>> => {
    const response = await api.get<ApiResponse<DailyRoom>>(
      `/tutor-session/tutor-room-token/${tutorSessionId}`
    );
    return response.data;
  },

  // =====================
  // Tutor Endpoints
  // =====================

  // Get pending sessions
  getPendingSessions: async (): Promise<ApiResponse<PendingHelpRequest[]>> => {
    const response = await api.get<ApiResponse<PendingHelpRequest[]>>(
      '/tutor-session/pending'
    );
    return response.data;
  },

  // Accept session
  acceptSession: async (
    sessionId: string
  ): Promise<ApiResponse<AcceptSessionResponse>> => {
    const response = await api.post<ApiResponse<AcceptSessionResponse>>(
      `/tutor-session/${sessionId}/accept`
    );
    return response.data;
  },

  // Start session
  startSession: async (
    sessionId: string
  ): Promise<ApiResponse<SessionActionResponse>> => {
    const response = await api.post<ApiResponse<SessionActionResponse>>(
      `/tutor-session/${sessionId}/start`
    );
    return response.data;
  },

  // End session
  endSession: async (
    sessionId: string
  ): Promise<ApiResponse<SessionActionResponse>> => {
    const response = await api.post<ApiResponse<SessionActionResponse>>(
      `/tutor-session/${sessionId}/end`
    );
    return response.data;
  },

  // Get chat history
  getChatHistory: async (
    sessionId: string
  ): Promise<ApiResponse<ChatHistoryResponse>> => {
    const response = await api.get<ApiResponse<ChatHistoryResponse>>(
      `/tutor-session/${sessionId}/chat-history`
    );
    return response.data;
  },

  // Download chat as markdown
  downloadChat: (sessionId: string): string => {
    const baseUrl = api.defaults.baseURL || '';
    return `${baseUrl}/tutor-session/${sessionId}/download`;
  },

  // Save whiteboard data
  saveWhiteboard: async (
    sessionId: string,
    whiteboardData: { elements: unknown[]; appState?: unknown }
  ): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await api.put<ApiResponse<{ success: boolean }>>(
      `/tutor-session/${sessionId}/whiteboard`,
      { whiteboardData }
    );
    return response.data;
  },

  // Save Daily.co meeting data (chat, recordings, etc.)
  saveDailyMeetingData: async (
    sessionId: string,
    meetingData: {
      roomUrl?: string;
      chatMessages?: any[];
      recordingUrl?: string;
      duration?: number;
      participants?: any[];
    }
  ): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await api.post<ApiResponse<{ success: boolean }>>(
      `/tutor-session/${sessionId}/save-daily-data`,
      { meetingData }
    );
    return response.data;
  },

  // Get Daily.co meeting data for a session
  getDailyMeetingData: async (
    sessionId: string
  ): Promise<ApiResponse<{
    roomUrl?: string;
    chatMessages?: any[];
    recordingUrl?: string;
    duration?: number;
    participants?: any[];
    createdAt?: string;
    updatedAt?: string;
  }>> => {
    const response = await api.get<ApiResponse<any>>(
      `/tutor-session/${sessionId}/daily-meeting-data`
    );
    return response.data;
  },
};

export default tutorSessionApi;

