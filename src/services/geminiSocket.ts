import { io, Socket } from 'socket.io-client';
import {
  StreamChunk,
  TutorStatusUpdateEvent,
  TutorConnectedEvent,
  TutorWaitUpdateEvent,
} from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let geminiSocket: Socket | null = null;
let connectionListeners: Array<() => void> = [];

// ============================================
// Connection Management
// ============================================

export const connectGeminiSocket = (token: string): Socket => {
  if (geminiSocket?.connected) {
    return geminiSocket;
  }

  // Disconnect existing socket if any
  if (geminiSocket) {
    geminiSocket.disconnect();
  }

  geminiSocket = io(`${WS_URL}/gemini-chat`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  geminiSocket.on('connect', () => {
    console.log('[GeminiSocket] Connected, id:', geminiSocket?.id);
    connectionListeners.forEach((listener) => listener());
  });

  geminiSocket.on('disconnect', (reason) => {
    console.log('[GeminiSocket] Disconnected:', reason);
  });

  geminiSocket.on('connect_error', (error) => {
    console.error('[GeminiSocket] Connection error:', error.message);
  });

  // Debug: Log all incoming events
  geminiSocket.onAny((eventName, ...args) => {
    console.log('[GeminiSocket] Received event:', eventName, args);
  });

  geminiSocket.on('reconnect', (attemptNumber) => {
    console.log('[GeminiSocket] Reconnected after', attemptNumber, 'attempts');
    connectionListeners.forEach((listener) => listener());
  });

  return geminiSocket;
};

export const disconnectGeminiSocket = (): void => {
  if (geminiSocket) {
    geminiSocket.disconnect();
    geminiSocket = null;
  }
};

export const getGeminiSocket = (): Socket | null => geminiSocket;

export const onGeminiSocketConnect = (callback: () => void): (() => void) => {
  connectionListeners.push(callback);
  if (geminiSocket?.connected) {
    callback();
  }
  return () => {
    connectionListeners = connectionListeners.filter((l) => l !== callback);
  };
};

// ============================================
// Session Management
// ============================================

export const joinGeminiSession = (
  sessionId: string,
  callback?: (response: { success: boolean; sessionId?: string; error?: string }) => void
): void => {
  if (geminiSocket?.connected) {
    console.log('[GeminiSocket] Joining session:', sessionId);
    geminiSocket.emit('joinSession', sessionId, callback);
  } else {
    console.warn('[GeminiSocket] Cannot join session - socket not connected');
    callback?.({ success: false, error: 'Socket not connected' });
  }
};

export const leaveGeminiSession = (sessionId: string): void => {
  if (geminiSocket?.connected) {
    console.log('[GeminiSocket] Leaving session:', sessionId);
    geminiSocket.emit('leaveSession', sessionId);
  }
};

// ============================================
// Message Sending via WebSocket
// ============================================

export interface SendMessageViaSocket {
  content: string;
  sessionId?: string;
}

export const sendGeminiMessage = (
  data: SendMessageViaSocket,
  callback?: (response: { success: boolean; messageId?: string; sessionId?: string; error?: string }) => void
): void => {
  if (geminiSocket?.connected) {
    console.log('[GeminiSocket] Sending message:', data);
    geminiSocket.emit('sendMessage', data, callback);
  } else {
    console.error('[GeminiSocket] Cannot send message - socket not connected');
    callback?.({ success: false, error: 'Socket not connected' });
  }
};

export const retryGeminiMessage = (
  messageId: string,
  callback?: (response: { success: boolean; messageId?: string; sessionId?: string; error?: string }) => void
): void => {
  if (geminiSocket?.connected) {
    console.log('[GeminiSocket] Retrying message:', messageId);
    geminiSocket.emit('retryMessage', messageId, callback);
  } else {
    console.error('[GeminiSocket] Cannot retry message - socket not connected');
    callback?.({ success: false, error: 'Socket not connected' });
  }
};

export const getGeminiStreamState = (
  streamId: string,
  callback?: (state: { content?: string; complete?: boolean; error?: string }) => void
): void => {
  if (geminiSocket?.connected) {
    geminiSocket.emit('getStreamState', streamId, callback);
  } else {
    callback?.({ error: 'Socket not connected' });
  }
};

// ============================================
// Stream Event Listeners
// ============================================

export const onStreamChunk = (callback: (chunk: StreamChunk) => void): void => {
  geminiSocket?.on('streamChunk', callback);
};

export const offStreamChunk = (callback?: (chunk: StreamChunk) => void): void => {
  if (callback) {
    geminiSocket?.off('streamChunk', callback);
  } else {
    geminiSocket?.off('streamChunk');
  }
};

// ============================================
// Tutor Status Event Listeners
// ============================================

export const onTutorStatusUpdate = (callback: (data: TutorStatusUpdateEvent) => void): void => {
  geminiSocket?.on('tutorStatusUpdate', callback);
};

export const offTutorStatusUpdate = (callback?: (data: TutorStatusUpdateEvent) => void): void => {
  if (callback) {
    geminiSocket?.off('tutorStatusUpdate', callback);
  } else {
    geminiSocket?.off('tutorStatusUpdate');
  }
};

export const onTutorConnected = (callback: (data: TutorConnectedEvent) => void): void => {
  geminiSocket?.on('tutorConnected', callback);
};

export const offTutorConnected = (callback?: (data: TutorConnectedEvent) => void): void => {
  if (callback) {
    geminiSocket?.off('tutorConnected', callback);
  } else {
    geminiSocket?.off('tutorConnected');
  }
};

export const onTutorWaitUpdate = (callback: (data: TutorWaitUpdateEvent) => void): void => {
  geminiSocket?.on('tutorWaitUpdate', callback);
};

export const offTutorWaitUpdate = (callback?: (data: TutorWaitUpdateEvent) => void): void => {
  if (callback) {
    geminiSocket?.off('tutorWaitUpdate', callback);
  } else {
    geminiSocket?.off('tutorWaitUpdate');
  }
};

// ============================================
// Tutor Session Events
// ============================================

export const onTutorAccepted = (callback: (data: any) => void): void => {
  geminiSocket?.on('tutorAccepted', callback);
};

export const offTutorAccepted = (callback?: (data: any) => void): void => {
  if (callback) {
    geminiSocket?.off('tutorAccepted', callback);
  } else {
    geminiSocket?.off('tutorAccepted');
  }
};

export const onSessionStatusChanged = (callback: (data: any) => void): void => {
  geminiSocket?.on('sessionStatusChanged', callback);
};

export const offSessionStatusChanged = (callback?: (data: any) => void): void => {
  if (callback) {
    geminiSocket?.off('sessionStatusChanged', callback);
  } else {
    geminiSocket?.off('sessionStatusChanged');
  }
};

// ============================================
// Export Default
// ============================================

export default {
  connectGeminiSocket,
  disconnectGeminiSocket,
  getGeminiSocket,
  onGeminiSocketConnect,
  joinGeminiSession,
  leaveGeminiSession,
  sendGeminiMessage,
  retryGeminiMessage,
  getGeminiStreamState,
  onStreamChunk,
  offStreamChunk,
  onTutorStatusUpdate,
  offTutorStatusUpdate,
  onTutorConnected,
  offTutorConnected,
  onTutorWaitUpdate,
  offTutorWaitUpdate,
  onTutorAccepted,
  offTutorAccepted,
  onSessionStatusChanged,
  offSessionStatusChanged,
};

