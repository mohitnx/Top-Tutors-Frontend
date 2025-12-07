import { io, Socket } from 'socket.io-client';
import { Message, UserTypingEvent, NewAssignmentEvent, StatusChangeEvent, TypingEvent } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;
let connectionListeners: Array<() => void> = [];

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  socket = io(`${WS_URL}/messages`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected, id:', socket?.id);
    // Notify all connection listeners
    connectionListeners.forEach(listener => listener());
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  // DEBUG: Log ALL incoming events to see what backend is sending
  socket.onAny((eventName, ...args) => {
    console.log('[Socket] Received event:', eventName, args);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    // Notify all connection listeners on reconnect too
    connectionListeners.forEach(listener => listener());
  });

  return socket;
};

// Subscribe to connection events
export const onSocketConnect = (callback: () => void): (() => void) => {
  connectionListeners.push(callback);
  // If already connected, call immediately
  if (socket?.connected) {
    callback();
  }
  // Return unsubscribe function
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== callback);
  };
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

// Helper functions for socket events
export const joinConversation = (conversationId: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Joining conversation:', conversationId);
    socket.emit('joinConversation', conversationId);
  } else {
    console.warn('[Socket] Cannot join conversation - socket not connected');
  }
};

export const leaveConversation = (conversationId: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Leaving conversation:', conversationId);
    socket.emit('leaveConversation', conversationId);
  }
};

export const sendTypingIndicator = (data: TypingEvent): void => {
  if (socket?.connected) {
    socket.emit('typing', data);
  }
};

// Event listeners
export const onNewMessage = (callback: (message: Message) => void): void => {
  socket?.on('newMessage', callback);
};

export const offNewMessage = (): void => {
  socket?.off('newMessage');
};

export const onUserTyping = (callback: (data: UserTypingEvent) => void): void => {
  socket?.on('userTyping', callback);
};

export const offUserTyping = (): void => {
  socket?.off('userTyping');
};

export const onNewAssignment = (callback: (data: NewAssignmentEvent) => void): void => {
  socket?.on('newAssignment', callback);
};

export const offNewAssignment = (): void => {
  socket?.off('newAssignment');
};

export const onStatusChange = (callback: (data: StatusChangeEvent) => void): void => {
  socket?.on('statusChange', callback);
};

export const offStatusChange = (): void => {
  socket?.off('statusChange');
};

export default {
  connectSocket,
  disconnectSocket,
  getSocket,
  onSocketConnect,
  joinConversation,
  leaveConversation,
  sendTypingIndicator,
  onNewMessage,
  offNewMessage,
  onUserTyping,
  offUserTyping,
  onNewAssignment,
  offNewAssignment,
  onStatusChange,
  offStatusChange,
};

