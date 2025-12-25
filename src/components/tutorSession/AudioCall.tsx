import { useEffect, useState } from 'react';
import { Video, PhoneOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AudioCallProps {
  roomUrl: string;
  token: string;
  userName?: string;
  sessionId?: string; // For sending call signals
  onLeave?: () => void;
  onParticipantCountChange?: (count: number) => void;
  className?: string;
  autoJoin?: boolean; // Whether to automatically join the call
}

export function AudioCall({
  roomUrl,
  token,
  userName,
  sessionId,
  onLeave,
  onParticipantCountChange,
  className = '',
  autoJoin = false
}: AudioCallProps) {
  const { user } = useAuth();
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Join call in new tab
  const handleJoinCall = () => {
    if (!roomUrl || !token) return;

    setIsLoading(true);
    console.log('[AudioCall] Opening Daily.co room in new tab');

    // Create URL with actual user name to avoid prompting
    const actualUserName = user?.name || userName || 'User';
    const callUrl = `${roomUrl}?t=${token}&name=${encodeURIComponent(actualUserName)}`;

    window.open(callUrl, '_blank');
    setIsJoined(true);
    setIsLoading(false);
  };

  // Leave call (just update state)
  const handleLeaveCall = () => {
    setIsJoined(false);
    onLeave?.();
  };

  // Reset when room changes
  useEffect(() => {
    setIsJoined(false);
  }, [roomUrl]);

  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      {!isJoined ? (
        // Join Call Interface
        <div className="flex flex-col items-center justify-center p-8 min-h-[200px] space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Video className="w-8 h-8 text-blue-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">Video Call Ready</h3>
            <p className="text-gray-400 text-sm mb-4">
              Join the video call with your tutor/student
            </p>
          </div>
          <button
            onClick={handleJoinCall}
            disabled={isLoading || !roomUrl || !token}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Join Video Call
              </>
            )}
          </button>
        </div>
      ) : (
        // In Call Interface
        <div className="flex flex-col items-center justify-center p-8 min-h-[200px] space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <Video className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">In Video Call</h3>
            <p className="text-gray-400 text-sm mb-4">
              Video call is open in another tab
            </p>
          </div>
          <button
            onClick={handleLeaveCall}
            className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors"
          >
            Leave Call
          </button>
        </div>
      )}
    </div>
  );
}

// Floating call indicator for compact display
export function FloatingCallIndicator({
  roomUrl,
  token,
  userName,
  isJoined,
  onJoinStateChange,
  className = '',
  disabled = false
}: {
  roomUrl: string;
  token: string;
  userName?: string; // Optional fallback, primarily using auth context
  isJoined: boolean;
  onJoinStateChange: (joined: boolean) => void;
  className?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinCall = () => {
    if (!roomUrl || !token || disabled) return;

    setIsLoading(true);
    console.log('[FloatingCallIndicator] Opening Daily.co room in new tab');

    const actualUserName = user?.name || userName || 'User';
    const callUrl = `${roomUrl}?t=${token}&name=${encodeURIComponent(actualUserName)}`;
    window.open(callUrl, '_blank');
    onJoinStateChange(true);
    setIsLoading(false);
  };

  const handleLeaveCall = () => {
    onJoinStateChange(false);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {!isJoined ? (
        <button
          onClick={handleJoinCall}
          disabled={isLoading || !roomUrl || !token || disabled}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all hover:scale-110 ${
            disabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 animate-bounce'
          }`}
          title={disabled ? 'Waiting for tutor to start call' : 'Join Video Call'}
        >
          {isLoading ? (
            <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Video className="w-7 h-7" />
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2 backdrop-blur-sm">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm font-medium">In Call</span>
          <button
            onClick={handleLeaveCall}
            className="w-6 h-6 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center text-white ml-1 transition-all hover:scale-110"
            title="Leave Call"
          >
            <PhoneOff className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default AudioCall;