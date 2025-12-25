import { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { sendCallSignal } from '../../services/tutorSessionSocket';
import {
  Mic, MicOff, PhoneOff,
  Monitor, Loader2, Users
} from 'lucide-react';

interface AudioCallProps {
  roomUrl: string;
  token: string;
  userName?: string;
  sessionId?: string; // For sending call signals
  onLeave?: () => void;
  onParticipantCountChange?: (count: number) => void;
  className?: string;
}

export function AudioCall({
  roomUrl,
  token,
  userName,
  sessionId,
  onLeave,
  onParticipantCountChange,
  className = ''
}: AudioCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [callKey, setCallKey] = useState(0); // Force re-render key

  // Initialize Daily.co
  useEffect(() => {
    if (!containerRef.current || !roomUrl || !token) {
      console.log('[AudioCall] Missing required props:', {
        hasContainer: !!containerRef.current,
        roomUrl,
        token: token ? 'present' : 'missing'
      });
      return;
    }

    // Ensure container is properly mounted
    if (!containerRef.current.isConnected) {
      console.log('[AudioCall] Container not connected to DOM, retrying...');
      setTimeout(() => setCallKey(prev => prev + 1), 100);
      return;
    }

    console.log('[AudioCall] Initializing with:', {
      roomUrl,
      token: token.substring(0, 10) + '...',
      containerReady: !!containerRef.current
    });

    const initCall = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Destroy existing call frame if it exists
        if (callFrameRef.current) {
          console.log('[AudioCall] Destroying existing call frame');
          try {
            await callFrameRef.current.destroy();
          } catch (destroyErr) {
            console.warn('[AudioCall] Error destroying call frame:', destroyErr);
          }
          callFrameRef.current = null;
        }

        // Create Daily.co call frame (audio-only)
        console.log('[AudioCall] Creating Daily iframe for room:', roomUrl);
        const callFrame = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: false, // No fullscreen for audio call
          showParticipantsBar: true,
        });

        callFrameRef.current = callFrame;

        // Event listeners
        callFrame.on('joined-meeting', () => {
          console.log('[AudioCall] Joined meeting');
          setIsJoined(true);
          setIsLoading(false);
        });

        callFrame.on('left-meeting', () => {
          console.log('[AudioCall] Left meeting');
          setIsJoined(false);
          onLeave?.();
        });

        callFrame.on('participant-joined', () => {
          updateParticipantCount(callFrame);
        });

        callFrame.on('participant-left', () => {
          updateParticipantCount(callFrame);
        });

        callFrame.on('error', (event) => {
          console.error('[VideoCall] Error:', event);
          setError(event.errorMsg || 'Failed to connect to video call');
          setIsLoading(false);
        });

        // Join the room (audio-only)
        console.log('[AudioCall] Joining room:', roomUrl);
        await callFrame.join({
          url: roomUrl,
          token: token,
          userName: userName || 'User',
        });

        // Ensure video is off for audio call
        try {
          await callFrame.setLocalVideo(false);
          console.log('[AudioCall] Video disabled for audio call');
        } catch (videoErr) {
          console.warn('[AudioCall] Could not disable video:', videoErr);
        }

        console.log('[AudioCall] Join request sent successfully');

      } catch (err) {
        console.error('[VideoCall] Init error:', err);
        console.error('[AudioCall] Init error:', err);
        setError('Failed to initialize audio call');
        setIsLoading(false);
      }
    };

    initCall();

    return () => {
      console.log('[AudioCall] Cleaning up call frame');
      if (callFrameRef.current) {
        try {
          callFrameRef.current.destroy();
        } catch (err) {
          console.warn('[AudioCall] Error cleaning up call frame:', err);
        }
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, token, userName, onLeave, callKey]);

  const updateParticipantCount = useCallback((callFrame: DailyCall) => {
    const participants = callFrame.participants();
    const count = Object.keys(participants).length;
    setParticipantCount(count);
    onParticipantCountChange?.(count);
  }, [onParticipantCountChange]);

  const toggleMute = useCallback(() => {
    if (!callFrameRef.current) return;
    const newMuteState = !isMuted;
    callFrameRef.current.setLocalAudio(!newMuteState);
    setIsMuted(newMuteState);

    // Send call signal
    if (sessionId) {
      sendCallSignal(sessionId, newMuteState ? 'mute' : 'unmute');
    }
  }, [isMuted, sessionId]);


  const toggleScreenShare = useCallback(async () => {
    if (!callFrameRef.current) {
      console.log('[AudioCall] No call frame available for screen sharing');
      return;
    }

    try {
      if (isScreenSharing) {
        console.log('[AudioCall] Stopping screen share');
        await callFrameRef.current.stopScreenShare();
        // Send call signal
        if (sessionId) {
          sendCallSignal(sessionId, 'stopScreenShare');
        }
      } else {
        console.log('[AudioCall] Starting screen share');
        await callFrameRef.current.startScreenShare();
        // Send call signal
        if (sessionId) {
          sendCallSignal(sessionId, 'screenShare');
        }
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (err) {
      console.error('[AudioCall] Screen share error:', err);
      // Show user-friendly error
      setError('Screen sharing failed. Please check permissions.');
      setTimeout(() => setError(null), 3000);
    }
  }, [isScreenSharing, sessionId]);

  const handleLeave = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (retryCount >= 3) {
      setError('Maximum retry attempts reached. Please refresh the page.');
      return;
    }

    console.log('[VideoCall] Retrying call initialization, attempt:', retryCount + 1);
    setRetryCount(prev => prev + 1);
    setError(null);
    setIsLoading(true);
    setIsJoined(false);

    // Force re-initialization by changing the key
    setCallKey(prev => prev + 1);
  }, [retryCount]);

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      {/* Video Container */}
      <div
        ref={containerRef}
        className="w-full h-full min-h-[200px]"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-gray-300 text-sm">Connecting to audio call...</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center gap-3 p-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <PhoneOff className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 text-sm text-center">{error}</p>
          <button
            onClick={handleRetry}
            disabled={retryCount >= 3}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-400 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            {retryCount >= 3 ? 'Max Retries Reached' : `Retry (${retryCount}/3)`}
          </button>
        </div>
      )}

      {/* Controls Bar */}
      {isJoined && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-xl">
          {/* Participant Count */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            <span>{participantCount}</span>
          </div>
          
          <div className="w-px h-6 bg-gray-700" />
          
          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className={`p-2.5 rounded-full transition-colors ${
              isMuted 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={toggleScreenShare}
            className={`p-2.5 rounded-full transition-colors ${
              isScreenSharing 
                ? 'bg-violet-500 text-white' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <Monitor className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-700" />

          {/* Leave Call */}
          <button
            onClick={handleLeave}
            className="p-2.5 bg-red-500 hover:bg-red-400 text-white rounded-full transition-colors"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default AudioCall;

