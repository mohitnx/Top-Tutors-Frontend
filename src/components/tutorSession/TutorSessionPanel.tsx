import { useState, useEffect, useCallback } from 'react';
import { 
  UserPlus, Loader2, Check, X, Video, 
  Share2, Phone, Sparkles
} from 'lucide-react';
import { tutorSessionApi } from '../../api';
import {
  connectTutorSessionSocket,
  disconnectTutorSessionSocket,
  subscribeToAISession,
  subscribeToSession,
  onTutorAccepted,
  offTutorAccepted,
} from '../../services/tutorSessionSocket';
import { DailyRoom, TutorSessionAcceptedEvent, AIUrgency } from '../../types';
import { AudioCall } from './AudioCall';
import { FloatingTutorSession } from './FloatingTutorSession';
import toast from 'react-hot-toast';

interface TutorSessionPanelProps {
  aiSessionId: string;
  activeTutorSession?: {
    tutorSessionId: string;
    tutorName: string;
    tutorAvatar?: string;
  } | null;
  onClose?: () => void;
  className?: string;
}

type SessionState = 
  | 'idle'
  | 'requesting'
  | 'waiting'
  | 'tutor_connected'
  | 'in_call';

interface TutorInfo {
  id: string;
  name: string;
  avatar?: string;
}

export function TutorSessionPanel({
  aiSessionId,
  activeTutorSession,
  onClose,
  className = ''
}: TutorSessionPanelProps) {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [tutorSessionId, setTutorSessionId] = useState<string | null>(null);
  const [tutorInfo, setTutorInfo] = useState<TutorInfo | null>(null);
  const [dailyRoom, setDailyRoom] = useState<DailyRoom | null>(null);
  const [liveSharingEnabled, setLiveSharingEnabled] = useState(false);
  const [isTogglingConsent, setIsTogglingConsent] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [showFloatingSession, setShowFloatingSession] = useState(false);

  // Connect to tutor session socket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    connectTutorSessionSocket(token);

    // Subscribe to AI session for tutor acceptance notifications
    subscribeToAISession(aiSessionId);

    return () => {
      disconnectTutorSessionSocket();
    };
  }, [aiSessionId]);

  // Handle active tutor session changes
  useEffect(() => {
    if (activeTutorSession) {
      console.log('[TutorSessionPanel] Active tutor session detected:', activeTutorSession);
      setTutorSessionId(activeTutorSession.tutorSessionId);
      setTutorInfo({
        id: 'tutor-id', // We'll need to get this from the API
        name: activeTutorSession.tutorName,
        avatar: activeTutorSession.tutorAvatar
      });

      // Subscribe to the tutor session for real-time updates
      subscribeToSession(activeTutorSession.tutorSessionId);

      // Get room token for student
      const getRoomToken = async () => {
        try {
          console.log('[TutorSessionPanel] Getting room token for session:', activeTutorSession.tutorSessionId);
          const response = await tutorSessionApi.getStudentRoomToken(activeTutorSession.tutorSessionId);
          console.log('[TutorSessionPanel] Room token received:', response.data);
          setDailyRoom(response.data);
          setShowFloatingSession(true);
          setSessionState('tutor_connected');
          toast.success('Connected to tutor session!');
        } catch (error) {
          console.error('[TutorSessionPanel] Failed to get room token:', error);
          toast.error('Failed to connect to video call');
          setSessionState('idle');
        }
      };

      getRoomToken();
    } else {
      // Clear session when no active session
      setTutorSessionId(null);
      setTutorInfo(null);
      setDailyRoom(null);
      setShowFloatingSession(false);
      setSessionState('idle');
    }
  }, [activeTutorSession]);

  // Request tutor help
  const handleRequestTutor = useCallback(async (urgency: AIUrgency = 'NORMAL') => {
    if (!aiSessionId) {
      toast.error('Please start a conversation first');
      return;
    }

    setSessionState('requesting');
    
    try {
      const response = await tutorSessionApi.requestTutorHelp({
        aiSessionId,
        urgency,
      });

      setTutorSessionId(response.data.tutorSessionId);
      setSummary(response.data.summary);
      setTopic(response.data.topic);
      setSessionState('waiting');
      
      toast.success('Looking for available tutors...');
    } catch (error: any) {
      console.error('Failed to request tutor:', error);
      const message = error?.response?.data?.message || 'Failed to request tutor';
      toast.error(message);
      setSessionState('idle');
    }
  }, [aiSessionId]);

  // Cancel request
  const handleCancelRequest = useCallback(() => {
    setSessionState('idle');
    setTutorSessionId(null);
    setSummary(null);
    setTopic(null);
    toast('Request cancelled');
  }, []);

  // Toggle live sharing consent
  const handleToggleLiveSharing = useCallback(async (enabled: boolean) => {
    if (!tutorSessionId) return;

    setIsTogglingConsent(true);
    try {
      await tutorSessionApi.updateConsent(tutorSessionId, enabled);
      setLiveSharingEnabled(enabled);
      toast.success(enabled ? 'Live sharing enabled' : 'Live sharing disabled');
    } catch (error) {
      console.error('Failed to update consent:', error);
      toast.error('Failed to update sharing settings');
    } finally {
      setIsTogglingConsent(false);
    }
  }, [tutorSessionId]);

  // Join video call
  const handleJoinCall = useCallback(() => {
    if (dailyRoom) {
      setSessionState('in_call');
    }
  }, [dailyRoom]);

  // Leave call
  const handleLeaveCall = useCallback(() => {
    setSessionState('tutor_connected');
  }, []);

  // Render based on session state
  const renderContent = () => {
    switch (sessionState) {
      case 'idle':
        return (
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Need Human Help?
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Connect with a tutor for personalized assistance via video call
            </p>
            
            <button
              onClick={() => handleRequestTutor('NORMAL')}
              className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
            >
              <div className="flex items-center justify-center gap-2">
                <UserPlus className="w-5 h-5" />
                Get Help from Tutor
              </div>
            </button>
          </div>
        );

      case 'requesting':
        return (
          <div className="text-center p-6">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-violet-400 animate-spin" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Analyzing Conversation...
            </h3>
            <p className="text-gray-400 text-sm">
              Our AI is preparing a summary for the tutor
            </p>
          </div>
        );

      case 'waiting':
        return (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
              <div>
                <h3 className="font-medium text-amber-200">Finding a Tutor...</h3>
                <p className="text-xs text-gray-400">Please wait while we connect you</p>
              </div>
            </div>
            
            {topic && (
              <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Topic detected:</p>
                <p className="text-sm text-white font-medium">{topic}</p>
              </div>
            )}
            
            {summary && (
              <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">AI Summary:</p>
                <p className="text-sm text-gray-300 line-clamp-3">{summary}</p>
              </div>
            )}
            
            <button
              onClick={handleCancelRequest}
              className="w-full px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors text-sm"
            >
              Cancel Request
            </button>
          </div>
        );

      case 'tutor_connected':
        return (
          <div className="p-6">
            {/* Tutor Info */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                {tutorInfo?.name?.charAt(0) || 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Tutor Connected!</span>
                </div>
                <p className="text-white font-semibold">{tutorInfo?.name || 'Tutor'}</p>
              </div>
            </div>

            {/* Join Call Button */}
            {dailyRoom && (
              <button
                onClick={handleJoinCall}
                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-colors mb-4 flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                Join Video Call
              </button>
            )}

            {/* Live Sharing Consent */}
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Share2 className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-white">Share Live AI Chat</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Let tutor see your AI conversation in real-time
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={liveSharingEnabled}
                        onChange={(e) => handleToggleLiveSharing(e.target.checked)}
                        disabled={isTogglingConsent}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${
                        liveSharingEnabled ? 'bg-violet-500' : 'bg-gray-600'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          liveSharingEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 'in_call':
        return (
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                  {tutorInfo?.name?.charAt(0) || 'T'}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{tutorInfo?.name}</p>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    In call
                  </p>
                </div>
              </div>
              
              {/* Live Sharing Toggle (compact) */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-400">Live Share</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={liveSharingEnabled}
                    onChange={(e) => handleToggleLiveSharing(e.target.checked)}
                    disabled={isTogglingConsent}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${
                    liveSharingEnabled ? 'bg-violet-500' : 'bg-gray-600'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      liveSharingEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
              </label>
            </div>

            {/* Video Call */}
            {dailyRoom && (
              <AudioCall
                roomUrl={dailyRoom.url}
                token={dailyRoom.token}
                userName="Student"
                onLeave={handleLeaveCall}
                className="h-[400px]"
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Show floating session when tutor is connected
  if (showFloatingSession && tutorSessionId && tutorInfo && dailyRoom) {
    return (
      <FloatingTutorSession
        tutorSessionId={tutorSessionId}
        tutor={tutorInfo}
        dailyRoom={dailyRoom}
        onClose={() => {
          setShowFloatingSession(false);
          setSessionState('idle');
          setTutorSessionId(null);
          setTutorInfo(null);
          setDailyRoom(null);
        }}
      />
    );
  }

  return (
    <div className={`bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium text-white">Tutor Session</span>
        </div>
        {onClose && sessionState === 'idle' && (
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}

export default TutorSessionPanel;

