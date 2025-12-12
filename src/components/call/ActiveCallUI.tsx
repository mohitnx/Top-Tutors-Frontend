import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useCall } from '../../contexts/CallContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { CallStatus } from '../../types';

interface ActiveCallUIProps {
  conversationId: string;
  otherPartyName?: string;
}

export function ActiveCallUI({ conversationId, otherPartyName }: ActiveCallUIProps) {
  const { user } = useAuth();
  const {
    callState,
    endCall,
    toggleMute,
    toggleDeafen,
    setLocalStream,
    setRemoteStream,
    callDuration,
  } = useCall();

  const [isMinimized, setIsMinimized] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const webrtcStartedRef = useRef(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleRemoteStream = useCallback((stream: MediaStream) => {
    console.log('[ActiveCallUI] Remote stream received!');
    setRemoteStream(stream);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(e => console.error('[ActiveCallUI] Audio play error:', e));
    }
  }, [setRemoteStream]);

  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState) => {
    console.log('[ActiveCallUI] Connection state:', state);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('[ActiveCallUI] WebRTC error:', error);
  }, []);

  // WebRTC hook with stable callbacks
  const {
    localStream,
    remoteStream,
    isConnecting,
    isConnected,
    startCall,
    endCall: webrtcEndCall,
    toggleMute: webrtcToggleMute,
    isMuted,
  } = useWebRTC({
    conversationId,
    onRemoteStream: handleRemoteStream,
    onConnectionStateChange: handleConnectionStateChange,
    onError: handleError,
  });

  // Start WebRTC when call is in CONNECTING state
  useEffect(() => {
    // Only start once
    if (webrtcStartedRef.current) {
      return;
    }

    // Must be in CONNECTING state
    if (callState.status !== CallStatus.CONNECTING) {
      return;
    }

    // Must be for this conversation
    if (callState.conversationId !== conversationId) {
      return;
    }

    // Determine if we are the initiator
    const isInitiator = callState.callerId === user?.id;

    console.log('[ActiveCallUI] Starting WebRTC...');
    console.log('[ActiveCallUI] isInitiator:', isInitiator);
    console.log('[ActiveCallUI] callerId:', callState.callerId);
    console.log('[ActiveCallUI] userId:', user?.id);

    webrtcStartedRef.current = true;

    startCall(isInitiator).catch((error) => {
      console.error('[ActiveCallUI] Failed to start WebRTC:', error);
      webrtcStartedRef.current = false;
    });
  }, [callState.status, callState.conversationId, callState.callerId, conversationId, user?.id, startCall]);

  // Reset webrtcStarted when call ends
  useEffect(() => {
    if (callState.status === CallStatus.IDLE) {
      webrtcStartedRef.current = false;
    }
  }, [callState.status]);

  // Update context with local stream
  useEffect(() => {
    if (localStream) {
      setLocalStream(localStream);
    }
  }, [localStream, setLocalStream]);

  // Audio level visualization
  useEffect(() => {
    if (!remoteStream) return;

    let mounted = true;

    const setupAudioVisualization = async () => {
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        const source = ctx.createMediaStreamSource(remoteStream);
        source.connect(analyser);
        analyser.fftSize = 256;

        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!mounted || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (error) {
        console.error('[ActiveCallUI] Audio visualization error:', error);
      }
    };

    setupAudioVisualization();

    return () => {
      mounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [remoteStream]);

  const handleEndCall = useCallback(() => {
    webrtcEndCall();
    endCall();
  }, [webrtcEndCall, endCall]);

  const handleToggleMute = useCallback(() => {
    webrtcToggleMute();
    toggleMute();
  }, [webrtcToggleMute, toggleMute]);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const statusText = useMemo((): string => {
    switch (callState.status) {
      case CallStatus.INITIATING:
        return 'Calling...';
      case CallStatus.RINGING:
        return 'Ringing...';
      case CallStatus.CONNECTING:
        return 'Connecting...';
      case CallStatus.CONNECTED:
        return formatDuration(callDuration);
      default:
        return '';
    }
  }, [callState.status, callDuration, formatDuration]);

  // Don't render if not in an active call for this conversation
  if (callState.status === CallStatus.IDLE) {
    return null;
  }

  if (callState.conversationId !== conversationId) {
    return null;
  }

  const displayName = otherPartyName || callState.callerName || 'Unknown';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Minimized floating badge
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-white rounded-full shadow-lg border border-gray-200 p-1 flex items-center gap-2">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-25"
              style={{ animationDuration: '1.5s' }}
            />
            <div className="relative w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {initials}
            </div>
          </div>

          <div className="pr-2">
            <p className="text-xs font-medium text-gray-900">{displayName}</p>
            <p className="text-xs text-primary-600 font-mono">{statusText}</p>
          </div>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Maximize2 className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={handleEndCall}
            className="p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
          >
            <PhoneOff className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Full call UI
  return (
    <>
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={callState.isDeafened}
      />

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />

      {/* Call Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {isConnected ? 'Voice Call' : 'Connecting...'}
            </span>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Main content */}
          <div className="px-6 py-8 flex flex-col items-center">
            {/* Avatar with ring animation */}
            <div className="relative mb-6">
              <div
                className="absolute inset-0 rounded-full border-4 border-primary-400 transition-all duration-150"
                style={{
                  transform: `scale(${1 + audioLevel * 0.15})`,
                  opacity: 0.3 + audioLevel * 0.5,
                }}
              />
              <div
                className="absolute inset-[-8px] rounded-full border-2 border-primary-300 transition-all duration-150"
                style={{
                  transform: `scale(${1 + audioLevel * 0.2})`,
                  opacity: 0.2 + audioLevel * 0.3,
                }}
              />

              <div className="relative w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-bold">{initials}</span>
              </div>

              {/* Status dot */}
              <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white shadow ${
                isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
              }`} />
            </div>

            {/* Name */}
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              {displayName}
            </h2>

            {/* Status / Duration */}
            <div className="flex items-center gap-2 mb-8">
              {isConnected && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
              <span className={`text-sm font-mono ${isConnected ? 'text-gray-600' : 'text-gray-400'}`}>
                {statusText}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleToggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isMuted || callState.isMuted
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isMuted || callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={handleEndCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <PhoneOff className="w-7 h-7" />
              </button>

              <button
                onClick={toggleDeafen}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  callState.isDeafened
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {callState.isDeafened ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    className={`w-1 rounded-full transition-all ${
                      isConnected ? (bar <= 3 ? 'bg-green-500' : 'bg-gray-300') : 'bg-gray-300'
                    }`}
                    style={{ height: `${bar * 3 + 4}px` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {isConnected ? 'Good connection' : 'Establishing connection...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ActiveCallUI;

