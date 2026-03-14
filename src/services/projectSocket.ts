import { io, Socket } from 'socket.io-client';
import { ProjectStreamChunk, ProjectResourceResponse } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let projectSocket: Socket | null = null;
let connectionListeners: Array<() => void> = [];

// ============================================
// Connection Management
// ============================================

export const connectProjectSocket = (token: string): Socket => {
  if (projectSocket?.connected) {
    return projectSocket;
  }

  if (projectSocket) {
    projectSocket.disconnect();
  }

  projectSocket = io(`${WS_URL}/projects`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  projectSocket.on('connect', () => {
    console.log('[ProjectSocket] Connected, id:', projectSocket?.id);
    connectionListeners.forEach((listener) => listener());
  });

  projectSocket.on('disconnect', (reason) => {
    console.log('[ProjectSocket] Disconnected:', reason);
  });

  projectSocket.on('connect_error', (error) => {
    console.error('[ProjectSocket] Connection error:', error.message);
  });

  projectSocket.onAny((eventName, ...args) => {
    console.log('[ProjectSocket] Received event:', eventName, args);
  });

  projectSocket.on('reconnect', (attemptNumber: number) => {
    console.log('[ProjectSocket] Reconnected after', attemptNumber, 'attempts');
    connectionListeners.forEach((listener) => listener());
  });

  return projectSocket;
};

export const disconnectProjectSocket = (): void => {
  if (projectSocket) {
    projectSocket.disconnect();
    projectSocket = null;
  }
};

export const getProjectSocket = (): Socket | null => projectSocket;

export const onProjectSocketConnect = (callback: () => void): (() => void) => {
  connectionListeners.push(callback);
  if (projectSocket?.connected) {
    callback();
  }
  return () => {
    connectionListeners = connectionListeners.filter((l) => l !== callback);
  };
};

// ============================================
// Room Management
// ============================================

export const joinProject = (projectId: string): void => {
  if (projectSocket?.connected) {
    console.log('[ProjectSocket] Joining project:', projectId);
    projectSocket.emit('joinProject', projectId);
  }
};

export const leaveProject = (projectId: string): void => {
  if (projectSocket?.connected) {
    console.log('[ProjectSocket] Leaving project:', projectId);
    projectSocket.emit('leaveProject', projectId);
  }
};

export const joinProjectSession = (sessionId: string): void => {
  if (projectSocket?.connected) {
    console.log('[ProjectSocket] Joining session:', sessionId);
    projectSocket.emit('joinSession', sessionId);
  }
};

export const leaveProjectSession = (sessionId: string): void => {
  if (projectSocket?.connected) {
    console.log('[ProjectSocket] Leaving session:', sessionId);
    projectSocket.emit('leaveSession', sessionId);
  }
};

// ============================================
// Stream Event Listeners
// ============================================

export const onProjectStreamChunk = (callback: (chunk: ProjectStreamChunk) => void): void => {
  projectSocket?.on('streamChunk', callback);
};

export const offProjectStreamChunk = (callback?: (chunk: ProjectStreamChunk) => void): void => {
  if (callback) {
    projectSocket?.off('streamChunk', callback);
  } else {
    projectSocket?.off('streamChunk');
  }
};

// ============================================
// Council Event Listeners
// ============================================

export const onProjectCouncilStatus = (callback: (data: any) => void): void => {
  projectSocket?.on('councilStatus', callback);
};

export const offProjectCouncilStatus = (callback?: (data: any) => void): void => {
  if (callback) {
    projectSocket?.off('councilStatus', callback);
  } else {
    projectSocket?.off('councilStatus');
  }
};

export const onProjectCouncilMemberComplete = (callback: (data: any) => void): void => {
  projectSocket?.on('councilMemberComplete', callback);
};

export const offProjectCouncilMemberComplete = (callback?: (data: any) => void): void => {
  if (callback) {
    projectSocket?.off('councilMemberComplete', callback);
  } else {
    projectSocket?.off('councilMemberComplete');
  }
};

export const onProjectCouncilSynthesisStart = (callback: (data: any) => void): void => {
  projectSocket?.on('councilSynthesisStart', callback);
};

export const offProjectCouncilSynthesisStart = (callback?: (data: any) => void): void => {
  if (callback) {
    projectSocket?.off('councilSynthesisStart', callback);
  } else {
    projectSocket?.off('councilSynthesisStart');
  }
};

// ============================================
// Resource Event Listeners
// ============================================

export const onResourceAdded = (
  callback: (data: { projectId: string; resource: ProjectResourceResponse }) => void
): void => {
  projectSocket?.on('resourceAdded', callback);
};

export const offResourceAdded = (
  callback?: (data: { projectId: string; resource: ProjectResourceResponse }) => void
): void => {
  if (callback) {
    projectSocket?.off('resourceAdded', callback);
  } else {
    projectSocket?.off('resourceAdded');
  }
};

export const onResourceDeleted = (
  callback: (data: { projectId: string; resourceId: string }) => void
): void => {
  projectSocket?.on('resourceDeleted', callback);
};

export const offResourceDeleted = (
  callback?: (data: { projectId: string; resourceId: string }) => void
): void => {
  if (callback) {
    projectSocket?.off('resourceDeleted', callback);
  } else {
    projectSocket?.off('resourceDeleted');
  }
};

export default {
  connectProjectSocket,
  disconnectProjectSocket,
  getProjectSocket,
  onProjectSocketConnect,
  joinProject,
  leaveProject,
  joinProjectSession,
  leaveProjectSession,
  onProjectStreamChunk,
  offProjectStreamChunk,
  onResourceAdded,
  offResourceAdded,
  onResourceDeleted,
  offResourceDeleted,
};
