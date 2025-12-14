import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  getSocket,
  onSocketConnect,
  initiateCall as socketInitiateCall,
  acceptCall as socketAcceptCall,
  rejectCall as socketRejectCall,
  endCall as socketEndCall,
  sendMuteStatus,
} from '../services/socket';
import {
  CallState,
  CallStatus,
  CallType,
  IncomingCallEvent,
  CallAcceptedEvent,
  CallRejectedEvent,
  CallEndedEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ParticipantMutedEvent,
} from '../types';
import { useAuth } from './AuthContext';

const DEFAULT_CALL_STATE: CallState = {
  status: CallStatus.IDLE,
  conversationId: null,
  callType: null,
  callerId: null,
  callerName: null,
  participants: [],
  startTime: null,
  isMuted: false,
  isDeafened: false,
};

const CALL_TIMEOUT = 30000;

interface CallContextType {
  callState: CallState;
  incomingCall: IncomingCallEvent | null;
  initiateCall: (conversationId: string, callType?: CallType) => void;
  acceptCall: () => void;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  callDuration: number;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>(DEFAULT_CALL_STATE);
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Refs to avoid stale closures
  const callStateRef = useRef(callState);
  const incomingCallRef = useRef(incomingCall);
  const userRef = useRef(user);
  const localStreamRef = useRef(localStream);

  // Debounce refs to prevent duplicate handling
  const isHandlingIncomingRef = useRef(false);
  const handledCallIdsRef = useRef<Set<string>>(new Set());
  
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const incomingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Keep refs in sync
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const clearAllTimeouts = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, []);

  const playRingtone = useCallback(() => {
    if (!ringtoneRef.current) {
      ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
      ringtoneRef.current.loop = true;
    }
    ringtoneRef.current.play().catch(() => {
      console.log('[Call] Could not play ringtone');
    });
  }, []);

  const resetCallState = useCallback(() => {
    console.log('[Call] Resetting call state');
    clearAllTimeouts();
    stopRingtone();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    setCallState(DEFAULT_CALL_STATE);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setCallDuration(0);
    isHandlingIncomingRef.current = false;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, [clearAllTimeouts, stopRingtone]);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setCallDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // Initiate a call
  const initiateCall = useCallback((conversationId: string, callType: CallType = CallType.AUDIO) => {
    const currentStatus = callStateRef.current.status;
    if (currentStatus !== CallStatus.IDLE) {
      toast.error('You are already in a call');
      return;
    }

    console.log('[Call] Initiating call to:', conversationId);

    clearAllTimeouts();

    setCallState({
      ...DEFAULT_CALL_STATE,
      status: CallStatus.INITIATING,
      conversationId,
      callType,
      callerId: userRef.current?.id || null,
      callerName: userRef.current?.name || null,
    });

    socketInitiateCall({ conversationId, callType });

    // Timeout for no answer
    callTimeoutRef.current = setTimeout(() => {
      const status = callStateRef.current.status;
      if (status === CallStatus.INITIATING || status === CallStatus.RINGING) {
        console.log('[Call] Call timeout - no answer');
        toast.error('No answer');
        resetCallState();
      }
    }, CALL_TIMEOUT);
  }, [clearAllTimeouts, resetCallState]);

  // Accept incoming call
  const acceptCall = useCallback(() => {
    const currentIncoming = incomingCallRef.current;
    if (!currentIncoming) {
      console.error('[Call] No incoming call to accept');
      return;
    }

    console.log('[Call] Accepting call:', currentIncoming.conversationId);
    
    clearAllTimeouts();
    stopRingtone();

    // Update state BEFORE emitting socket event
    setCallState({
      ...DEFAULT_CALL_STATE,
      status: CallStatus.CONNECTING,
      conversationId: currentIncoming.conversationId,
      callType: currentIncoming.callType,
      callerId: currentIncoming.callerId,
      callerName: currentIncoming.callerName,
    });

    setIncomingCall(null);
    isHandlingIncomingRef.current = false;

    // Emit accept to backend
    socketAcceptCall(currentIncoming.conversationId);
    
    toast.success('Call accepted - connecting...');
  }, [clearAllTimeouts, stopRingtone]);

  // Reject incoming call
  const rejectCall = useCallback((reason?: string) => {
    const currentIncoming = incomingCallRef.current;
    if (!currentIncoming) return;

    console.log('[Call] Rejecting call:', currentIncoming.conversationId);
    
    clearAllTimeouts();
    stopRingtone();

    socketRejectCall(currentIncoming.conversationId, reason);
    setIncomingCall(null);
    isHandlingIncomingRef.current = false;
    resetCallState();
  }, [clearAllTimeouts, stopRingtone, resetCallState]);

  // End active call
  const endCall = useCallback(() => {
    const convId = callStateRef.current.conversationId;
    if (convId) {
      console.log('[Call] Ending call:', convId);
      socketEndCall(convId);
    }
    resetCallState();
  }, [resetCallState]);

  const toggleMute = useCallback(() => {
    setCallState(prev => {
      const newMutedState = !prev.isMuted;
      if (prev.conversationId) {
        sendMuteStatus(prev.conversationId, newMutedState);
      }
      return { ...prev, isMuted: newMutedState };
    });
  }, []);

  const toggleDeafen = useCallback(() => {
    setCallState(prev => ({ ...prev, isDeafened: !prev.isDeafened }));
  }, []);

  // Update to CONNECTED when remote stream is available
  useEffect(() => {
    if (callState.status === CallStatus.CONNECTING && remoteStream) {
      console.log('[Call] Remote stream received - call connected!');
      setCallState(prev => ({
        ...prev,
        status: CallStatus.CONNECTED,
        startTime: new Date(),
      }));
      startDurationTimer();
    }
  }, [callState.status, remoteStream, startDurationTimer]);

  // Set up socket listeners
  useEffect(() => {
    const handleIncomingCall = (data: IncomingCallEvent) => {
      console.log('[Call] Incoming call event:', data);

      // Debounce - prevent handling the same call multiple times
      if (isHandlingIncomingRef.current) {
        console.log('[Call] Already handling an incoming call, ignoring');
        return;
      }

      // Check if we already handled this call ID recently
      if (handledCallIdsRef.current.has(data.conversationId)) {
        console.log('[Call] Already handled this call ID, ignoring');
        return;
      }

      // Check current state
      const currentStatus = callStateRef.current.status;
      if (currentStatus !== CallStatus.IDLE) {
        console.log('[Call] Already in a call, auto-rejecting');
        socketRejectCall(data.conversationId, 'busy');
        return;
      }

      // Don't show if we initiated this call
      if (data.callerId === userRef.current?.id) {
        console.log('[Call] This is our own call, ignoring');
        return;
      }

      // Mark as handling
      isHandlingIncomingRef.current = true;
      handledCallIdsRef.current.add(data.conversationId);

      // Clear after 5 seconds
      setTimeout(() => {
        handledCallIdsRef.current.delete(data.conversationId);
      }, 5000);

      console.log('[Call] Showing incoming call UI');
      setIncomingCall(data);
      playRingtone();

      // Clear any existing timeout
      if (incomingTimeoutRef.current) {
        clearTimeout(incomingTimeoutRef.current);
      }

      // Auto-reject after timeout
      incomingTimeoutRef.current = setTimeout(() => {
        const currentIncoming = incomingCallRef.current;
        if (currentIncoming?.conversationId === data.conversationId) {
          console.log('[Call] Incoming call timeout - auto rejecting');
          socketRejectCall(data.conversationId, 'no_answer');
          setIncomingCall(null);
          stopRingtone();
          isHandlingIncomingRef.current = false;
        }
      }, CALL_TIMEOUT);
    };

    const handleCallAccepted = (data: CallAcceptedEvent) => {
      console.log('[Call] 🟢 RECEIVED callAccepted event:', data);
      console.log('[Call] Current status:', callStateRef.current.status);

      clearAllTimeouts();

      // If we were the caller (INITIATING), transition to CONNECTING
      const currentStatus = callStateRef.current.status;
      if (currentStatus === CallStatus.INITIATING || currentStatus === CallStatus.RINGING) {
        console.log('[Call] We initiated, transitioning to CONNECTING');
        setCallState(prev => ({
          ...prev,
          status: CallStatus.CONNECTING,
          participants: [
            ...prev.participants,
            {
              id: data.accepterId,
              name: data.accepterName,
              isMuted: false,
              isDeafened: false,
            },
          ],
        }));
        toast.success(`${data.accepterName} joined the call`);
      }
    };

    const handleCallRejected = (data: CallRejectedEvent) => {
      console.log('[Call] Call rejected:', data.reason);
      clearAllTimeouts();

      // Handle different rejection reasons
      let message: string;
      let isCustomMessage = false;

      switch (data.reason) {
        case 'busy':
          message = 'User is busy';
          break;
        case 'no_answer':
          message = 'No answer';
          break;
        case 'declined':
          message = 'Call declined';
          break;
        default:
          // Custom message from the receiver
          if (data.reason && data.reason.length > 0) {
            message = data.reason;
            isCustomMessage = true;
          } else {
            message = 'Call declined';
          }
      }

      // Show toast with custom styling for messages
      if (isCustomMessage) {
        toast((t) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">Call declined</span>
            <span className="text-sm text-gray-600 mt-1">"{message}"</span>
          </div>
        ), {
          icon: '📞',
          duration: 5000,
        });
      } else {
        toast.error(message);
      }

      resetCallState();
    };

    const handleCallEnded = (data: CallEndedEvent) => {
      console.log('[Call] ⚫ RECEIVED callEnded event:', data);
      console.log('[Call] Current status when ended:', callStateRef.current.status);

      if (data.duration) {
        const minutes = Math.floor(data.duration / 60);
        const seconds = data.duration % 60;
        toast(`Call ended (${minutes}:${seconds.toString().padStart(2, '0')})`);
      } else {
        toast('Call ended');
      }

      resetCallState();
    };

    const handleParticipantJoined = (data: ParticipantJoinedEvent) => {
      console.log('[Call] Participant joined:', data.participant);
      setCallState(prev => ({
        ...prev,
        participants: [...prev.participants, data.participant],
      }));
      toast.success(`${data.participant.name} joined`);
    };

    const handleParticipantLeft = (data: ParticipantLeftEvent) => {
      console.log('[Call] Participant left:', data.participantId);
      setCallState(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.id !== data.participantId),
      }));
    };

    const handleParticipantMuted = (data: ParticipantMutedEvent) => {
      setCallState(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.id === data.participantId ? { ...p, isMuted: data.isMuted } : p
        ),
      }));
    };

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket) return;

      // Remove ALL existing listeners first
      socket.off('incomingCall');
      socket.off('callAccepted');
      socket.off('callRejected');
      socket.off('callEnded');
      socket.off('participantJoined');
      socket.off('participantLeft');
      socket.off('participantMuted');

      console.log('[Call] Setting up call event listeners');

      socket.on('incomingCall', handleIncomingCall);
      socket.on('callAccepted', handleCallAccepted);
      socket.on('callRejected', handleCallRejected);
      socket.on('callEnded', handleCallEnded);
      socket.on('participantJoined', handleParticipantJoined);
      socket.on('participantLeft', handleParticipantLeft);
      socket.on('participantMuted', handleParticipantMuted);
    };

    setupListeners();
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('incomingCall');
        socket.off('callAccepted');
        socket.off('callRejected');
        socket.off('callEnded');
        socket.off('participantJoined');
        socket.off('participantLeft');
        socket.off('participantMuted');
      }
      unsubscribe();
    };
  }, [playRingtone, stopRingtone, resetCallState, clearAllTimeouts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      stopRingtone();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [clearAllTimeouts, stopRingtone]);

  return (
    <CallContext.Provider
      value={{
        callState,
        incomingCall,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleDeafen,
        localStream,
        remoteStream,
        setLocalStream,
        setRemoteStream,
        callDuration,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export default CallContext;


