import api from './client';
import { 
  ApiResponse, 
  Conversation, 
  Message, 
  PaginatedResponse, 
  MessageType,
  ConversationStatus 
} from '../types';

export interface SendMessageData {
  content: string;
  messageType: MessageType;
  conversationId?: string;
}

export interface SendMessageResponse {
  message: Message;
  conversation: Conversation;
}

export interface SendAudioMessageResponse {
  message: Message & {
    transcription?: string;
    audioDuration?: number;
    audioUrl?: string;
  };
  classification?: {
    transcription: string;
    detectedLanguage: string;
    subject: string;
    topic: string;
    keywords: string[];
    urgency: string;
  };
  conversation: Conversation;
}

export const messagesApi = {
  // Send a text message (creates conversation if no conversationId)
  sendMessage: async (data: SendMessageData): Promise<ApiResponse<SendMessageResponse>> => {
    const response = await api.post<ApiResponse<SendMessageResponse>>('/messages/send', data);
    return response.data;
  },

  // Send an audio message
  sendAudioMessage: async (
    audioFile: File, 
    conversationId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<ApiResponse<SendAudioMessageResponse>> => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    if (conversationId) {
      formData.append('conversationId', conversationId);
    }

    const response = await api.post<ApiResponse<SendAudioMessageResponse>>(
      '/messages/send/audio',
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

  // Get my conversations
  getConversations: async (
    page = 1, 
    limit = 10, 
    status?: ConversationStatus
  ): Promise<ApiResponse<PaginatedResponse<Conversation>>> => {
    const params: Record<string, unknown> = { page, limit };
    if (status) params.status = status;
    
    const response = await api.get<ApiResponse<PaginatedResponse<Conversation>>>(
      '/messages/conversations',
      { params }
    );
    return response.data;
  },

  // Get pending conversations (admin)
  getPendingConversations: async (
    page = 1, 
    limit = 10
  ): Promise<ApiResponse<PaginatedResponse<Conversation>>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<Conversation>>>(
      '/messages/conversations/pending',
      { params: { page, limit } }
    );
    return response.data;
  },

  // Get conversation by ID with messages
  getConversation: async (id: string): Promise<ApiResponse<Conversation>> => {
    const response = await api.get<ApiResponse<Conversation>>(`/messages/conversations/${id}`);
    return response.data;
  },

  // Assign tutor to conversation
  assignTutor: async (conversationId: string, tutorId: string): Promise<ApiResponse<Conversation>> => {
    const response = await api.post<ApiResponse<Conversation>>(
      `/messages/conversations/${conversationId}/assign`,
      { tutorId }
    );
    return response.data;
  },

  // Close conversation
  closeConversation: async (
    conversationId: string, 
    status: 'RESOLVED' | 'CLOSED'
  ): Promise<ApiResponse<Conversation>> => {
    const response = await api.post<ApiResponse<Conversation>>(
      `/messages/conversations/${conversationId}/close`,
      { status }
    );
    return response.data;
  },

  // Mark conversation as read
  markAsRead: async (conversationId: string): Promise<void> => {
    await api.post(`/messages/conversations/${conversationId}/read`);
  },
};

export default messagesApi;
