import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Send, Mic, Sparkles, Loader2, 
  Play, Pause, X, Trash2, FileText,
  ThumbsUp, ThumbsDown, RotateCcw, UserPlus,
  StopCircle, Paperclip
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { geminiChatApi, tutorSessionApi } from '../../api';
import { AIMessage, DailyRoom } from '../../types';
import { useGeminiChat } from '../../hooks/useGeminiChat';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { TutorSessionPanel, StudentActiveSession } from '../../components/tutorSession';
import {
  connectTutorSessionSocket,
  disconnectTutorSessionSocket,
  subscribeToAISession,
  joinSession,
  getChatHistory,
  getWhiteboardData,
  sendChatMessage,
  onTutorSessionSocketConnect,
  getTutorSessionSocket,
} from '../../services/tutorSessionSocket';
import {
  getSocket,
} from '../../services/socket';
import {
  getGeminiSocket,
  onTutorAccepted,
  offTutorAccepted,
  onSessionStatusChanged,
  offSessionStatusChanged,
} from '../../services/geminiSocket';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const suggestionPrompts = [
  "Explain quantum entanglement simply",
  "How do I solve quadratic equations?",
  "Help me understand photosynthesis",
  "What's the difference between mitosis and meiosis?",
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Message component with markdown rendering
interface MessageBubbleProps {
  message: AIMessage;
  isStreaming?: boolean;
  streamingContent?: string;
  onRetry?: () => void;
  onFeedback?: (feedback: 'GOOD' | 'BAD') => void;
}

function MessageBubble({ message, isStreaming, streamingContent, onRetry, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === 'USER';
  const content = isStreaming ? streamingContent : message.content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`${isUser ? 'max-w-[85%]' : 'max-w-[90%]'}`}>
        {/* AI label */}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-400">AI Tutor</span>
          </div>
        )}
        
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[#2a2a2a] text-gray-100 border border-gray-700/50'
              : 'bg-transparent text-gray-100'
          }`}
        >
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type.startsWith('image/') ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 rounded-lg">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-sm truncate max-w-[150px]">{att.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Audio message */}
          {message.audioUrl && (
            <div className="mb-2">
              <audio src={message.audioUrl} controls className="w-full max-w-[250px]" />
              {message.transcription && (
                <p className="text-xs text-gray-400 mt-1 italic">"{message.transcription}"</p>
              )}
            </div>
          )}

          {/* Message content */}
          {content && (
            <div className={`prose prose-invert prose-sm max-w-none`}>
              {isUser ? (
                <p className="m-0 whitespace-pre-wrap">{content}</p>
              ) : (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => (
                      <pre className="bg-gray-900/50 rounded-lg p-3 overflow-x-auto text-sm">
                        {children}
                      </pre>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-violet-300">{children}</code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-violet-400 ml-1 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Message actions for AI messages */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5">
            {message.hasError ? (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            ) : (
              <>
                <button
                  onClick={() => onFeedback?.('GOOD')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    message.feedback === 'GOOD'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback?.('BAD')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    message.feedback === 'BAD'
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                  title="Bad response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export function StudentDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  // Input state
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  // Active tutor session state
  const [activeTutorSession, setActiveTutorSession] = useState<{
    tutorSessionId: string;
    tutorName: string;
    tutorAvatar?: string;
    dailyRoom?: DailyRoom;
  } | null>(null);
  const [liveSharingEnabled, setLiveSharingEnabled] = useState(false);
  
  // Audio recording
  const [isAudioMode, setIsAudioMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Tutor session panel state
  const [showTutorPanel, setShowTutorPanel] = useState(false);

  // Streaming message state
  const [streamingMessage, setStreamingMessage] = useState<AIMessage | null>(null);

  // Gemini chat hook
  const {
    isStreaming,
    streamingContent,
    sendMessage,
    sendMessageWithAttachments,
    sendAudioMessage,
    retryMessage,
    addFeedback,
  } = useGeminiChat({
    sessionId: currentSessionId || undefined,
    onStreamStart: (messageId, sessionId) => {
      console.log('[StudentDashboard] Stream started:', messageId);
      // Update session ID if it was a new session
      if (!currentSessionId && sessionId) {
        setCurrentSessionId(sessionId);
        setSearchParams({ session: sessionId });
      }
      // Create placeholder streaming message
      setStreamingMessage({
        id: messageId,
        sessionId,
        role: 'ASSISTANT',
        content: '',
        attachments: null,
        audioUrl: null,
        transcription: null,
        isStreaming: true,
        isComplete: false,
        hasError: false,
        errorMessage: null,
        feedback: null,
        createdAt: new Date().toISOString(),
      });
    },
    onStreamEnd: (chunk) => {
      console.log('[StudentDashboard] Stream ended');
      // Add final message to messages (avoid duplicates)
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some((m) => m.id === chunk.messageId)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: chunk.messageId,
            sessionId: chunk.sessionId,
            role: 'ASSISTANT',
            content: chunk.fullContent || '',
            attachments: null,
            audioUrl: null,
            transcription: null,
            isStreaming: false,
            isComplete: true,
            hasError: false,
            errorMessage: null,
            feedback: null,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      setStreamingMessage(null);
    },
    onStreamError: (chunk) => {
      console.error('[StudentDashboard] Stream error:', chunk.error);
      // Add error message to messages (avoid duplicates)
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some((m) => m.id === chunk.messageId)) {
          // Update existing message with error
          return prev.map((m) =>
            m.id === chunk.messageId
              ? { ...m, hasError: true, errorMessage: chunk.error || 'Unknown error' }
              : m
          );
        }
        return [
          ...prev,
          {
            id: chunk.messageId,
            sessionId: chunk.sessionId,
            role: 'ASSISTANT',
            content: streamingContent || 'Failed to generate response',
            attachments: null,
            audioUrl: null,
            transcription: null,
            isStreaming: false,
            isComplete: false,
            hasError: true,
            errorMessage: chunk.error || 'Unknown error',
            feedback: null,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      setStreamingMessage(null);
    },
    onTutorStatusUpdate: (data) => {
      toast(data.message, { icon: '👋' });
    },
    onTutorConnected: (data) => {
      toast.success(data.message);
    },
    onTutorWaitUpdate: (data) => {
      toast(data.message, { icon: '⏳' });
    },
  });

  // Connect to tutor session socket when we have an AI session OR active tutor session
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const shouldConnect = token && (currentSessionId || activeTutorSession);

    if (!shouldConnect) return;

    console.log('[StudentDashboard] Connecting to tutor session socket, token present:', !!token);
    connectTutorSessionSocket(token);

    // Subscribe to AI session if we have one
    if (currentSessionId) {
      subscribeToAISession(currentSessionId);
    }

    // Join the AI session room on GEMINI socket to receive tutorAccepted
    const geminiSocket = getGeminiSocket();
    if (geminiSocket?.connected && currentSessionId) {
      console.log('[StudentDashboard] Gemini socket connected, joining AI room:', `ai:${currentSessionId}`);
      geminiSocket.emit('joinRoom', `ai:${currentSessionId}`);
    } else if (currentSessionId) {
      console.log('[StudentDashboard] Gemini socket not connected yet');
    }

    return () => {
      // Only disconnect if we're not in an active tutor session
      if (!activeTutorSession) {
        console.log('[StudentDashboard] Disconnecting tutor session socket');
        disconnectTutorSessionSocket();
      }

      // Leave the AI room on Gemini socket
      if (currentSessionId) {
        const geminiSocket = getGeminiSocket();
        if (geminiSocket?.connected) {
          geminiSocket.emit('leaveRoom', `ai:${currentSessionId}`);
        }
      }
    };
  }, [currentSessionId, activeTutorSession]);

  // Listen for tutor accepted event on gemini socket
  useEffect(() => {
    console.log('[StudentDashboard] Setting up tutorAccepted listener on gemini socket');

    const handleTutorAccepted = async (data: any) => {
      console.log('[StudentDashboard] Tutor accepted event received:', data);

      // Close tutor panel
      setShowTutorPanel(false);

      // Handle the event data
      if (data.tutorSessionId && data.tutor) {
        console.log('[StudentDashboard] Setting up tutor session');
        setActiveTutorSession({
          tutorSessionId: data.tutorSessionId,
          tutorName: data.tutor.name,
          tutorAvatar: data.tutor.avatar,
        });
        // Only show toast on student side - tutor side shows its own notification
        toast.success(`🎉 ${data.tutor.name} connected! Starting video call...`);

        // Get room token for student and join session
        try {
          console.log('[StudentDashboard] Getting room token for session:', data.tutorSessionId);
          const response = await tutorSessionApi.getStudentRoomToken(data.tutorSessionId);
          console.log('[StudentDashboard] Room token response:', response);
          setActiveTutorSession(prev => prev ? {
            ...prev,
            dailyRoom: response.data,
          } : null);

          // Try to join session and load data immediately, with retry logic
          const setupSession = () => {
            console.log('[StudentDashboard] Setting up session:', data.tutorSessionId);
            joinSession(data.tutorSessionId);
            getChatHistory(data.tutorSessionId);
            getWhiteboardData(data.tutorSessionId);
          };

          // Try immediately
          setupSession();

          // Also set up a listener in case socket connects later
          let unsubscribe: (() => void) | null = null;
          unsubscribe = onTutorSessionSocketConnect(() => {
            console.log('[StudentDashboard] Socket connected later, re-setting up session');
            setupSession();
            if (unsubscribe) {
              unsubscribe(); // Remove listener after first connection
            }
          });

          // Retry after a delay in case socket wasn't ready
          setTimeout(() => {
            console.log('[StudentDashboard] Retrying session setup');
            setupSession();
          }, 2000);

          console.log('[StudentDashboard] Session setup initiated');
        } catch (error: any) {
          console.error('[StudentDashboard] Failed to setup session:', error);
          console.error('[StudentDashboard] Error details:', error?.response?.data || error?.message);
          toast.error(`Session setup failed: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
        }
      } else {
        console.log('[StudentDashboard] Incomplete event data:', data);
        toast.error('Invalid session data received');
      }
    };

    const handleSessionStatusChanged = (data: any) => {
      console.log('[StudentDashboard] Session status changed:', data);
      if (data.sessionId === activeTutorSession?.tutorSessionId) {
        // Handle session status changes (COMPLETED, CANCELLED, etc.)
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
          setActiveTutorSession(null);
          toast('Session has ended');
        }
      }
    };

    // Set up listeners on gemini socket
    onTutorAccepted(handleTutorAccepted);
    onSessionStatusChanged(handleSessionStatusChanged);

    return () => {
      offTutorAccepted();
      offSessionStatusChanged();
    };
  }, [activeTutorSession?.tutorSessionId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 🚨 EMERGENCY TEST FUNCTIONS
  useEffect(() => {
    // Global test function
    (window as any).FORCE_TUTOR_ACCEPTED = (data: any = {}) => {
      console.log('[EMERGENCY] Forcing tutor accepted event');
      const eventData = {
        tutorSessionId: data.tutorSessionId || 'emergency-' + Date.now(),
        tutor: {
          id: 'tutor-123',
          name: data.tutorName || 'Emergency Tutor',
          avatar: data.tutorAvatar || null
        },
        ...data
      };

      setShowTutorPanel(false);
      setActiveTutorSession({
        tutorSessionId: eventData.tutorSessionId,
        tutorName: eventData.tutor.name,
        tutorAvatar: eventData.tutor.avatar,
      });
      toast.success(`🚨 EMERGENCY: ${eventData.tutor.name} connected!`);
      console.log('[EMERGENCY] UI should update now');
    };

    // Check socket status
    (window as any).CHECK_SOCKET = () => {
      const socket = getSocket();
      console.log('[EMERGENCY] Regular socket status:', {
        connected: socket?.connected,
        id: socket?.id,
        rooms: (socket as any)?.rooms
      });

      // Also check Gemini socket
      const geminiSocket = getGeminiSocket();
      console.log('[EMERGENCY] Gemini socket status:', {
        connected: geminiSocket?.connected,
        id: geminiSocket?.id,
        rooms: (geminiSocket as any)?.rooms
      });

      return { regular: socket, gemini: geminiSocket };
    };

    // Test backend event emission
    (window as any).TEST_BACKEND_EVENT = async (sessionId?: string) => {
      const targetSessionId = sessionId || currentSessionId;
      console.log('🧪 Testing backend event emission for session:', targetSessionId);

      try {
        const response = await fetch(`http://localhost:3000/api/v1/tutor-session/test-notification/${targetSessionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        console.log('🧪 Backend response:', response.status, result);
        return result;
      } catch (error) {
        console.error('🧪 Backend test failed:', error);
        return { error: (error as Error).message };
      }
    };

    // Test socket events
    (window as any).TEST_SOCKET_EVENTS = () => {
      if (activeTutorSession) {
        console.log('🧪 Testing socket events for session:', activeTutorSession.tutorSessionId);
        joinSession(activeTutorSession.tutorSessionId);
        getChatHistory(activeTutorSession.tutorSessionId);
        getWhiteboardData(activeTutorSession.tutorSessionId);
      } else {
        console.log('🧪 No active tutor session');
      }
    };

    // Test sending chat message
    (window as any).TEST_SEND_CHAT = (message: string) => {
      if (activeTutorSession) {
        console.log('🧪 Sending test chat message:', message);
        sendChatMessage(activeTutorSession.tutorSessionId, message);
      } else {
        console.log('🧪 No active tutor session');
      }
    };

    // Check socket status
    (window as any).CHECK_SOCKET_STATUS = () => {
      const socket = getTutorSessionSocket();
      console.log('🧪 Socket status:', {
        exists: !!socket,
        connected: socket?.connected,
        id: socket?.id,
        rooms: (socket as any)?.rooms
      });
      return socket;
    };

    return () => {
      delete (window as any).FORCE_TUTOR_ACCEPTED;
      delete (window as any).CHECK_SOCKET;
    };
  }, []);

  // Load session from URL or reset for new chat
  useEffect(() => {
    const sessionId = searchParams.get('session');
    
    // Initial load or session changed
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
    } else if (!sessionId && (currentSessionId || !initialLoadDone)) {
      // New chat - reset state
      setCurrentSessionId(null);
      setMessages([]);
      setStreamingMessage(null);
      setShowTutorPanel(false);
    }
    
    if (!initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [searchParams, initialLoadDone]);

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoadingSession(true);
      const response = await geminiChatApi.getSession(sessionId);
      setCurrentSessionId(sessionId);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load session:', error);
      toast.error('Failed to load chat session');
      setSearchParams({});
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Handle text submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if ((!input.trim() && attachments.length === 0) || isSubmitting || isStreaming) {
      return;
    }

    const messageContent = input.trim();
    const files = [...attachments];
    
    // Clear input immediately
    setInput('');
    setAttachments([]);
    setIsSubmitting(true);

    // Add user message to UI immediately
    const tempUserMessage: AIMessage = {
      id: 'temp-' + Date.now(),
      sessionId: currentSessionId || '',
      role: 'USER',
      content: messageContent,
      attachments: files.length > 0 ? files.map((f, i) => ({
        id: 'temp-att-' + i,
        url: URL.createObjectURL(f),
        name: f.name,
        type: f.type,
        size: f.size,
      })) : null,
      audioUrl: null,
      transcription: null,
      isStreaming: false,
      isComplete: true,
      hasError: false,
      errorMessage: null,
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      if (files.length > 0) {
        await sendMessageWithAttachments(files, messageContent, currentSessionId || undefined);
      } else {
        await sendMessage(messageContent, currentSessionId || undefined);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
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
    resetRecording();
    setIsAudioMode(false);

    // Add placeholder user message
    const tempUserMessage: AIMessage = {
      id: 'temp-audio-' + Date.now(),
      sessionId: currentSessionId || '',
      role: 'USER',
      content: '',
      attachments: null,
      audioUrl: URL.createObjectURL(audioFile),
      transcription: null,
      isStreaming: false,
      isComplete: true,
      hasError: false,
      errorMessage: null,
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      await sendAudioMessage(audioFile, currentSessionId || undefined);
    } catch (error) {
      console.error('Failed to send audio:', error);
      toast.error('Failed to send audio message');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => {
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      const isValidSize = f.size <= 20 * 1024 * 1024; // 20MB
      return (isImage || isPdf) && isValidSize;
    });
    
    if (validFiles.length !== files.length) {
      toast.error('Some files were skipped (only images and PDFs under 20MB)');
    }
    
    setAttachments((prev) => [...prev, ...validFiles].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle retry
  const handleRetry = async (messageId: string) => {
    await retryMessage(messageId);
  };

  // Handle feedback
  const handleFeedback = async (messageId: string, feedback: 'GOOD' | 'BAD') => {
    const success = await addFeedback(messageId, feedback);
    if (success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );
    }
  };

  // Handle tutor button click - open tutor session panel
  const handleOpenTutorPanel = () => {
    if (!currentSessionId) {
      toast.error('Please start a conversation first');
      return;
    }
    setShowTutorPanel(true);
  };

  // Close tutor panel
  const handleCloseTutorPanel = () => {
    setShowTutorPanel(false);
  };

  // Handle toggle live sharing
  const handleToggleLiveSharing = useCallback(async (enabled: boolean) => {
    if (!activeTutorSession?.tutorSessionId) return;
    
    try {
      await tutorSessionApi.updateConsent(activeTutorSession.tutorSessionId, enabled);
      setLiveSharingEnabled(enabled);
      toast.success(enabled ? 'AI chat sharing enabled' : 'AI chat sharing disabled');
    } catch (error) {
      console.error('Failed to update consent:', error);
      toast.error('Failed to update sharing settings');
    }
  }, [activeTutorSession?.tutorSessionId]);

  // End tutor session
  const handleEndTutorSession = useCallback(() => {
    setActiveTutorSession(null);
    setLiveSharingEnabled(false);
  }, []);

  // Audio controls
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

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const hasMessages = messages.length > 0 || streamingMessage;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header with Tutor Status - Sticky */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]">
        {/* Header - minimal */}
        <header className="flex items-center justify-center px-4 py-3 border-b border-gray-800/50 bg-[#0f0f0f]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium text-white text-sm tracking-tight">AI Tutor</span>
          </div>
        </header>

        {/* Active Tutor Session Banner */}
        {activeTutorSession && (
          <div className="px-4 py-2 border-b border-gray-800/50">
            <StudentActiveSession
              key={activeTutorSession.tutorSessionId} // Force re-mount when session changes
              tutorSessionId={activeTutorSession.tutorSessionId}
              tutorName={activeTutorSession.tutorName}
              dailyRoom={activeTutorSession.dailyRoom}
              liveSharingEnabled={liveSharingEnabled}
              onToggleLiveSharing={handleToggleLiveSharing}
              onEndSession={handleEndTutorSession}
            />
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingSession ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : !hasMessages ? (
          // Empty state - centered greeting
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-180px)] px-4">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-violet-500/30">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-light text-white mb-2 tracking-tight">
                {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
              </h1>
              <p className="text-gray-400 text-lg">How can I help you learn today?</p>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {suggestionPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="px-4 py-2.5 text-sm text-gray-300 border border-gray-700/50 rounded-xl hover:border-violet-500/50 hover:text-white hover:bg-violet-500/10 transition-all group"
                >
                  <span className="opacity-70 group-hover:opacity-100">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={() => handleRetry(msg.id)}
                onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
              />
            ))}
            
            {/* Streaming message */}
            {streamingMessage && !messages.some(m => m.id === streamingMessage.id) && (
              <MessageBubble
                key={`streaming-${streamingMessage.id}`}
                message={streamingMessage}
                isStreaming={true}
                streamingContent={streamingContent}
              />
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f] to-transparent pt-6 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((file, i) => (
                <div key={i} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-700"
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-xs text-gray-300 truncate max-w-[100px]">{file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recording UI */}
          {isRecording && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-3 border border-gray-800">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium text-white">
                  {isPaused ? 'Paused' : 'Recording...'}
                </span>
                <span className="text-lg font-mono text-gray-300">{formatDuration(duration)}</span>
              </div>

              {/* Waveform */}
              <div className="flex items-center justify-center gap-0.5 h-8 mb-4">
                {[...Array(32)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-500 transition-all duration-100"
                    style={{
                      height: isPaused ? '4px' : `${Math.random() * 28 + 4}px`,
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className="p-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleStopRecording}
                  className="p-3 bg-red-500 text-white rounded-full hover:bg-red-400 transition-colors"
                >
                  <StopCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancelAudio}
                  className="p-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Audio Preview */}
          {audioUrl && !isRecording && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-3 border border-gray-800">
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
              
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={togglePlayback}
                  className="p-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full hover:opacity-90 transition-opacity"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Voice Message</p>
                  <p className="text-xs text-gray-400">{formatDuration(duration)}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleCancelAudio}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                  Re-record
                </button>
                <button
                  onClick={handleAudioSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Text Input */}
          {!isRecording && !audioUrl && (
            <form onSubmit={handleSubmit}>
              <div className="relative bg-[#1a1a1a] rounded-2xl border border-gray-800 focus-within:border-violet-500/50 transition-all shadow-xl">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask me anything about Math, Science, or any subject..."
                  rows={1}
                  disabled={isSubmitting || isStreaming}
                  className="w-full p-4 pr-32 bg-transparent resize-none focus:outline-none text-white placeholder-gray-500 min-h-[56px] max-h-[200px]"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                  }}
                />
                
                {/* Input Actions */}
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || isStreaming}
                    className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors disabled:opacity-50"
                    title="Attach files"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAudioClick}
                    disabled={isSubmitting || isStreaming}
                    className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors disabled:opacity-50"
                    title="Record voice"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  {/* Talk to Tutor Button - Hidden when already in session */}
                  {!activeTutorSession && (
                    <button
                      type="button"
                      onClick={handleOpenTutorPanel}
                      disabled={isSubmitting || isStreaming || !currentSessionId}
                      className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors disabled:opacity-50"
                      title="Talk to a human tutor"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || isStreaming || (!input.trim() && attachments.length === 0)}
                    className={`p-2 rounded-xl transition-all ${
                      input.trim() || attachments.length > 0
                        ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90'
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting || isStreaming ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Footer hint */}
          <p className="text-center text-xs text-gray-600 mt-3">
            AI can make mistakes. For important topics, verify with your tutor.
          </p>
        </div>
      </div>

      {/* Tutor Session Panel Modal */}
      {showTutorPanel && currentSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md animate-fadeIn">
            {/* DEBUG INDICATOR */}
            <div className="mb-2 text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded text-center">
              🔧 DEBUG: Gemini Listener Active | Session: {currentSessionId}
              <div className="flex gap-1 mt-1 justify-center">
                <button
                  onClick={() => (window as any).FORCE_TUTOR_ACCEPTED()}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded"
                >
                  FORCE TEST
                </button>
                <button
                  onClick={async () => {
                    console.log('🧪 Testing backend event emission...');
                    try {
                      const response = await fetch(`http://localhost:3000/api/v1/tutor-session/test-notification/${currentSessionId}`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                          'Content-Type': 'application/json'
                        }
                      });
                      const result = await response.json();
                      console.log('🧪 Test notification response:', response.status, result);

                      if (response.ok) {
                        console.log('✅ Backend test successful - waiting for event...');
                      } else {
                        console.log('❌ Backend test failed:', result);
                      }
                    } catch (error) {
                      console.error('❌ Test notification failed:', error);
                    }
                  }}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                >
                  TEST BACKEND
                </button>
              </div>
            </div>
            <TutorSessionPanel
              aiSessionId={currentSessionId}
              activeTutorSession={activeTutorSession}
              onClose={handleCloseTutorPanel}
            />
          </div>
        </div>
      )}

      {/* Custom animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default StudentDashboard;
