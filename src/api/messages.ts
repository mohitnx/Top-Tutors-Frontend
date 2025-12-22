import api from './client';
import { 
  ApiResponse, 
  Conversation, 
  Message, 
  PaginatedResponse, 
  MessageType,
  ConversationStatus,
  CallLog,
  Attachment,
  SessionCancelReason,
  CancelWaitingSessionResponse,
} from '../types';

export interface SendMessageData {
  content: string;
  messageType: MessageType;
  conversationId?: string;
}

export interface SendMessageResponse {
  message: Message;
  conversation: Conversation;
  isNewConversation?: boolean;
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

  // Get pending conversations for tutor's dashboard (matching their topics)
  getPendingForMe: async (): Promise<ApiResponse<{
    conversations: Array<Conversation & { canAccept: boolean }>;
    tutorStatus: {
      isBusy: boolean;
      hasActiveSession: boolean;
      canAcceptNew: boolean;
    };
  }>> => {
    const response = await api.get<ApiResponse<{
      conversations: Array<Conversation & { canAccept: boolean }>;
      tutorStatus: {
        isBusy: boolean;
        hasActiveSession: boolean;
        canAcceptNew: boolean;
      };
    }>>('/messages/conversations/pending/for-me');
    return response.data;
  },

  // Check if tutor can accept a specific conversation
  canAcceptConversation: async (conversationId: string): Promise<ApiResponse<{
    canAccept: boolean;
    reason?: string;
  }>> => {
    const response = await api.get<ApiResponse<{
      canAccept: boolean;
      reason?: string;
    }>>(`/messages/conversations/${conversationId}/can-accept`);
    return response.data;
  },

  // Get conversation by ID with messages
  getConversation: async (id: string): Promise<ApiResponse<Conversation>> => {
    const response = await api.get<ApiResponse<Conversation>>(`/messages/conversations/${id}`);
    return response.data;
  },

  // Assign tutor to conversation (Admin)
  assignTutor: async (conversationId: string, tutorId: string): Promise<ApiResponse<Conversation>> => {
    const response = await api.post<ApiResponse<Conversation>>(
      `/messages/conversations/${conversationId}/assign`,
      { tutorId }
    );
    return response.data;
  },

  // Tutor accepts a conversation
  acceptConversation: async (conversationId: string): Promise<ApiResponse<Conversation>> => {
    const response = await api.post<ApiResponse<Conversation>>(
      `/messages/conversations/${conversationId}/accept`
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

  // Get calls for a specific conversation
  getConversationCalls: async (conversationId: string): Promise<ApiResponse<CallLog[]>> => {
    const response = await api.get<ApiResponse<CallLog[]>>(
      `/messages/conversations/${conversationId}/calls`
    );
    return response.data;
  },

  // Get all call history
  getCallHistory: async (
    page = 1,
    limit = 20
  ): Promise<ApiResponse<{ calls: CallLog[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> => {
    const response = await api.get<ApiResponse<{ calls: CallLog[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>(
      '/messages/calls/history',
      { params: { page, limit } }
    );
    return response.data;
  },

  // Send message to existing conversation (alternative to WebSocket)
  sendMessageToConversation: async (
    conversationId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT
  ): Promise<ApiResponse<{ message: Message; conversation: Conversation }>> => {
    const response = await api.post<ApiResponse<{ message: Message; conversation: Conversation }>>(
      `/messages/conversations/${conversationId}/messages`,
      { content, messageType }
    );
    return response.data;
  },

  // Send attachment(s) to a conversation
  sendAttachments: async (
    conversationId: string,
    files: File[],
    content?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<ApiResponse<{ message: Message; attachments: Attachment[] }>> => {
    const formData = new FormData();
    
    // Append each file
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    // Append optional text content
    if (content) {
      formData.append('content', content);
    }

    const response = await api.post<ApiResponse<{ message: Message; attachments: Attachment[] }>>(
      `/messages/conversations/${conversationId}/attachments${files.length > 1 ? '/multiple' : ''}`,
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

  // =====================
  // Message Reactions API
  // =====================

  // Add/toggle reaction on a message
  addReaction: async (messageId: string, type: 'LIKE' | 'DISLIKE'): Promise<ApiResponse<{
    added?: boolean;
    updated?: boolean;
    removed?: boolean;
    type: 'LIKE' | 'DISLIKE';
    reaction?: {
      id: string;
      messageId: string;
      userId: string;
      type: 'LIKE' | 'DISLIKE';
      createdAt: string;
    };
  }>> => {
    const response = await api.post(`/messages/messages/${messageId}/reactions`, { type });
    return response.data;
  },

  // Remove reaction from a message
  removeReaction: async (messageId: string): Promise<ApiResponse<{ success: boolean }>> => {
    const response = await api.delete(`/messages/messages/${messageId}/reactions`);
    return response.data;
  },

  // Get reaction summary for a message
  getReactionSummary: async (messageId: string): Promise<ApiResponse<{
    messageId: string;
    likeCount: number;
    dislikeCount: number;
    userReaction: 'LIKE' | 'DISLIKE' | null;
  }>> => {
    const response = await api.get(`/messages/messages/${messageId}/reactions`);
    return response.data;
  },

  // ==========================
  // Conversation Sharing API
  // ==========================

  // Share a conversation
  shareConversation: async (conversationId: string): Promise<ApiResponse<{
    conversationId: string;
    isShared: boolean;
    shareToken: string;
    shareUrl: string;
    sharedAt: string;
  }>> => {
    const response = await api.post(`/messages/conversations/${conversationId}/share`);
    return response.data;
  },

  // Stop sharing a conversation
  unshareConversation: async (conversationId: string): Promise<ApiResponse<{
    conversationId: string;
    isShared: boolean;
  }>> => {
    const response = await api.delete(`/messages/conversations/${conversationId}/share`);
    return response.data;
  },

  // Get share status for a conversation
  getShareStatus: async (conversationId: string): Promise<ApiResponse<{
    conversationId: string;
    isShared: boolean;
    shareToken: string | null;
    shareUrl: string | null;
    sharedAt: string | null;
  }>> => {
    const response = await api.get(`/messages/conversations/${conversationId}/share`);
    return response.data;
  },

  // View a shared conversation
  getSharedConversation: async (shareToken: string): Promise<ApiResponse<{
    id: string;
    subject: string;
    topic?: string;
    studentName: string;
    tutorName?: string;
    status: string;
    createdAt: string;
    messages: Array<{
      id: string;
      senderType: 'STUDENT' | 'TUTOR' | 'SYSTEM';
      content?: string;
      messageType: string;
      likeCount: number;
      dislikeCount: number;
      createdAt: string;
    }>;
  }>> => {
    const response = await api.get(`/messages/shared/${shareToken}`);
    return response.data;
  },

  // ==========================
  // Waiting Queue API
  // ==========================

  // Cancel a waiting session (student side)
  cancelWaitingSession: async (
    conversationId: string,
    reason?: SessionCancelReason,
    reasonDetails?: string
  ): Promise<ApiResponse<CancelWaitingSessionResponse>> => {
    const response = await api.post<ApiResponse<CancelWaitingSessionResponse>>(
      `/messages/conversations/${conversationId}/cancel`,
      { reason, reasonDetails }
    );
    return response.data;
  },
};

export default messagesApi;
