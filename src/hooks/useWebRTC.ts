import { useCallback, useRef, useState, useEffect } from 'react';
import {
  getSocket,
  sendWebRTCOffer,
  sendWebRTCAnswer,
  sendICECandidate,
  onSocketConnect,
} from '../services/socket';
import {
  WebRTCOfferEvent,
  WebRTCAnswerEvent,
  WebRTCIceCandidateEvent,
} from '../types';

// ICE servers configuration
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

interface UseWebRTCOptions {
  conversationId: string;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnecting: boolean;
  isConnected: boolean;
  connectionState: RTCPeerConnectionState | null;
  startCall: (isInitiator: boolean) => Promise<void>;
  endCall: () => void;
  toggleMute: () => boolean;
  toggleDeafen: () => boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

export function useWebRTC({
  conversationId,
  onRemoteStream,
  onConnectionStateChange,
  onError,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Use refs to prevent stale closures and unnecessary re-renders
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isInitiatorRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  const callActiveRef = useRef(false);
  
  // Keep refs for callbacks to avoid stale closures
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    onRemoteStreamRef.current = onRemoteStream;
  }, [onRemoteStream]);

  useEffect(() => {
    onConnectionStateChangeRef.current = onConnectionStateChange;
  }, [onConnectionStateChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Cleanup function - only called on unmount or explicit end
  const cleanup = useCallback((reason?: string) => {
    if (!callActiveRef.current && !peerConnectionRef.current && !localStreamRef.current) {
      return; // Nothing to clean up
    }
    
    console.log('[WebRTC] Cleaning up...', reason || '');
    callActiveRef.current = false;
    
    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsConnecting(false);
    setIsConnected(false);
    setConnectionState(null);
    pendingCandidatesRef.current = [];
  }, []);

  // Get local media stream
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    console.log('[WebRTC] Requesting microphone access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      console.log('[WebRTC] Got local stream');
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local stream:', error);
      throw error;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((): RTCPeerConnection => {
    console.log('[WebRTC] Creating peer connection...');
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        sendICECandidate(conversationIdRef.current, event.candidate.toJSON());
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      onConnectionStateChangeRef.current?.(pc.connectionState);

      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        setIsConnected(true);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setIsConnected(false);
        setIsConnecting(false);
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (event.streams?.[0]) {
        setRemoteStream(event.streams[0]);
        onRemoteStreamRef.current?.(event.streams[0]);
      }
    };

    pc.onnegotiationneeded = async () => {
      console.log('[WebRTC] Negotiation needed, isInitiator:', isInitiatorRef.current);
      if (isInitiatorRef.current && pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log('[WebRTC] Sending offer');
          sendWebRTCOffer(conversationIdRef.current, pc.localDescription!);
        } catch (error) {
          console.error('[WebRTC] Negotiation error:', error);
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  // Start the call
  const startCall = useCallback(async (isInitiator: boolean): Promise<void> => {
    if (callActiveRef.current) {
      console.log('[WebRTC] Call already active, skipping start');
      return;
    }

    console.log('[WebRTC] Starting call, isInitiator:', isInitiator);
    callActiveRef.current = true;
    setIsConnecting(true);
    isInitiatorRef.current = isInitiator;

    try {
      const stream = await getLocalStream();
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        console.log('[WebRTC] Adding local track:', track.kind);
        pc.addTrack(track, stream);
      });

      if (isInitiator) {
        console.log('[WebRTC] Creating offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[WebRTC] Sending offer');
        sendWebRTCOffer(conversationIdRef.current, pc.localDescription!);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to start call:', error);
      callActiveRef.current = false;
      cleanup('start failed');
      throw error;
    }
  }, [getLocalStream, createPeerConnection, cleanup]);

  // End the call
  const endCall = useCallback(() => {
    console.log('[WebRTC] Ending call');
    cleanup('user ended');
  }, [cleanup]);

  // Toggle mute
  const toggleMute = useCallback((): boolean => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;
        setIsMuted(newMutedState);
        return newMutedState;
      }
    }
    return isMuted;
  }, [isMuted]);

  // Toggle deafen
  const toggleDeafen = useCallback((): boolean => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);
    return newDeafenedState;
  }, [isDeafened]);

  // Set up socket listeners - use stable refs
  useEffect(() => {
    const handleOffer = async (data: WebRTCOfferEvent) => {
      if (data.conversationId !== conversationIdRef.current) return;

      console.log('[WebRTC] Received offer');
      try {
        let pc = peerConnectionRef.current;

        if (!pc) {
          console.log('[WebRTC] No peer connection, creating one for offer');
          await getLocalStream();
          pc = createPeerConnection();

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
              pc!.addTrack(track, localStreamRef.current!);
            });
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Process pending candidates
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];

        console.log('[WebRTC] Creating answer...');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Sending answer');
        sendWebRTCAnswer(conversationIdRef.current, pc.localDescription!);
      } catch (error) {
        console.error('[WebRTC] Failed to handle offer:', error);
        onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to handle offer'));
      }
    };

    const handleAnswer = async (data: WebRTCAnswerEvent) => {
      if (data.conversationId !== conversationIdRef.current) return;

      console.log('[WebRTC] Received answer');
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('[WebRTC] No peer connection for answer');
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
      } catch (error) {
        console.error('[WebRTC] Failed to handle answer:', error);
      }
    };

    const handleIceCandidate = async (data: WebRTCIceCandidateEvent) => {
      if (data.conversationId !== conversationIdRef.current) return;

      console.log('[WebRTC] Received ICE candidate');
      const pc = peerConnectionRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidatesRef.current.push(data.candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('[WebRTC] Failed to add ICE candidate:', error);
      }
    };

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket) return;

      // Remove old listeners first
      socket.off('webrtcOffer');
      socket.off('webrtcAnswer');
      socket.off('webrtcIceCandidate');

      socket.on('webrtcOffer', handleOffer);
      socket.on('webrtcAnswer', handleAnswer);
      socket.on('webrtcIceCandidate', handleIceCandidate);
    };

    setupListeners();
    const unsubscribe = onSocketConnect(setupListeners);

    // Only cleanup on TRUE unmount
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('webrtcOffer');
        socket.off('webrtcAnswer');
        socket.off('webrtcIceCandidate');
      }
      unsubscribe();
    };
  }, [getLocalStream, createPeerConnection]); // Minimal dependencies

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      cleanup('unmount');
    };
  }, []); // Empty deps = only on unmount

  return {
    localStream,
    remoteStream,
    isConnecting,
    isConnected,
    connectionState,
    startCall,
    endCall,
    toggleMute,
    toggleDeafen,
    isMuted,
    isDeafened,
  };
}

export default useWebRTC;

