import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Lightbulb, ArrowLeft, Mic, Paperclip, X, Loader2, Play, Pause, Trash2, CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { messagesApi } from '../api';
import { MessageType, ProcessingStatusEvent, TutorAssignedEvent, AllTutorsBusyEvent, TutorAvailabilityUpdate, TutorAcceptedEvent } from '../types';
import Button from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useStudentNotifications } from '../hooks/useSocket';
import toast from 'react-hot-toast';

const questionTips = [
  'Be specific about what you need help with',
  'Include any relevant context or background',
  'Mention what you\'ve already tried',
  'Share any error messages or results',
];

type InputMode = 'text' | 'audio' | 'recording';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AskQuestion() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing status state
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusEvent | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const pendingConversationRef = useRef<string | null>(null);
  
  // Waiting queue state
  const [waitingQueueInfo, setWaitingQueueInfo] = useState<{
    shortestWaitMinutes?: number;
    message?: string;
    tutorResponses?: Array<{ tutorName: string; minutesUntilFree: number }>;
  } | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

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

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle processing status updates from backend
  const handleProcessingStatus = useCallback((data: ProcessingStatusEvent) => {
    console.log('[AskQuestion] Processing status:', data);
    setProcessingStatus(data);
  }, []);

  // Handle tutor assigned
  const handleTutorAssigned = useCallback((data: TutorAssignedEvent) => {
    console.log('[AskQuestion] Tutor assigned:', data);
    setShowProcessingModal(false);
    setIsSubmitting(false);
    toast.success(`${data.tutor.name} is ready to help you!`);
    navigate(`/conversations/${data.conversationId}`);
  }, [navigate]);

  // Handle all tutors busy
  const handleAllTutorsBusy = useCallback((data: AllTutorsBusyEvent) => {
    console.log('[AskQuestion] All tutors busy:', data);
    setProcessingStatus({
      status: 'ALL_TUTORS_BUSY',
      message: data.message,
      progress: 100,
    });
    toast.error(data.message);
  }, []);

  // Handle tutor availability update (waiting queue)
  const handleTutorAvailabilityUpdate = useCallback((data: TutorAvailabilityUpdate) => {
    console.log('[AskQuestion] Tutor availability update:', data);
    setWaitingQueueInfo({
      shortestWaitMinutes: data.shortestWaitMinutes,
      message: data.message,
      tutorResponses: data.tutorResponses,
    });
    
    // Start countdown timer
    if (data.shortestWaitMinutes) {
      setCountdownSeconds(data.shortestWaitMinutes * 60);
    }
    
    // Update processing status
    setProcessingStatus({
      status: 'WAITING_FOR_TUTOR',
      message: data.message || `A tutor will be available in ~${data.shortestWaitMinutes} minutes`,
      progress: 85,
    });
    
    toast.success(data.message, { duration: 5000 });
  }, []);

  // Handle tutor accepted (from waiting queue)
  const handleTutorAccepted = useCallback((data: TutorAcceptedEvent) => {
    console.log('[AskQuestion] Tutor accepted:', data);
    setShowProcessingModal(false);
    setIsSubmitting(false);
    setWaitingQueueInfo(null);
    setCountdownSeconds(null);
    toast.success(`${data.tutorName} is ready to help you!`);
    navigate(`/conversations/${data.conversationId}`);
  }, [navigate]);

  // Subscribe to student notifications
  useStudentNotifications({
    onProcessingStatus: handleProcessingStatus,
    onTutorAssigned: handleTutorAssigned,
    onAllTutorsBusy: handleAllTutorsBusy,
    onTutorAvailabilityUpdate: handleTutorAvailabilityUpdate,
    onTutorAccepted: handleTutorAccepted,
  });

  // Countdown timer effect
  useEffect(() => {
    if (countdownSeconds === null || countdownSeconds <= 0) return;
    
    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [countdownSeconds]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      // If conversation already has a tutor, navigate immediately
      if (response.data.conversation.tutor) {
        const tutorName = response.data.conversation.tutor.user?.name || 'a tutor';
        toast.success(`Your question has been sent to ${tutorName}!`);
        setShowProcessingModal(false);
        navigate(`/conversations/${response.data.conversation.id}`);
      } else {
        // Wait for tutor assignment via WebSocket
        setProcessingStatus({
          status: 'WAITING_FOR_TUTOR',
          message: 'Waiting for an available tutor...',
          progress: 80,
        });
        
        // Set a timeout to navigate anyway after 10 seconds
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

  const handleAudioSubmit = async () => {
    let audioFile: File | null = null;

    if (uploadedAudio) {
      audioFile = uploadedAudio;
    } else if (audioUrl) {
      audioFile = getAudioFile();
    }

    if (!audioFile) {
      toast.error('No audio to send');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
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
          setUploadProgress(progress);
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

      // Show classification info
      if (response.data.classification) {
        const { subject, topic, transcription } = response.data.classification;
        setProcessingStatus({
          status: 'CLASSIFYING',
          message: `Detected: ${subject.replace('_', ' ')}${topic ? ` - ${topic}` : ''}`,
          progress: 70,
        });
      }

      // If conversation already has a tutor, navigate immediately
      if (response.data.conversation.tutor) {
        const tutorName = response.data.conversation.tutor.user?.name || 'a tutor';
        toast.success(`Your question has been sent to ${tutorName}!`);
        setShowProcessingModal(false);
        navigate(`/conversations/${response.data.conversation.id}`);
      } else {
        // Wait for tutor assignment via WebSocket
        setProcessingStatus({
          status: 'WAITING_FOR_TUTOR',
          message: 'Finding the best tutor for you...',
          progress: 85,
        });
        
        // Set a timeout to navigate anyway after 10 seconds
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
    } finally {
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Audio file must be less than 25MB');
      return;
    }

    setUploadedAudio(file);
    setInputMode('audio');
    resetRecording();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartRecording = () => {
    setUploadedAudio(null);
    setInputMode('recording');
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    setInputMode('audio');
  };

  const handleCancelAudio = () => {
    resetRecording();
    setUploadedAudio(null);
    setInputMode('text');
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ask a Question
          </h1>
          <p className="text-gray-600">
            Type your question or record a voice message — we'll match you with the best tutor.
          </p>
        </div>

        {/* Input Type Toggle */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setInputMode('text')}
              disabled={isRecording}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded transition-colors ${
                inputMode === 'text'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              📝 Text
            </button>
            <button
              onClick={handleStartRecording}
              disabled={isSubmitting}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded transition-colors ${
                inputMode === 'recording' || (inputMode === 'audio' && !uploadedAudio)
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              🎤 Voice
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Text Input Mode */}
          {inputMode === 'text' && (
            <form onSubmit={handleTextSubmit}>
              <Textarea
                label="Your Question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Example: I'm having trouble understanding how to solve quadratic equations using the quadratic formula..."
                className="min-h-[200px]"
              />
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    {question.length} characters
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <Paperclip className="w-3 h-3" />
                    Upload audio instead
                  </button>
                </div>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Question
                </Button>
              </div>
            </form>
          )}

          {/* Recording Mode */}
          {inputMode === 'recording' && isRecording && (
            <div className="text-center py-8">
              {recorderError ? (
                <div className="text-red-600 mb-4">{recorderError}</div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                    <span className="text-lg font-medium text-gray-900">
                      {isPaused ? 'Paused' : 'Recording...'}
                    </span>
                  </div>

                  <div className="text-4xl font-mono font-bold text-gray-900 mb-6">
                    {formatDuration(duration)}
                  </div>

                  {/* Waveform visualization */}
                  <div className="flex items-center justify-center gap-1 h-16 mb-6">
                    {[...Array(30)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 bg-red-400 rounded-full transition-all duration-100`}
                        style={{
                          height: isPaused ? '8px' : `${Math.random() * 40 + 16}px`,
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className="p-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    >
                      {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={handleStopRecording}
                      className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <div className="w-6 h-6 bg-white rounded" />
                    </button>
                    <button
                      onClick={handleCancelAudio}
                      className="p-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Audio Review Mode */}
          {inputMode === 'audio' && (audioUrl || uploadedAudio) && (
            <div className="py-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex items-center gap-3 p-4 bg-gray-100 rounded-lg">
                  {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
                  
                  <button
                    onClick={togglePlayback}
                    className="p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  
                  <div className="text-left">
                    <p className="font-medium text-gray-900">
                      {uploadedAudio ? uploadedAudio.name : 'Voice Recording'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {uploadedAudio 
                        ? `${(uploadedAudio.size / 1024 / 1024).toFixed(2)} MB`
                        : formatDuration(duration)
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload progress */}
              {isSubmitting && uploadProgress > 0 && (
                <div className="mb-6">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleCancelAudio}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleStartRecording}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                  Re-record
                </button>
                <Button
                  onClick={handleAudioSubmit}
                  isLoading={isSubmitting}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Voice Message
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-primary-900 mb-2">Tips for a great question</h3>
              <ul className="space-y-1">
                {questionTips.map((tip, index) => (
                  <li key={index} className="text-sm text-primary-800 flex items-start gap-2">
                    <span className="text-primary-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-primary-700 mt-3">
                <strong>Voice messages:</strong> Speak naturally in any language — our AI will transcribe and understand your question!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Modal */}
      {showProcessingModal && processingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            {/* Status Icon */}
            <div className="mb-6">
              {processingStatus.status === 'ALL_TUTORS_BUSY' ? (
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
              ) : processingStatus.status === 'TUTOR_ASSIGNED' ? (
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>
              )}
            </div>

            {/* Status Message */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {processingStatus.status === 'RECEIVING' && 'Sending your question...'}
              {processingStatus.status === 'TRANSCRIBING' && 'Transcribing audio...'}
              {processingStatus.status === 'CLASSIFYING' && 'Analyzing your question...'}
              {processingStatus.status === 'CREATING_CONVERSATION' && 'Creating conversation...'}
              {processingStatus.status === 'NOTIFYING_TUTORS' && 'Finding tutors...'}
              {processingStatus.status === 'WAITING_FOR_TUTOR' && 'Waiting for tutor...'}
              {processingStatus.status === 'TUTOR_ASSIGNED' && 'Tutor found!'}
              {processingStatus.status === 'ALL_TUTORS_BUSY' && 'All tutors are busy'}
            </h3>
            <p className="text-gray-600 mb-6">{processingStatus.message}</p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  processingStatus.status === 'ALL_TUTORS_BUSY' 
                    ? 'bg-amber-500' 
                    : processingStatus.status === 'TUTOR_ASSIGNED'
                      ? 'bg-green-500'
                      : 'bg-primary-500'
                }`}
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>

            {/* Status specific content */}
            {processingStatus.status === 'WAITING_FOR_TUTOR' && (
              <div className="space-y-3">
                {waitingQueueInfo?.shortestWaitMinutes && countdownSeconds !== null && countdownSeconds > 0 ? (
                  <>
                    {/* Countdown Timer */}
                    <div className="flex items-center justify-center gap-3 py-3 bg-gray-50 rounded-lg">
                      <Clock className="w-5 h-5 text-primary-500" />
                      <div className="text-center">
                        <div className="text-2xl font-mono font-bold text-primary-600">
                          {Math.floor(countdownSeconds / 60)}:{(countdownSeconds % 60).toString().padStart(2, '0')}
                        </div>
                        <div className="text-xs text-gray-500">Estimated wait time</div>
                      </div>
                    </div>
                    
                    {/* Tutor Responses */}
                    {waitingQueueInfo.tutorResponses && waitingQueueInfo.tutorResponses.length > 0 && (
                      <div className="text-left bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <Users className="w-3.5 h-3.5" />
                          <span>Tutors responding:</span>
                        </div>
                        <div className="space-y-1">
                          {waitingQueueInfo.tutorResponses.slice(0, 3).map((tutor, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{tutor.tutorName}</span>
                              <span className="text-gray-500">~{tutor.minutesUntilFree} min</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Finding available tutors...</span>
                  </div>
                )}
              </div>
            )}

            {processingStatus.status === 'ALL_TUTORS_BUSY' && (
              <Button
                variant="secondary"
                onClick={() => {
                  setShowProcessingModal(false);
                  if (pendingConversationRef.current) {
                    navigate(`/conversations/${pendingConversationRef.current}`);
                  }
                }}
                className="mt-4"
              >
                Continue to chat anyway
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AskQuestion;
