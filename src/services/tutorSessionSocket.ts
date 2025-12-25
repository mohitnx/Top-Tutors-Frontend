import { io, Socket } from 'socket.io-client';
import {
  TutorSessionAcceptedEvent,
  NewAIMessageEvent,
  ConsentChangedEvent,
  SessionStatusChangedEvent,
  TutorSessionParticipantEvent,
  TutorStudentChatMessage,
  WhiteboardUpdateEvent,
  WhiteboardCursorEvent,
  TutorSessionTypingEvent,
  TutorSessionCallSignal,
  NewHelpRequestEvent,
  CallSignalType,
} from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let tutorSessionSocket: Socket | null = null;
let connectionListeners: Array<() => void> = [];

// ============================================
// Connection Management
// ============================================

export const connectTutorSessionSocket = (token: string): Socket => {
  if (tutorSessionSocket?.connected) {
    return tutorSessionSocket;
  }

  // Disconnect existing socket if any
  if (tutorSessionSocket) {
    tutorSessionSocket.disconnect();
  }

  tutorSessionSocket = io(`${WS_URL}/tutor-session`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  tutorSessionSocket.on('connect', () => {
    console.log('[TutorSessionSocket] Connected, id:', tutorSessionSocket?.id);
    connectionListeners.forEach(listener => listener());
  });

  tutorSessionSocket.on('disconnect', (reason) => {
    console.log('[TutorSessionSocket] Disconnected:', reason);
  });

  tutorSessionSocket.on('connect_error', (error) => {
    console.error('[TutorSessionSocket] Connection error:', error.message, error);
  });

  tutorSessionSocket.on('error', (error) => {
    console.error('[TutorSessionSocket] Socket error:', error);
  });

  // DEBUG: Log ALL incoming events
  tutorSessionSocket.onAny((eventName, ...args) => {
    console.log('[TutorSessionSocket] Received event:', eventName, args);
  });

  // DEBUG: Log ALL outgoing events
  const originalEmit = tutorSessionSocket.emit;
  tutorSessionSocket.emit = function(event: string, ...args: any[]) {
    console.log('[TutorSessionSocket] Sending event:', event, args);
    return originalEmit.call(this, event, ...args);
  };

  tutorSessionSocket.on('reconnect', (attemptNumber) => {
    console.log('[TutorSessionSocket] Reconnected after', attemptNumber, 'attempts');
    connectionListeners.forEach(listener => listener());
  });

  return tutorSessionSocket;
};

export const disconnectTutorSessionSocket = (): void => {
  if (tutorSessionSocket) {
    tutorSessionSocket.disconnect();
    tutorSessionSocket = null;
  }
};

export const getTutorSessionSocket = (): Socket | null => tutorSessionSocket;

export const onTutorSessionSocketConnect = (callback: () => void): (() => void) => {
  connectionListeners.push(callback);
  if (tutorSessionSocket?.connected) {
    callback();
  }
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== callback);
  };
};

// ============================================
// Client → Server Events
// ============================================

// Join a session room
export const joinSession = (sessionId: string): void => {
  console.log('[TutorSessionSocket] joinSession called, socket connected:', tutorSessionSocket?.connected, 'socket exists:', !!tutorSessionSocket);
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Joining session:', sessionId);
    tutorSessionSocket.emit('joinSession', { sessionId });
  } else {
    console.warn('[TutorSessionSocket] Cannot join session - socket not connected');
    // Try to emit anyway in case connection is pending
    if (tutorSessionSocket) {
      console.log('[TutorSessionSocket] Attempting to emit joinSession despite not being connected');
      tutorSessionSocket.emit('joinSession', { sessionId });
    }
  }
};

// Leave a session room
export const leaveSession = (sessionId: string): void => {
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Leaving session:', sessionId);
    tutorSessionSocket.emit('leaveSession', { sessionId });
  }
};

// Subscribe to AI session updates (Student side)
export const subscribeToAISession = (aiSessionId: string): void => {
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Subscribing to AI session:', aiSessionId);
    tutorSessionSocket.emit('subscribeToAISession', { aiSessionId });
  }
};

// Subscribe to tutor session updates
export const subscribeToSession = (sessionId: string): void => {
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Subscribing to tutor session:', sessionId);
    tutorSessionSocket.emit('subscribeToSession', { sessionId });
  }
};

// Unsubscribe from tutor session updates
export const unsubscribeFromSession = (sessionId: string): void => {
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Unsubscribing from tutor session:', sessionId);
    tutorSessionSocket.emit('unsubscribeFromSession', { sessionId });
  }
};

// Send chat message (Tutor-Student direct chat)
export const sendChatMessage = (sessionId: string, content: string): void => {
  console.log('[TutorSessionSocket] sendChatMessage called, socket connected:', tutorSessionSocket?.connected);
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Sending chat message');
    tutorSessionSocket.emit('sendChatMessage', { sessionId, content });
  } else {
    console.warn('[TutorSessionSocket] Cannot send chat message - socket not connected');
  }
};

// Send whiteboard update
export const sendWhiteboardUpdate = (
  sessionId: string,
  elements: unknown[],
  appState?: unknown
): void => {
  if (tutorSessionSocket?.connected) {
    tutorSessionSocket.emit('whiteboardUpdate', { sessionId, elements, appState });
  }
};

// Send whiteboard cursor position
export const sendWhiteboardCursor = (sessionId: string, x: number, y: number): void => {
  if (tutorSessionSocket?.connected) {
    tutorSessionSocket.emit('whiteboardCursor', { sessionId, x, y });
  }
};

// Get chat history
export const getChatHistory = (sessionId: string): void => {
  console.log('[TutorSessionSocket] getChatHistory called, socket connected:', tutorSessionSocket?.connected);
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Requesting chat history');
    tutorSessionSocket.emit('getChatHistory', { sessionId });
  } else {
    console.warn('[TutorSessionSocket] Cannot get chat history - socket not connected');
  }
};

// Get whiteboard data
export const getWhiteboardData = (sessionId: string): void => {
  console.log('[TutorSessionSocket] getWhiteboardData called, socket connected:', tutorSessionSocket?.connected);
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Requesting whiteboard data');
    tutorSessionSocket.emit('getWhiteboardData', { sessionId });
  } else {
    console.warn('[TutorSessionSocket] Cannot get whiteboard data - socket not connected');
  }
};

// Send typing indicator
export const sendTypingIndicator = (sessionId: string, isTyping: boolean): void => {
  if (tutorSessionSocket?.connected) {
    tutorSessionSocket.emit('typing', { sessionId, isTyping });
  }
};

// Send call signal
export const sendCallSignal = (sessionId: string, signal: CallSignalType): void => {
  if (tutorSessionSocket?.connected) {
    console.log('[TutorSessionSocket] Sending call signal:', signal);
    tutorSessionSocket.emit('callSignal', { sessionId, signal });
  }
};

// ============================================
// Server → Client Event Listeners
// ============================================

// Connected event
export const onConnected = (callback: (data: { role: string }) => void): void => {
  tutorSessionSocket?.on('connected', callback);
};

export const offConnected = (): void => {
  tutorSessionSocket?.off('connected');
};

// Tutor Accepted (Student receives)
export const onTutorAccepted = (callback: (data: TutorSessionAcceptedEvent) => void): void => {
  tutorSessionSocket?.on('tutorAccepted', callback);
};

export const offTutorAccepted = (): void => {
  tutorSessionSocket?.off('tutorAccepted');
};

// New AI Message (Tutor receives if live sharing enabled)
export const onNewAIMessage = (callback: (message: NewAIMessageEvent) => void): void => {
  tutorSessionSocket?.on('newAIMessage', callback);
};

export const offNewAIMessage = (): void => {
  tutorSessionSocket?.off('newAIMessage');
};

// Consent Changed
export const onConsentChanged = (callback: (data: ConsentChangedEvent) => void): void => {
  tutorSessionSocket?.on('consentChanged', callback);
};

export const offConsentChanged = (): void => {
  tutorSessionSocket?.off('consentChanged');
};

// Session Status Changed
export const onSessionStatusChanged = (callback: (data: SessionStatusChangedEvent) => void): void => {
  tutorSessionSocket?.on('sessionStatusChanged', callback);
};

export const offSessionStatusChanged = (): void => {
  tutorSessionSocket?.off('sessionStatusChanged');
};

// Participant Joined
export const onParticipantJoined = (callback: (data: TutorSessionParticipantEvent) => void): void => {
  tutorSessionSocket?.on('participantJoined', callback);
};

export const offParticipantJoined = (): void => {
  tutorSessionSocket?.off('participantJoined');
};

// Participant Left
export const onParticipantLeft = (callback: (data: TutorSessionParticipantEvent) => void): void => {
  tutorSessionSocket?.on('participantLeft', callback);
};

export const offParticipantLeft = (): void => {
  tutorSessionSocket?.off('participantLeft');
};

// Chat Message (Tutor-Student)
export const onChatMessage = (callback: (message: TutorStudentChatMessage) => void): void => {
  tutorSessionSocket?.on('chatMessage', callback);
};

export const offChatMessage = (): void => {
  tutorSessionSocket?.off('chatMessage');
};

// Whiteboard Update
export const onWhiteboardUpdate = (callback: (data: WhiteboardUpdateEvent) => void): void => {
  tutorSessionSocket?.on('whiteboardUpdate', callback);
};

export const offWhiteboardUpdate = (): void => {
  tutorSessionSocket?.off('whiteboardUpdate');
};

// Whiteboard Cursor
export const onWhiteboardCursor = (callback: (data: WhiteboardCursorEvent) => void): void => {
  tutorSessionSocket?.on('whiteboardCursor', callback);
};

export const offWhiteboardCursor = (): void => {
  tutorSessionSocket?.off('whiteboardCursor');
};

// User Typing
export const onUserTyping = (callback: (data: TutorSessionTypingEvent) => void): void => {
  tutorSessionSocket?.on('userTyping', callback);
};

export const offUserTyping = (): void => {
  tutorSessionSocket?.off('userTyping');
};

// Call Signal
export const onCallSignal = (callback: (data: TutorSessionCallSignal) => void): void => {
  tutorSessionSocket?.on('callSignal', callback);
};

export const offCallSignal = (): void => {
  tutorSessionSocket?.off('callSignal');
};

// New Help Request (Tutor notification)
export const onNewHelpRequest = (callback: (request: NewHelpRequestEvent) => void): void => {
  tutorSessionSocket?.on('newHelpRequest', callback);
};

export const offNewHelpRequest = (): void => {
  tutorSessionSocket?.off('newHelpRequest');
};

// Chat History
export const onChatHistory = (callback: (data: { sessionId: string; messages: any[] }) => void): void => {
  tutorSessionSocket?.on('chatHistory', callback);
};

export const offChatHistory = (): void => {
  tutorSessionSocket?.off('chatHistory');
};

// Whiteboard Data
export const onWhiteboardData = (callback: (data: any) => void): void => {
  tutorSessionSocket?.on('whiteboardData', callback);
};

export const offWhiteboardData = (): void => {
  tutorSessionSocket?.off('whiteboardData');
};

// Error event
export const onError = (callback: (error: { message: string }) => void): void => {
  tutorSessionSocket?.on('error', callback);
};

export const offError = (): void => {
  tutorSessionSocket?.off('error');
};

// ============================================
// Export default
// ============================================

export default {
  connectTutorSessionSocket,
  disconnectTutorSessionSocket,
  getTutorSessionSocket,
  onTutorSessionSocketConnect,
  // Client → Server
  joinSession,
  leaveSession,
  subscribeToAISession,
  sendChatMessage,
  sendWhiteboardUpdate,
  sendWhiteboardCursor,
  getChatHistory,
  getWhiteboardData,
  sendTypingIndicator,
  sendCallSignal,
  // Server → Client
  onConnected,
  offConnected,
  onTutorAccepted,
  offTutorAccepted,
  onNewAIMessage,
  offNewAIMessage,
  onConsentChanged,
  offConsentChanged,
  onSessionStatusChanged,
  offSessionStatusChanged,
  onParticipantJoined,
  offParticipantJoined,
  onParticipantLeft,
  offParticipantLeft,
  onChatMessage,
  offChatMessage,
  onChatHistory,
  offChatHistory,
  onWhiteboardUpdate,
  offWhiteboardUpdate,
  onWhiteboardData,
  offWhiteboardData,
  onWhiteboardCursor,
  offWhiteboardCursor,
  onUserTyping,
  offUserTyping,
  onCallSignal,
  offCallSignal,
  onNewHelpRequest,
  offNewHelpRequest,
  onError,
  offError,
};

