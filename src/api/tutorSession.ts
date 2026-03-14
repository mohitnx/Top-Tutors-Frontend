import api from './client';
import { unwrapData } from './unwrap';
import {
  PendingHelpRequest,
  AcceptSessionResponse,
  ChatHistoryResponse,
  ConsentStatusResponse,
  DailyRoom,
  AIUrgency,
  AvailableTutor,
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
  ): Promise<RequestTutorHelpResponse> => {
    const response = await api.post('/tutor-session/request', data);
    return unwrapData<RequestTutorHelpResponse>(response.data);
  },

  // Update live sharing consent
  updateConsent: async (
    sessionId: string,
    enabled: boolean
  ): Promise<UpdateConsentResponse> => {
    const response = await api.put(
      `/tutor-session/consent/${sessionId}`,
      { enabled }
    );
    return unwrapData<UpdateConsentResponse>(response.data);
  },

  // Get consent status
  getConsentStatus: async (
    sessionId: string
  ): Promise<ConsentStatusResponse> => {
    const response = await api.get(`/tutor-session/consent/${sessionId}`);
    return unwrapData<ConsentStatusResponse>(response.data);
  },

  // Get student room token (for joining video call)
  getStudentRoomToken: async (
    tutorSessionId: string
  ): Promise<DailyRoom> => {
    const response = await api.get(
      `/tutor-session/student-room-token/${tutorSessionId}`
    );
    return unwrapData<DailyRoom>(response.data);
  },

  // Get tutor room token (for joining video call as host)
  getTutorRoomToken: async (
    tutorSessionId: string
  ): Promise<DailyRoom> => {
    const response = await api.get(
      `/tutor-session/tutor-room-token/${tutorSessionId}`
    );
    return unwrapData<DailyRoom>(response.data);
  },

  // =====================
  // Tutor Endpoints
  // =====================

  // Get pending sessions
  getPendingSessions: async (): Promise<PendingHelpRequest[]> => {
    const response = await api.get('/tutor-session/pending');
    return unwrapData<PendingHelpRequest[]>(response.data);
  },

  // Accept session
  acceptSession: async (
    sessionId: string
  ): Promise<AcceptSessionResponse> => {
    const response = await api.post(`/tutor-session/${sessionId}/accept`);
    return unwrapData<AcceptSessionResponse>(response.data);
  },

  // Start session
  startSession: async (
    sessionId: string
  ): Promise<SessionActionResponse> => {
    const response = await api.post(`/tutor-session/${sessionId}/start`);
    return unwrapData<SessionActionResponse>(response.data);
  },

  // End session
  endSession: async (
    sessionId: string
  ): Promise<SessionActionResponse> => {
    const response = await api.post(`/tutor-session/${sessionId}/end`);
    return unwrapData<SessionActionResponse>(response.data);
  },

  // Get chat history
  getChatHistory: async (
    sessionId: string
  ): Promise<ChatHistoryResponse> => {
    const response = await api.get(`/tutor-session/${sessionId}/chat-history`);
    return unwrapData<ChatHistoryResponse>(response.data);
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
  ): Promise<{ success: boolean }> => {
    const response = await api.put(
      `/tutor-session/${sessionId}/whiteboard`,
      { whiteboardData }
    );
    return unwrapData<{ success: boolean }>(response.data);
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
  ): Promise<{ success: boolean }> => {
    const response = await api.post(
      `/tutor-session/${sessionId}/save-daily-data`,
      { meetingData }
    );
    return unwrapData<{ success: boolean }>(response.data);
  },

  // =====================
  // Multi-Tutor Endpoints
  // =====================

  // Invite another tutor to join a session
  inviteTutor: async (
    sessionId: string,
    tutorId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(
      `/tutor-session/${sessionId}/invite-tutor`,
      { tutorId }
    );
    return unwrapData<{ success: boolean; message: string }>(response.data);
  },

  // Get available tutors to invite
  getAvailableTutors: async (
    sessionId: string
  ): Promise<AvailableTutor[]> => {
    const response = await api.get(
      `/tutor-session/${sessionId}/available-tutors`
    );
    return unwrapData<AvailableTutor[]>(response.data);
  },

  // Get Daily.co meeting data for a session
  getDailyMeetingData: async (
    sessionId: string
  ): Promise<{
    roomUrl?: string;
    chatMessages?: any[];
    recordingUrl?: string;
    duration?: number;
    participants?: any[];
    createdAt?: string;
    updatedAt?: string;
  }> => {
    const response = await api.get(
      `/tutor-session/${sessionId}/daily-meeting-data`
    );
    return unwrapData<{
      roomUrl?: string;
      chatMessages?: any[];
      recordingUrl?: string;
      duration?: number;
      participants?: any[];
      createdAt?: string;
      updatedAt?: string;
    }>(response.data);
  },
};

export default tutorSessionApi;
