import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Send, Mic, Sparkles, MessageSquare, Clock, Loader2, 
  Play, Pause, X, Trash2, UserCheck, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus, MessageType, TutorAssignedEvent, AllTutorsBusyEvent, ProcessingStatusEvent } from '../../types';
import { useStudentNotifications } from '../../hooks/useSocket';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import toast from 'react-hot-toast';

const suggestionPrompts = [
  "How do I solve quadratic equations?",
  "Explain Newton's laws of motion",
  "Help me understand photosynthesis",
  "What's the difference between mitosis and meiosis?",
  "Explain the concept of derivatives",
  "Help with essay structure",
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // Audio recording
  const [isAudioMode, setIsAudioMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const {
    isRecording,
    isPaused,
    duration,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAudioFile,
  } = useAudioRecorder(300);

  // Processing state
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusEvent | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const pendingConversationRef = useRef<string | null>(null);

  // Fetch recent conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await messagesApi.getConversations(1, 5);
      setRecentConversations(response.data.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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

  useStudentNotifications({
    onProcessingStatus: handleProcessingStatus,
    onTutorAssigned: handleTutorAssigned,
    onAllTutorsBusy: handleAllTutorsBusy,
  });

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

  const handleAudioClick = () => {
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

  const handleSuggestionClick = (prompt: string) => {
    setQuestion(prompt);
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-[#212121] flex flex-col">
      {/* Main Content - Centered Query Interface */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        {/* Greeting */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-[#e8dcc4] mb-1">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-gray-400 text-base">How can I help you today?</p>
        </div>

        {/* Query Input */}
        <div className="w-full max-w-xl mb-6">
          {/* Recording State */}
          {isRecording && (
            <div className="bg-gray-800/50 rounded-xl p-4 text-center mb-3 border border-gray-700/50">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium text-white">
                  {isPaused ? 'Paused' : 'Recording...'}
                </span>
              </div>

              <div className="text-2xl font-mono font-bold text-white mb-4">
                {formatDuration(duration)}
              </div>

              {/* Waveform */}
              <div className="flex items-center justify-center gap-0.5 h-8 mb-4">
                {[...Array(24)].map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-red-400/70 transition-all duration-100"
                    style={{
                      height: isPaused ? '6px' : `${Math.random() * 24 + 6}px`,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className="p-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleStopRecording}
                  className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <div className="w-4 h-4 bg-white rounded" />
                </button>
                <button
                  onClick={handleCancelAudio}
                  className="p-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Audio Review State */}
          {audioUrl && !isRecording && (
            <div className="bg-gray-800/50 rounded-xl p-4 mb-3 border border-gray-700/50">
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
              
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={togglePlayback}
                  className="p-3 bg-amber-500 text-black rounded-full hover:bg-amber-400"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="text-left text-white">
                  <p className="text-sm font-medium">Voice Recording</p>
                  <p className="text-xs text-gray-400">{formatDuration(duration)}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleCancelAudio}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  onClick={() => {
                    resetRecording();
                    startRecording();
                  }}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Re-record
                </button>
                <button
                  onClick={handleAudioSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Text Input */}
          {!isRecording && !audioUrl && (
            <form onSubmit={handleTextSubmit}>
              <div className="relative bg-gray-800/50 rounded-xl border border-gray-700/50 focus-within:border-amber-500/50 transition-all">
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
                  rows={2}
                  disabled={isSubmitting}
                  className="w-full p-3 pb-12 bg-transparent resize-none focus:outline-none text-sm text-white placeholder-gray-500"
                />
                
                {/* Input Actions */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleAudioClick}
                      disabled={isSubmitting}
                      className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50"
                      title="Record voice message"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !question.trim()}
                    className={`p-2 rounded-lg transition-all ${
                      question.trim()
                        ? 'bg-amber-500 text-black hover:bg-amber-400'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Suggestions */}
          {!isRecording && !audioUrl && (
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {suggestionPrompts.slice(0, 4).map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="px-2.5 py-1 text-xs text-gray-400 border border-gray-700 rounded-full hover:border-amber-500/50 hover:text-amber-400 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Conversations - Bottom Section */}
      {recentConversations.length > 0 && (
        <div className="px-4 pb-6">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-gray-400">Recent Conversations</h2>
              <Link to="/conversations" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5">
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recentConversations.slice(0, 4).map((conv) => (
                <Link
                  key={conv.id}
                  to={`/conversations/${conv.id}`}
                  className="flex items-center gap-2.5 p-2.5 bg-gray-800/30 border border-gray-700/50 rounded-lg hover:bg-gray-800/50 hover:border-gray-600/50 transition-all group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    conv.status === ConversationStatus.ACTIVE || conv.status === ConversationStatus.ASSIGNED
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : conv.status === ConversationStatus.PENDING
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-gray-700/50 text-gray-400'
                  }`}>
                    {conv.status === ConversationStatus.PENDING ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate group-hover:text-amber-100">
                      {conv.topic || conv.messages[0]?.content?.slice(0, 35) || 'New conversation'}...
                    </p>
                    <p className="text-xs text-gray-500">
                      {conv.subject.replace('_', ' ')} • {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Processing Modal */}
      {showProcessingModal && processingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center border border-gray-700">
            <div className="mb-4">
              {processingStatus.status === 'ALL_TUTORS_BUSY' ? (
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
              ) : processingStatus.status === 'TUTOR_ASSIGNED' ? (
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <UserCheck className="w-6 h-6 text-emerald-400" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              )}
            </div>

            <h3 className="text-sm font-semibold text-white mb-1">
              {processingStatus.status === 'RECEIVING' && 'Sending your question...'}
              {processingStatus.status === 'TRANSCRIBING' && 'Transcribing audio...'}
              {processingStatus.status === 'CLASSIFYING' && 'Analyzing your question...'}
              {processingStatus.status === 'CREATING_CONVERSATION' && 'Creating conversation...'}
              {processingStatus.status === 'NOTIFYING_TUTORS' && 'Finding tutors...'}
              {processingStatus.status === 'WAITING_FOR_TUTOR' && 'Waiting for tutor...'}
              {processingStatus.status === 'TUTOR_ASSIGNED' && 'Tutor found!'}
              {processingStatus.status === 'ALL_TUTORS_BUSY' && 'All tutors are busy'}
            </h3>
            <p className="text-gray-400 text-xs mb-4">{processingStatus.message}</p>

            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
              <div 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  processingStatus.status === 'ALL_TUTORS_BUSY' 
                    ? 'bg-amber-500' 
                    : processingStatus.status === 'TUTOR_ASSIGNED'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                }`}
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>

            {processingStatus.status === 'ALL_TUTORS_BUSY' && (
              <button
                onClick={() => {
                  setShowProcessingModal(false);
                  if (pendingConversationRef.current) {
                    navigate(`/conversations/${pendingConversationRef.current}`);
                  }
                }}
                className="mt-3 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
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

export default StudentDashboard;
