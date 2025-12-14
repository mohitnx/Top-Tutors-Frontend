import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Send, 
  Mic, 
  Sparkles,
  BookOpen,
  ArrowRight,
  Lock,
  X,
  Loader2,
  Play,
  Pause,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi } from '../api';
import { MessageType, ProcessingStatusEvent, TutorAssignedEvent, AllTutorsBusyEvent } from '../types';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useStudentNotifications } from '../hooks/useSocket';
import toast from 'react-hot-toast';

const FREE_QUERY_KEY = 'topTutors_freeQueryUsed';

const suggestionPrompts = [
  "How do I solve quadratic equations?",
  "Explain Newton's laws of motion",
  "Help me understand photosynthesis",
  "What's the difference between mitosis and meiosis?"
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Landing() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  // Query state
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalReason, setLoginModalReason] = useState<'audio' | 'limit'>('limit');
  
  // Free query tracking
  const [hasFreeQueryUsed, setHasFreeQueryUsed] = useState(() => {
    return localStorage.getItem(FREE_QUERY_KEY) === 'true';
  });

  // Audio recording
  const [isAudioMode, setIsAudioMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const {
    isRecording,
    isPaused,
    duration,
    audioUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAudioFile,
  } = useAudioRecorder(300);

  // Processing status state
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusEvent | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const pendingConversationRef = useRef<string | null>(null);

  // Handle processing status updates
  const handleProcessingStatus = useCallback((data: ProcessingStatusEvent) => {
    setProcessingStatus(data);
  }, []);

  const handleTutorAssigned = useCallback((data: TutorAssignedEvent) => {
    setShowProcessingModal(false);
    setIsSubmitting(false);
    toast.success(`${data.tutor.name} is ready to help you!`);
    navigate(`/conversations/${data.conversationId}`);
  }, [navigate]);

  const handleAllTutorsBusy = useCallback((data: AllTutorsBusyEvent) => {
    setProcessingStatus({
      status: 'ALL_TUTORS_BUSY',
      message: data.message,
      progress: 100,
    });
    toast.error(data.message);
  }, []);

  // Only subscribe to notifications when authenticated
  useStudentNotifications(isAuthenticated ? {
    onProcessingStatus: handleProcessingStatus,
    onTutorAssigned: handleTutorAssigned,
    onAllTutorsBusy: handleAllTutorsBusy,
  } : {});

  // Check if user can make a request
  const canMakeRequest = isAuthenticated || !hasFreeQueryUsed;
  
  // Handle audio button click
  const handleAudioClick = () => {
    if (!isAuthenticated) {
      setLoginModalReason('audio');
      setShowLoginModal(true);
      return;
    }
    
    if (!isAudioMode) {
      setIsAudioMode(true);
      startRecording();
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleCancelAudio = () => {
    resetRecording();
    setIsAudioMode(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle text submission
  const handleTextSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!question.trim()) {
      toast.error('Please enter your question');
      return;
    }

    if (question.trim().length < 10) {
      toast.error('Please provide more detail in your question');
      return;
    }

    // Check if can make request
    if (!isAuthenticated && hasFreeQueryUsed) {
      setLoginModalReason('limit');
      setShowLoginModal(true);
      return;
    }

    setIsSubmitting(true);
    setShowProcessingModal(true);
    setProcessingStatus({
      status: 'RECEIVING',
      message: 'Sending your question...',
      progress: 10,
    });

    try {
      const response = await messagesApi.sendMessage({
        content: question.trim(),
        messageType: MessageType.TEXT,
      });

      // Mark free query as used for non-authenticated users
      if (!isAuthenticated) {
        localStorage.setItem(FREE_QUERY_KEY, 'true');
        setHasFreeQueryUsed(true);
      }

      pendingConversationRef.current = response.data.conversation.id;

      if (response.data.conversation.tutor) {
        const tutorName = response.data.conversation.tutor.user?.name || 'a tutor';
        toast.success(`Your question has been sent to ${tutorName}!`);
        setShowProcessingModal(false);
        navigate(`/conversations/${response.data.conversation.id}`);
      } else {
        setProcessingStatus({
          status: 'WAITING_FOR_TUTOR',
          message: 'Waiting for an available tutor...',
          progress: 80,
        });
        
        setTimeout(() => {
          if (pendingConversationRef.current) {
            setShowProcessingModal(false);
            navigate(`/conversations/${pendingConversationRef.current}`);
          }
        }, 10000);
      }
    } catch (error: unknown) {
      console.error('Failed to send question:', error);
      setShowProcessingModal(false);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to send your question. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Handle audio submission
  const handleAudioSubmit = async () => {
    const audioFile = getAudioFile();
    if (!audioFile) {
      toast.error('No audio to send');
      return;
    }

    setIsSubmitting(true);
    setShowProcessingModal(true);
    setProcessingStatus({
      status: 'RECEIVING',
      message: 'Uploading your voice message...',
      progress: 10,
    });

    try {
      const response = await messagesApi.sendAudioMessage(
        audioFile,
        undefined,
        (progress) => {
          if (progress < 100) {
            setProcessingStatus({
              status: 'RECEIVING',
              message: `Uploading... ${progress}%`,
              progress: Math.min(progress / 2, 40),
            });
          }
        }
      );

      pendingConversationRef.current = response.data.conversation.id;

      if (response.data.classification) {
        const { subject, topic } = response.data.classification;
        setProcessingStatus({
          status: 'CLASSIFYING',
          message: `Detected: ${subject.replace('_', ' ')}${topic ? ` - ${topic}` : ''}`,
          progress: 70,
        });
      }

      if (response.data.conversation.tutor) {
        const tutorName = response.data.conversation.tutor.user?.name || 'a tutor';
        toast.success(`Your question has been sent to ${tutorName}!`);
        setShowProcessingModal(false);
        navigate(`/conversations/${response.data.conversation.id}`);
      } else {
        setProcessingStatus({
          status: 'WAITING_FOR_TUTOR',
          message: 'Finding the best tutor for you...',
          progress: 85,
        });
        
        setTimeout(() => {
          if (pendingConversationRef.current) {
            setShowProcessingModal(false);
            navigate(`/conversations/${pendingConversationRef.current}`);
          }
        }, 10000);
      }
    } catch (error: unknown) {
      console.error('Failed to send audio:', error);
      setShowProcessingModal(false);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to send audio. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setQuestion(prompt);
  };

  // Determine theme classes based on auth state
  const isDormant = !isAuthenticated;

  return (
    <div className={`min-h-screen transition-all duration-700 ${
      isDormant 
        ? 'bg-[#1a1a1a]' 
        : 'bg-gradient-to-br from-primary-50 via-white to-emerald-50'
    }`}>
      
      {/* Animated Background - Only visible when active */}
      {!isDormant && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 -left-4 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob" />
          <div className="absolute top-40 -right-4 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob animation-delay-4000" />
        </div>
      )}

      {/* Dormant grid pattern */}
      {isDormant && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          {/* Subtle glow effect */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-gray-800/30 to-transparent rounded-full blur-3xl" />
        </div>
      )}

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-40 border-b transition-colors duration-500 ${
        isDormant 
          ? 'bg-[#1a1a1a]/90 border-gray-800 backdrop-blur-sm' 
          : 'bg-white/90 border-gray-200 backdrop-blur-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${
              isDormant 
                ? 'bg-gray-700' 
                : 'bg-gradient-to-br from-primary-500 to-emerald-500'
            }`}>
              <BookOpen className={`w-4 h-4 ${isDormant ? 'text-gray-400' : 'text-white'}`} />
            </div>
            <span className={`font-bold text-lg ${isDormant ? 'text-gray-300' : 'text-gray-900'}`}>
              Top Tutors
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link 
                to="/dashboard/student" 
                className="btn-primary btn-sm flex items-center gap-2"
              >
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className={`text-sm font-medium transition-colors ${
                    isDormant ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sign in
                </Link>
                <Link 
                  to="/register" 
                  className={`text-sm font-semibold px-4 py-2 rounded transition-all ${
                    isDormant 
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 pt-20 pb-8">
        {/* Hero Text */}
        <div className="text-center mb-8 mt-8">
          {isDormant && !hasFreeQueryUsed && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 ${
              isDormant ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' : 'bg-primary-100 text-primary-700'
            }`}>
              <Sparkles className="w-3 h-3" />
              <span>Try one question free — no signup required</span>
            </div>
          )}
          
          {isDormant && hasFreeQueryUsed && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-900/50 text-amber-400 border border-amber-800 rounded-full text-xs font-medium mb-6">
              <Lock className="w-3 h-3" />
              <span>Sign up to continue asking questions</span>
            </div>
          )}

          {isAuthenticated && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium mb-6">
              <Zap className="w-3 h-3" />
              <span>Welcome back, {user?.name?.split(' ')[0] || 'Student'}!</span>
            </div>
          )}
          
          <h1 className={`text-4xl md:text-5xl lg:text-6xl font-black mb-4 transition-colors duration-500 ${
            isDormant ? 'text-gray-100' : 'text-gray-900'
          }`}>
            {isDormant ? (
              <>What do you need<br /><span className="text-gray-500">help with?</span></>
            ) : (
              <>What do you need<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-emerald-500">
                help with?
              </span></>
            )}
          </h1>
          
          <p className={`text-lg max-w-md mx-auto transition-colors duration-500 ${
            isDormant ? 'text-gray-500' : 'text-gray-600'
          }`}>
            Ask any academic question and get matched with an expert tutor instantly.
          </p>
        </div>

        {/* Chat Input */}
        <div className="w-full max-w-2xl mb-8">
          {/* Recording State */}
          {isRecording && (
            <div className={`rounded-2xl p-6 text-center mb-4 border ${
              isDormant 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200 shadow-lg'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
                <span className={`text-lg font-medium ${isDormant ? 'text-gray-200' : 'text-gray-900'}`}>
                  {isPaused ? 'Paused' : 'Recording...'}
                </span>
              </div>

              <div className={`text-4xl font-mono font-bold mb-6 ${isDormant ? 'text-gray-200' : 'text-gray-900'}`}>
                {formatDuration(duration)}
              </div>

              {/* Waveform */}
              <div className="flex items-center justify-center gap-1 h-12 mb-6">
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      isDormant ? 'bg-red-500/70' : 'bg-red-400'
                    }`}
                    style={{
                      height: isPaused ? '8px' : `${Math.random() * 32 + 8}px`,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className={`p-3 rounded-full ${
                    isDormant ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleStopRecording}
                  className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <div className="w-5 h-5 bg-white rounded" />
                </button>
                <button
                  onClick={handleCancelAudio}
                  className={`p-3 rounded-full ${
                    isDormant ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Audio Review State */}
          {audioUrl && !isRecording && (
            <div className={`rounded-2xl p-6 mb-4 border ${
              isDormant 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200 shadow-lg'
            }`}>
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
              
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={togglePlayback}
                  className={`p-4 rounded-full ${
                    isDormant 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                <div className={`text-left ${isDormant ? 'text-gray-300' : 'text-gray-900'}`}>
                  <p className="font-medium">Voice Recording</p>
                  <p className={`text-sm ${isDormant ? 'text-gray-500' : 'text-gray-500'}`}>
                    {formatDuration(duration)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleCancelAudio}
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isDormant 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  } disabled:opacity-50`}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => {
                    resetRecording();
                    startRecording();
                  }}
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isDormant 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  } disabled:opacity-50`}
                >
                  <Mic className="w-4 h-4" />
                  Re-record
                </button>
                <button
                  onClick={handleAudioSubmit}
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all ${
                    isDormant 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  } disabled:opacity-50`}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Text Input */}
          {!isRecording && !audioUrl && (
            <form onSubmit={handleTextSubmit}>
              <div className={`relative rounded-2xl border transition-all duration-300 ${
                isDormant 
                  ? 'bg-gray-900 border-gray-700 focus-within:border-gray-600 focus-within:ring-1 focus-within:ring-gray-600' 
                  : 'bg-white border-gray-200 shadow-lg focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-100'
              }`}>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                  placeholder="Ask any question about Math, Physics, Chemistry, or any subject..."
                  rows={3}
                  disabled={isSubmitting}
                  className={`w-full p-4 pb-14 bg-transparent resize-none focus:outline-none text-base ${
                    isDormant 
                      ? 'text-gray-200 placeholder-gray-600' 
                      : 'text-gray-900 placeholder-gray-400'
                  }`}
                />
                
                {/* Input Actions */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAudioClick}
                      disabled={isSubmitting}
                      className={`p-2 rounded-lg transition-colors ${
                        isDormant 
                          ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      } disabled:opacity-50`}
                      title={isAuthenticated ? "Record voice message" : "Sign in to use voice messages"}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    {!isAuthenticated && (
                      <span className={`text-xs ${isDormant ? 'text-gray-600' : 'text-gray-400'}`}>
                        <Lock className="w-3 h-3 inline mr-1" />
                        Voice requires login
                      </span>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !question.trim()}
                    className={`p-2 rounded-lg transition-all ${
                      question.trim()
                        ? isDormant
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-primary-500 text-white hover:bg-primary-600'
                        : isDormant
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Suggestions */}
          {!isRecording && !audioUrl && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {suggestionPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(prompt)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    isDormant 
                      ? 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300 hover:bg-gray-800/50' 
                      : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className={`relative max-w-md w-full mx-4 p-8 rounded-2xl ${
            isDormant ? 'bg-gray-900 border border-gray-800' : 'bg-white shadow-2xl'
          }`}>
            <button
              onClick={() => setShowLoginModal(false)}
              className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
                isDormant ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                isDormant ? 'bg-emerald-900/50' : 'bg-primary-100'
              }`}>
                <Lock className={`w-8 h-8 ${isDormant ? 'text-emerald-400' : 'text-primary-600'}`} />
              </div>
              
              <h3 className={`text-xl font-bold mb-2 ${isDormant ? 'text-gray-100' : 'text-gray-900'}`}>
                {loginModalReason === 'audio' 
                  ? 'Voice Messages Require Login'
                  : 'You\'ve Used Your Free Question'
                }
              </h3>
              
              <p className={`${isDormant ? 'text-gray-400' : 'text-gray-600'}`}>
                {loginModalReason === 'audio'
                  ? 'Create a free account to use voice messages and unlock unlimited questions.'
                  : 'Create a free account to continue asking unlimited questions and get matched with expert tutors.'
                }
              </p>
            </div>
            
            <div className="space-y-3">
              <Link
                to="/register"
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                  isDormant 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
              
              <Link
                to="/login"
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium border transition-colors ${
                  isDormant 
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Processing Modal */}
      {showProcessingModal && processingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className={`p-8 max-w-md w-full mx-4 rounded-2xl text-center ${
            isDormant ? 'bg-gray-900 border border-gray-800' : 'bg-white shadow-2xl'
          }`}>
            {/* Status Icon */}
            <div className="mb-6">
              {processingStatus.status === 'ALL_TUTORS_BUSY' ? (
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  isDormant ? 'bg-amber-900/50' : 'bg-amber-100'
                }`}>
                  <AlertCircle className={`w-8 h-8 ${isDormant ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
              ) : processingStatus.status === 'TUTOR_ASSIGNED' ? (
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  isDormant ? 'bg-emerald-900/50' : 'bg-green-100'
                }`}>
                  <CheckCircle className={`w-8 h-8 ${isDormant ? 'text-emerald-400' : 'text-green-600'}`} />
                </div>
              ) : (
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  isDormant ? 'bg-emerald-900/50' : 'bg-primary-100'
                }`}>
                  <Loader2 className={`w-8 h-8 animate-spin ${isDormant ? 'text-emerald-400' : 'text-primary-600'}`} />
                </div>
              )}
            </div>

            {/* Status Message */}
            <h3 className={`text-lg font-semibold mb-2 ${isDormant ? 'text-gray-100' : 'text-gray-900'}`}>
              {processingStatus.status === 'RECEIVING' && 'Sending your question...'}
              {processingStatus.status === 'TRANSCRIBING' && 'Transcribing audio...'}
              {processingStatus.status === 'CLASSIFYING' && 'Analyzing your question...'}
              {processingStatus.status === 'CREATING_CONVERSATION' && 'Creating conversation...'}
              {processingStatus.status === 'NOTIFYING_TUTORS' && 'Finding tutors...'}
              {processingStatus.status === 'WAITING_FOR_TUTOR' && 'Waiting for tutor...'}
              {processingStatus.status === 'TUTOR_ASSIGNED' && 'Tutor found!'}
              {processingStatus.status === 'ALL_TUTORS_BUSY' && 'All tutors are busy'}
            </h3>
            <p className={`mb-6 ${isDormant ? 'text-gray-400' : 'text-gray-600'}`}>
              {processingStatus.message}
            </p>

            {/* Progress Bar */}
            <div className={`w-full rounded-full h-2 mb-4 ${isDormant ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  processingStatus.status === 'ALL_TUTORS_BUSY' 
                    ? 'bg-amber-500' 
                    : processingStatus.status === 'TUTOR_ASSIGNED'
                      ? 'bg-green-500'
                      : isDormant ? 'bg-emerald-500' : 'bg-primary-500'
                }`}
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>

            {/* Status specific content */}
            {processingStatus.status === 'WAITING_FOR_TUTOR' && (
              <div className={`flex items-center justify-center gap-2 text-sm ${isDormant ? 'text-gray-500' : 'text-gray-500'}`}>
                <Clock className="w-4 h-4" />
                <span>This usually takes a few seconds...</span>
              </div>
            )}

            {processingStatus.status === 'ALL_TUTORS_BUSY' && (
              <button
                onClick={() => {
                  setShowProcessingModal(false);
                  if (pendingConversationRef.current) {
                    navigate(`/conversations/${pendingConversationRef.current}`);
                  }
                }}
                className={`mt-4 px-6 py-2 rounded-lg font-medium border transition-colors ${
                  isDormant 
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Continue to chat anyway
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Landing;
