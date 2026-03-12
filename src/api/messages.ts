import api from './client';
import { unwrapData } from './unwrap';
import {
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

export interface ReactionResponse {
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
}

export interface ShareResponse {
  conversationId: string;
  isShared: boolean;
  shareToken: string;
  shareUrl: string;
  sharedAt: string;
}

export interface ShareStatus {
  conversationId: string;
  isShared: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  sharedAt: string | null;
}

export interface SharedConversationData {
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
}

export interface PendingForMeResponse {
  conversations: Array<Conversation & { canAccept: boolean }>;
  tutorStatus: {
    isBusy: boolean;
    hasActiveSession: boolean;
    canAcceptNew: boolean;
  };
}

export interface CallHistoryResponse {
  calls: CallLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const messagesApi = {
  // Send a text message (creates conversation if no conversationId)
  sendMessage: async (data: SendMessageData): Promise<SendMessageResponse> => {
    const response = await api.post('/messages/send', data);
    return unwrapData<SendMessageResponse>(response.data);
  },

  // Send an audio message
  sendAudioMessage: async (
    audioFile: File,
    conversationId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<SendAudioMessageResponse> => {
    const formData = new FormData();
    formData.append('audio', audioFile);

    if (conversationId) {
      formData.append('conversationId', conversationId);
    }

    const response = await api.post(
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
    return unwrapData<SendAudioMessageResponse>(response.data);
  },

  // Get my conversations
  getConversations: async (
    page = 1,
    limit = 10,
    status?: ConversationStatus
  ): Promise<PaginatedResponse<Conversation>> => {
    const params: Record<string, unknown> = { page, limit };
    if (status) params.status = status;

    const response = await api.get(
      '/messages/conversations',
      { params }
    );
    return unwrapData<PaginatedResponse<Conversation>>(response.data);
  },

  // Get pending conversations (admin)
  getPendingConversations: async (
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<Conversation>> => {
    const response = await api.get(
      '/messages/conversations/pending',
      { params: { page, limit } }
    );
    return unwrapData<PaginatedResponse<Conversation>>(response.data);
  },

  // Get pending conversations for tutor's dashboard (matching their topics)
  getPendingForMe: async (): Promise<PendingForMeResponse> => {
    const response = await api.get('/messages/conversations/pending/for-me');
    return unwrapData<PendingForMeResponse>(response.data);
  },

  // Check if tutor can accept a specific conversation
  canAcceptConversation: async (conversationId: string): Promise<{
    canAccept: boolean;
    reason?: string;
  }> => {
    const response = await api.get(`/messages/conversations/${conversationId}/can-accept`);
    return unwrapData<{ canAccept: boolean; reason?: string }>(response.data);
  },

  // Get conversation by ID with messages
  getConversation: async (id: string): Promise<Conversation> => {
    const response = await api.get(`/messages/conversations/${id}`);
    return unwrapData<Conversation>(response.data);
  },

  // Assign tutor to conversation (Admin)
  assignTutor: async (conversationId: string, tutorId: string): Promise<Conversation> => {
    const response = await api.post(
      `/messages/conversations/${conversationId}/assign`,
      { tutorId }
    );
    return unwrapData<Conversation>(response.data);
  },

  // Tutor accepts a conversation
  acceptConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await api.post(
      `/messages/conversations/${conversationId}/accept`
    );
    return unwrapData<Conversation>(response.data);
  },

  // Close conversation
  closeConversation: async (
    conversationId: string,
    status: 'RESOLVED' | 'CLOSED'
  ): Promise<Conversation> => {
    const response = await api.post(
      `/messages/conversations/${conversationId}/close`,
      { status }
    );
    return unwrapData<Conversation>(response.data);
  },

  // Mark conversation as read
  markAsRead: async (conversationId: string): Promise<void> => {
    await api.post(`/messages/conversations/${conversationId}/read`);
  },

  // Get calls for a specific conversation
  getConversationCalls: async (conversationId: string): Promise<CallLog[]> => {
    const response = await api.get(
      `/messages/conversations/${conversationId}/calls`
    );
    return unwrapData<CallLog[]>(response.data);
  },

  // Get all call history
  getCallHistory: async (
    page = 1,
    limit = 20
  ): Promise<CallHistoryResponse> => {
    const response = await api.get(
      '/messages/calls/history',
      { params: { page, limit } }
    );
    return unwrapData<CallHistoryResponse>(response.data);
  },

  // Send message to existing conversation (alternative to WebSocket)
  sendMessageToConversation: async (
    conversationId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT
  ): Promise<{ message: Message; conversation: Conversation }> => {
    const response = await api.post(
      `/messages/conversations/${conversationId}/messages`,
      { content, messageType }
    );
    return unwrapData<{ message: Message; conversation: Conversation }>(response.data);
  },

  // Send attachment(s) to a conversation
  sendAttachments: async (
    conversationId: string,
    files: File[],
    content?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<{ message: Message; attachments: Attachment[] }> => {
    const formData = new FormData();

    // Append each file
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Append optional text content
    if (content) {
      formData.append('content', content);
    }

    const response = await api.post(
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
    return unwrapData<{ message: Message; attachments: Attachment[] }>(response.data);
  },

  // =====================
  // Message Reactions API
  // =====================

  // Add/toggle reaction on a message
  addReaction: async (messageId: string, type: 'LIKE' | 'DISLIKE'): Promise<ReactionResponse> => {
    const response = await api.post(`/messages/messages/${messageId}/reactions`, { type });
    return unwrapData<ReactionResponse>(response.data);
  },

  // Remove reaction from a message
  removeReaction: async (messageId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/messages/messages/${messageId}/reactions`);
    return unwrapData<{ success: boolean }>(response.data);
  },

  // Get reaction summary for a message
  getReactionSummary: async (messageId: string): Promise<{
    messageId: string;
    likeCount: number;
    dislikeCount: number;
    userReaction: 'LIKE' | 'DISLIKE' | null;
  }> => {
    const response = await api.get(`/messages/messages/${messageId}/reactions`);
    return unwrapData<{
      messageId: string;
      likeCount: number;
      dislikeCount: number;
      userReaction: 'LIKE' | 'DISLIKE' | null;
    }>(response.data);
  },

  // ==========================
  // Conversation Sharing API
  // ==========================

  // Share a conversation
  shareConversation: async (conversationId: string): Promise<ShareResponse> => {
    const response = await api.post(`/messages/conversations/${conversationId}/share`);
    return unwrapData<ShareResponse>(response.data);
  },

  // Stop sharing a conversation
  unshareConversation: async (conversationId: string): Promise<{
    conversationId: string;
    isShared: boolean;
  }> => {
    const response = await api.delete(`/messages/conversations/${conversationId}/share`);
    return unwrapData<{ conversationId: string; isShared: boolean }>(response.data);
  },

  // Get share status for a conversation
  getShareStatus: async (conversationId: string): Promise<ShareStatus> => {
    const response = await api.get(`/messages/conversations/${conversationId}/share`);
    return unwrapData<ShareStatus>(response.data);
  },

  // View a shared conversation
  getSharedConversation: async (shareToken: string): Promise<SharedConversationData> => {
    const response = await api.get(`/messages/shared/${shareToken}`);
    return unwrapData<SharedConversationData>(response.data);
  },

  // ==========================
  // Waiting Queue API
  // ==========================

  // Cancel a waiting session (student side)
  cancelWaitingSession: async (
    conversationId: string,
    reason?: SessionCancelReason,
    reasonDetails?: string
  ): Promise<CancelWaitingSessionResponse> => {
    const response = await api.post(
      `/messages/conversations/${conversationId}/cancel`,
      { reason, reasonDetails }
    );
    return unwrapData<CancelWaitingSessionResponse>(response.data);
  },
};

export default messagesApi;
