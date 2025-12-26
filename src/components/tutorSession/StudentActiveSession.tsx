import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, Pencil, ChevronUp, ChevronDown,
  Share2, LogOut, Maximize2, Minimize2
} from 'lucide-react';
import {
  connectTutorSessionSocket,
  joinSession,
  leaveSession,
  sendWhiteboardUpdate,
  onChatMessage,
  offChatMessage,
  onChatHistory,
  offChatHistory,
  onSessionStatusChanged,
  offSessionStatusChanged,
  onCallSignal,
  offCallSignal,
} from '../../services/tutorSessionSocket';
import { tutorSessionApi } from '../../api';
import {
  DailyRoom,
  TutorStudentChatMessage,
  SessionStatusChangedEvent,
} from '../../types';
import { FloatingCallIndicator } from './AudioCall';
import { CollaborativeWhiteboard } from './CollaborativeWhiteboard';
import toast from 'react-hot-toast';

interface StudentActiveSessionProps {
  tutorSessionId: string;
  tutorName: string;
  dailyRoom?: DailyRoom | null;
  onEndSession?: () => void;
  onToggleLiveSharing?: (enabled: boolean) => void;
  liveSharingEnabled?: boolean;
  className?: string;
}

type ViewMode = 'minimized' | 'call' | 'whiteboard' | 'chat' | 'fullscreen';
type FullscreenMode = 'call' | 'whiteboard' | 'chat' | null;

export function StudentActiveSession({
  tutorSessionId,
  tutorName,
  dailyRoom,
  onEndSession,
  onToggleLiveSharing,
  liveSharingEnabled = false,
  className = '',
}: StudentActiveSessionProps) {
  console.log('[StudentActiveSession] Rendered with props:', {
    tutorSessionId,
    tutorName,
    hasDailyRoom: !!dailyRoom,
    liveSharingEnabled
  });
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('minimized');
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>(null);
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  const [chatMessages, setChatMessages] = useState<TutorStudentChatMessage[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Join session room on mount (socket connection should already be established by parent)
  useEffect(() => {
    if (!tutorSessionId) return;

    console.log('[StudentActiveSession] Joining session:', tutorSessionId);

    // Force socket connection if not already connected
    const token = localStorage.getItem('accessToken');
    if (token) {
      console.log('[StudentActiveSession] Ensuring socket connection');
      connectTutorSessionSocket(token);
    }

    joinSession(tutorSessionId);

    return () => {
      console.log('[StudentActiveSession] Leaving session:', tutorSessionId);
      leaveSession(tutorSessionId);
    };
  }, [tutorSessionId]);

  // Socket event listeners
  useEffect(() => {
    console.log('[StudentActiveSession] Setting up event listeners for session:', tutorSessionId);

    // Chat message from tutor
    const handleChatMessage = (message: TutorStudentChatMessage) => {
      setChatMessages(prev => [...prev, message]);
      toast.success(`New message from ${tutorName}`);
    };

    // Chat history loaded
    const handleChatHistory = (data: any) => {
      if (data.sessionId === tutorSessionId && data.messages) {
        setChatMessages(data.messages);
      }
    };

    // Whiteboard events are handled directly by CollaborativeWhiteboard component


    // Session status changed
    const handleSessionStatusChanged = (data: SessionStatusChangedEvent) => {
      if (data.sessionId === tutorSessionId) {
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
          setSessionEnded(true);
          toast.success('Session has ended');
          // Also call onEndSession to ensure parent clears the session
          setTimeout(() => onEndSession?.(), 1000);
        } else if (data.status === 'ACTIVE') {
          toast.success('Session is now active');
        }
      }
    };

    // Call signals from tutor (mute/unmute, video on/off, screenshare)
    const handleCallSignal = (data: any) => {
      if (data.sessionId === tutorSessionId) {
        console.log('Received call signal from tutor:', data);
        // Handle call signals (mute, unmute, video on/off, screenshare)
        // These will be handled by the VideoCall component
        toast(`Tutor ${data.signal}`, { duration: 2000 });
      }
    };

    console.log('[StudentActiveSession] Adding event listeners');
    onChatMessage(handleChatMessage);
    onChatHistory(handleChatHistory);
    onSessionStatusChanged(handleSessionStatusChanged);
    onCallSignal(handleCallSignal);

    return () => {
      console.log('[StudentActiveSession] Removing event listeners');
      offChatMessage();
      offChatHistory();
      offSessionStatusChanged();
      offCallSignal();
    };
  }, [tutorSessionId, viewMode]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);




  // Toggle view mode
  const toggleView = useCallback((mode: ViewMode) => {
    setViewMode(prev => prev === mode ? 'minimized' : mode);
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback((mode: FullscreenMode) => {
    setFullscreenMode(prev => prev === mode ? null : mode);
    // When entering fullscreen, also set the view mode
    if (fullscreenMode !== mode) {
      setViewMode(mode as ViewMode);
    }
  }, [fullscreenMode]);

  // End session
  const handleEndSession = useCallback(async () => {
    try {
      await tutorSessionApi.endSession(tutorSessionId);
      toast.success('Session ended successfully');
      onEndSession?.();
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session');
    }
  }, [tutorSessionId, onEndSession]);


  // If session ended, show minimal banner
  if (sessionEnded) {
    return (
      <div className={`bg-gray-800 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
              {tutorName?.charAt(0) || 'T'}
            </div>
            <div>
              <p className="text-sm text-gray-400">Session with {tutorName} has ended</p>
            </div>
          </div>
          <button
            onClick={handleEndSession}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#1a1a1a] rounded-2xl border border-emerald-500/30 overflow-hidden shadow-lg shadow-emerald-500/10 ${className}`}>
      {/* Main Banner - Always visible */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-emerald-500/20">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Tutor Info */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                {tutorName?.charAt(0) || 'T'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#1a1a1a]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{tutorName}</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                {isInVideoCall ? 'In call' : 'Connected'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
         

            {/* Whiteboard */}
            <button
              onClick={() => toggleView('whiteboard')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'whiteboard' 
                  ? 'bg-violet-500 text-white' 
                  : 'bg-gray-700 text-violet-400 hover:bg-gray-600'
              }`}
              title="Whiteboard"
            >
              <Pencil className="w-5 h-5" />
            </button>

          

            {/* Fullscreen Toggle */}
            {fullscreenMode && (
              <button
                onClick={() => setFullscreenMode(null)}
                className="p-2 bg-gray-700 text-gray-400 hover:bg-gray-600 rounded-lg transition-colors"
                title="Exit fullscreen"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}

            {/* Live Sharing Toggle */}
            <button
              onClick={() => onToggleLiveSharing?.(!liveSharingEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                liveSharingEnabled
                  ? 'bg-fuchsia-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={liveSharingEnabled ? 'Stop sharing AI chat' : 'Share AI chat with tutor'}
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* End Session */}
            <button
              onClick={handleEndSession}
              className="p-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
              title="End session"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* Minimize/Expand */}
            <button
              onClick={() => {
                if (fullscreenMode) {
                  setFullscreenMode(null);
                } else {
                  setViewMode(viewMode === 'minimized' ? 'call' : 'minimized');
                }
              }}
              className="p-2 bg-gray-700 text-gray-400 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {fullscreenMode ? (
                <Minimize2 className="w-5 h-5" />
              ) : viewMode === 'minimized' ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {viewMode !== 'minimized' && (
        <div className={`${fullscreenMode ? `fixed inset-4 z-50 bg-[#1a1a1a] rounded-2xl ${fullscreenMode === 'whiteboard' ? 'overflow-visible' : 'overflow-hidden'} flex flex-col p-4` : 'p-4'}`}>
          {/* Fullscreen Header */}
          {fullscreenMode && (
            <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                  {tutorName?.charAt(0) || 'T'}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">
                    {fullscreenMode === 'call' && 'Video Call'}
                    {fullscreenMode === 'whiteboard' && 'Collaborative Whiteboard'}
                    {fullscreenMode === 'chat' && `Chat with ${tutorName}`}
                  </p>
                  <p className="text-xs text-emerald-400">Fullscreen Mode</p>
                </div>
              </div>
              <button
                onClick={() => setFullscreenMode(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Audio Call View */}
          {(viewMode === 'call' || fullscreenMode === 'call') && isInVideoCall && dailyRoom && (
            <div className={`space-y-4 ${fullscreenMode ? 'p-4 h-full' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Video className="w-4 h-4 text-emerald-400" />
                  Video Call with {tutorName}
                </h3>
                {!fullscreenMode && (
                  <button
                    onClick={() => toggleFullscreen('call')}
                    className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Video Call Status */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Video className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">
                        {isInVideoCall ? 'Video Call Active' : 'Video Call Available'}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {isInVideoCall
                          ? 'Call is open in another tab'
                          : 'Use the floating button to join'
                        }
                      </p>
                    </div>
                  </div>
                  {isInVideoCall && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-green-400 text-xs font-medium">In Call</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Whiteboard View */}
          {(viewMode === 'whiteboard' || fullscreenMode === 'whiteboard') && (
            <div className={`space-y-2 ${fullscreenMode ? 'flex-1 flex flex-col' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-violet-400" />
                  Collaborative Whiteboard
                </h3>
                {!fullscreenMode && (
                  <button
                    onClick={() => toggleFullscreen('whiteboard')}
                    className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <CollaborativeWhiteboard
                sessionId={tutorSessionId}
                className={fullscreenMode ? 'h-[800px]' : 'h-[500px]'}
                onSave={(elements) => {
                  // Send whiteboard update to tutor
                  sendWhiteboardUpdate(tutorSessionId, elements);
                }}
              />
            </div>
          )}

        </div>
      )}

      {/* Floating Call Indicator */}
      <FloatingCallIndicator
        roomUrl={dailyRoom?.url || ''}
        token={dailyRoom?.token || ''}
        isJoined={isInVideoCall}
        onJoinStateChange={setIsInVideoCall}
        disabled={!dailyRoom}
        sessionId={tutorSessionId}
      />
    </div>
  );
}

export default StudentActiveSession;

