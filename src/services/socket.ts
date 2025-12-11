import { io, Socket } from 'socket.io-client';
import { 
  Message, 
  UserTypingEvent, 
  NewAssignmentEvent, 
  StatusChangeEvent, 
  TypingEvent,
  NewPendingConversationEvent,
  ProcessingStatusEvent,
  TutorAssignedEvent,
  AllTutorsBusyEvent,
  CallType,
  CallInitiateEvent,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallRejectedEvent,
  CallEndedEvent,
  WebRTCOfferEvent,
  WebRTCAnswerEvent,
  WebRTCIceCandidateEvent,
  InviteToCallEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ParticipantMutedEvent
} from '../types';

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

// New pending conversation - for notifying available tutors
export const onNewPendingConversation = (callback: (data: NewPendingConversationEvent) => void): void => {
  socket?.on('newPendingConversation', callback);
};

export const offNewPendingConversation = (): void => {
  socket?.off('newPendingConversation');
};

// ============================================
// Student Events (Processing Status)
// ============================================

// Processing status - shows student the progress of their question
export const onProcessingStatus = (callback: (data: ProcessingStatusEvent) => void): void => {
  socket?.on('processingStatus', callback);
};

export const offProcessingStatus = (): void => {
  socket?.off('processingStatus');
};

// Tutor assigned - when a tutor accepts the conversation
export const onTutorAssigned = (callback: (data: TutorAssignedEvent) => void): void => {
  socket?.on('tutorAssigned', callback);
};

export const offTutorAssigned = (): void => {
  socket?.off('tutorAssigned');
};

// All tutors busy - when no tutors are available
export const onAllTutorsBusy = (callback: (data: AllTutorsBusyEvent) => void): void => {
  socket?.on('allTutorsBusy', callback);
};

export const offAllTutorsBusy = (): void => {
  socket?.off('allTutorsBusy');
};

// ============================================
// Tutor Actions (Accept/Reject via Socket)
// ============================================

// Tutor accepts a conversation
export const acceptConversation = (conversationId: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Accepting conversation:', conversationId);
    socket.emit('acceptConversation', { conversationId });
  }
};

// Tutor rejects a conversation
export const rejectConversation = (conversationId: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Rejecting conversation:', conversationId);
    socket.emit('rejectConversation', { conversationId });
  }
};

// ============================================
// Audio/Video Call Functions
// ============================================

// Initiate a call
export const initiateCall = (data: CallInitiateEvent): void => {
  if (socket?.connected) {
    console.log('[Socket] Initiating call:', data);
    socket.emit('callInitiate', data);
  } else {
    console.error('[Socket] Cannot initiate call - socket not connected');
  }
};

// Accept an incoming call
export const acceptCall = (conversationId: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Accepting call:', conversationId);
    socket.emit('callAccept', { conversationId });
  }
};

// Reject an incoming call
export const rejectCall = (conversationId: string, reason?: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Rejecting call:', conversationId);
    socket.emit('callReject', { conversationId, reason });
  }
};

// End an active call
export const endCall = (conversationId: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Ending call:', conversationId);
    socket.emit('callEnd', { conversationId });
  }
};

// Send WebRTC offer
export const sendWebRTCOffer = (conversationId: string, offer: RTCSessionDescriptionInit, toUserId?: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Sending WebRTC offer');
    socket.emit('webrtcOffer', { conversationId, offer, toUserId });
  }
};

// Send WebRTC answer
export const sendWebRTCAnswer = (conversationId: string, answer: RTCSessionDescriptionInit, toUserId?: string): void => {
  if (socket?.connected) {
    console.log('[Socket] Sending WebRTC answer');
    socket.emit('webrtcAnswer', { conversationId, answer, toUserId });
  }
};

// Send ICE candidate
export const sendICECandidate = (conversationId: string, candidate: RTCIceCandidateInit, toUserId?: string): void => {
  if (socket?.connected) {
    socket.emit('webrtcIceCandidate', { conversationId, candidate, toUserId });
  }
};

// Invite another tutor to call (for group calls)
export const inviteToCall = (data: InviteToCallEvent): void => {
  if (socket?.connected) {
    console.log('[Socket] Inviting tutor to call:', data);
    socket.emit('inviteToCall', data);
  }
};

// Toggle mute status
export const sendMuteStatus = (conversationId: string, isMuted: boolean): void => {
  if (socket?.connected) {
    socket.emit('participantMuted', { conversationId, isMuted });
  }
};

// Call event listeners
export const onIncomingCall = (callback: (data: IncomingCallEvent) => void): void => {
  socket?.on('incomingCall', callback);
};

export const offIncomingCall = (): void => {
  socket?.off('incomingCall');
};

export const onCallAccepted = (callback: (data: CallAcceptedEvent) => void): void => {
  socket?.on('callAccepted', callback);
};

export const offCallAccepted = (): void => {
  socket?.off('callAccepted');
};

export const onCallRejected = (callback: (data: CallRejectedEvent) => void): void => {
  socket?.on('callRejected', callback);
};

export const offCallRejected = (): void => {
  socket?.off('callRejected');
};

export const onCallEnded = (callback: (data: CallEndedEvent) => void): void => {
  socket?.on('callEnded', callback);
};

export const offCallEnded = (): void => {
  socket?.off('callEnded');
};

export const onWebRTCOffer = (callback: (data: WebRTCOfferEvent) => void): void => {
  socket?.on('webrtcOffer', callback);
};

export const offWebRTCOffer = (): void => {
  socket?.off('webrtcOffer');
};

export const onWebRTCAnswer = (callback: (data: WebRTCAnswerEvent) => void): void => {
  socket?.on('webrtcAnswer', callback);
};

export const offWebRTCAnswer = (): void => {
  socket?.off('webrtcAnswer');
};

export const onWebRTCIceCandidate = (callback: (data: WebRTCIceCandidateEvent) => void): void => {
  socket?.on('webrtcIceCandidate', callback);
};

export const offWebRTCIceCandidate = (): void => {
  socket?.off('webrtcIceCandidate');
};

export const onParticipantJoined = (callback: (data: ParticipantJoinedEvent) => void): void => {
  socket?.on('participantJoined', callback);
};

export const offParticipantJoined = (): void => {
  socket?.off('participantJoined');
};

export const onParticipantLeft = (callback: (data: ParticipantLeftEvent) => void): void => {
  socket?.on('participantLeft', callback);
};

export const offParticipantLeft = (): void => {
  socket?.off('participantLeft');
};

export const onParticipantMuted = (callback: (data: ParticipantMutedEvent) => void): void => {
  socket?.on('participantMuted', callback);
};

export const offParticipantMuted = (): void => {
  socket?.off('participantMuted');
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
  onNewPendingConversation,
  offNewPendingConversation,
  // Student events
  onProcessingStatus,
  offProcessingStatus,
  onTutorAssigned,
  offTutorAssigned,
  onAllTutorsBusy,
  offAllTutorsBusy,
  // Tutor actions
  acceptConversation,
  rejectConversation,
  // Call functions
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  sendWebRTCOffer,
  sendWebRTCAnswer,
  sendICECandidate,
  inviteToCall,
  sendMuteStatus,
  // Call listeners
  onIncomingCall,
  offIncomingCall,
  onCallAccepted,
  offCallAccepted,
  onCallRejected,
  offCallRejected,
  onCallEnded,
  offCallEnded,
  onWebRTCOffer,
  offWebRTCOffer,
  onWebRTCAnswer,
  offWebRTCAnswer,
  onWebRTCIceCandidate,
  offWebRTCIceCandidate,
  onParticipantJoined,
  offParticipantJoined,
  onParticipantLeft,
  offParticipantLeft,
  onParticipantMuted,
  offParticipantMuted,
};

