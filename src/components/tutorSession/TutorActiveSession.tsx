import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, Send, MessageSquare, FileText,
  Sparkles, ChevronDown, ChevronUp, Eye, EyeOff, Maximize2
} from 'lucide-react';
import { tutorSessionApi } from '../../api';
import {
  connectTutorSessionSocket,
  getTutorSessionSocket,
  onTutorSessionSocketConnect,
  joinSession,
  leaveSession,
  sendChatMessage,
  onNewAIMessage,
  offNewAIMessage,
  onConsentChanged,
  offConsentChanged,
  onChatMessage,
  offChatMessage,
  onChatHistory,
  offChatHistory,
  onWhiteboardData,
  offWhiteboardData,
  onUserTyping,
  offUserTyping,
  sendTypingIndicator,
  onCallSignal,
  offCallSignal,
} from '../../services/tutorSessionSocket';
import {
  AcceptSessionResponse,
  TutorSessionChatMessage,
  TutorStudentChatMessage,
  NewAIMessageEvent,
  ConsentChangedEvent,
  TutorSessionTypingEvent,
  DailyRoom,
} from '../../types';
import { FloatingCallIndicator } from './AudioCall';
import { CollaborativeWhiteboard } from './CollaborativeWhiteboard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

interface TutorActiveSessionProps {
  sessionData: AcceptSessionResponse;
  onEndSession: () => void;
  className?: string;
}

export function TutorActiveSession({
  sessionData,
  onEndSession,
  className = '',
}: TutorActiveSessionProps) {
  const { session, summary, chatHistory: initialChatHistory, dailyRoom: initialDailyRoom } = sessionData || {};

  // State
  const [dailyRoom, setDailyRoom] = useState<DailyRoom | null>(initialDailyRoom || null);
  const [isInCall, setIsInCall] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<TutorSessionChatMessage[]>(initialChatHistory || []);
  const [tutorStudentChat, setTutorStudentChat] = useState<TutorStudentChatMessage[]>([]);
  const [liveSharingEnabled, setLiveSharingEnabled] = useState(summary?.liveSharingEnabled || false);
  const [chatMessage, setChatMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [studentIsTyping, setStudentIsTyping] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  
  // Panel visibility
  const [showWhiteboard, setShowWhiteboard] = useState(true);
  const [showAiChat, setShowAiChat] = useState(true);
  const [showTutorChat, setShowTutorChat] = useState(true);

  // Fullscreen mode for tutor
  const [fullscreenMode, setFullscreenMode] = useState<'whiteboard' | 'ai-chat' | 'tutor-chat' | null>(null);
  
  // Refs
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const tutorChatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join session room on mount (wait for socket connection)
  useEffect(() => {
    if (!session?.id) return;

    const joinSessionWhenReady = () => {
      console.log('[TutorActiveSession] Joining session:', session.id);
      joinSession(session.id);
    };

    // Check if socket is already connected
    const socket = getTutorSessionSocket();
    if (socket?.connected) {
      joinSessionWhenReady();
    } else {
      // Wait for socket to connect
      const unsubscribe = onTutorSessionSocketConnect(() => {
        console.log('[TutorActiveSession] Socket connected, now joining session');
        joinSessionWhenReady();
        unsubscribe(); // Clean up listener
      });
    }

    return () => {
      console.log('[TutorActiveSession] Leaving session:', session.id);
      leaveSession(session.id);
    };
  }, [session.id]);

  // Fetch tutor room token if not available
  useEffect(() => {
    if (!session?.id || dailyRoom) return;

    console.log('[TutorActiveSession] Daily room not available, fetching tutor room token');

    const fetchTutorRoomToken = async () => {
      try {
        const response = await tutorSessionApi.getTutorRoomToken(session.id);
        console.log('[TutorActiveSession] Tutor room token received:', response.data);
        setDailyRoom(response.data);
        toast.success('Video call ready!');
      } catch (error) {
        console.error('[TutorActiveSession] Failed to get tutor room token:', error);
        toast.error('Failed to set up video call');
      }
    };

    fetchTutorRoomToken();
  }, [session?.id, dailyRoom]);

  // Socket event listeners
  useEffect(() => {
    // New AI message (if live sharing enabled)
    const handleNewAIMessage = (message: NewAIMessageEvent) => {
      if (liveSharingEnabled) {
        setAiChatHistory(prev => [...prev, {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        }]);
      }
    };

    // Consent changed
    const handleConsentChanged = (data: ConsentChangedEvent) => {
      if (data.sessionId === session.id) {
        setLiveSharingEnabled(data.liveSharingEnabled);

        // Refresh chat history when consent is enabled
        if (data.liveSharingEnabled) {
          refreshChatHistory();
        }
      }
    };

    // Chat history loaded
    const handleChatHistory = (data: any) => {
      console.log('[TutorActiveSession] Chat history received:', data);
      if (data.sessionId === session.id && data.messages) {
        // Convert to TutorSessionChatMessage format
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
        }));
        setAiChatHistory(formattedMessages);
      }
    };

    // Whiteboard data loaded
    const handleWhiteboardData = (data: any) => {
      console.log('[TutorActiveSession] Whiteboard data received:', data);
      if (data.sessionId === session.id) {
        // Whiteboard data is handled by the CollaborativeWhiteboard component
        console.log('Whiteboard data loaded:', data);
      }
    };

    // Tutor-student chat message
    const handleChatMessage = (message: TutorStudentChatMessage) => {
      console.log('[TutorActiveSession] Chat message received:', message);
      setTutorStudentChat(prev => [...prev, message]);
    };

    // Typing indicator
    const handleUserTyping = (data: TutorSessionTypingEvent) => {
      if (data.sessionId === session.id && data.role === 'student') {
        setStudentIsTyping(data.isTyping);
      }
    };

    // Call signals from student (mute/unmute, video on/off, screenshare)
    const handleCallSignal = (data: any) => {
      if (data.sessionId === session.id) {
        console.log('Received call signal from student:', data);
        // Handle call signals (mute, unmute, video on/off, screenshare)
        // These will be handled by the VideoCall component
        toast(`Student ${data.signal}`, { duration: 2000 });
      }
    };

    onNewAIMessage(handleNewAIMessage);
    onConsentChanged(handleConsentChanged);
    onChatHistory(handleChatHistory);
    onWhiteboardData(handleWhiteboardData);
    onChatMessage(handleChatMessage);
    onUserTyping(handleUserTyping);
    onCallSignal(handleCallSignal);

    return () => {
      offNewAIMessage();
      offConsentChanged();
      offChatHistory();
      offWhiteboardData();
      offChatMessage();
      offUserTyping();
      offCallSignal();
    };
  }, [session.id, liveSharingEnabled]);

  // Scroll to bottom of chats
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChatHistory]);

  useEffect(() => {
    tutorChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorStudentChat]);

  // Refresh chat history
  const refreshChatHistory = useCallback(async () => {
    try {
      const response = await tutorSessionApi.getChatHistory(session.id);
      setAiChatHistory(response.data.messages);
      setLiveSharingEnabled(response.data.liveSharingEnabled);
    } catch (error) {
      console.error('Failed to refresh chat history:', error);
    }
  }, [session.id]);

  // Send chat message
  const handleSendMessage = useCallback(() => {
    if (!chatMessage.trim()) return;
    
    sendChatMessage(session.id, chatMessage.trim());
    setChatMessage('');
    
    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingIndicator(session.id, false);
    setIsTyping(false);
  }, [session.id, chatMessage]);

  // Handle typing
  const handleTyping = useCallback((value: string) => {
    setChatMessage(value);
    
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(session.id, true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(session.id, false);
    }, 2000);
  }, [session.id, isTyping]);

  // Download chat
  const handleDownloadChat = useCallback(() => {
    const downloadUrl = tutorSessionApi.downloadChat(session.id);
    window.open(downloadUrl, '_blank');
  }, [session.id]);

  // End session
  const handleEndSession = useCallback(async () => {
    setIsEndingSession(true);
    try {
      await tutorSessionApi.endSession(session.id);
      onEndSession();
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      setIsEndingSession(false);
    }
  }, [session?.id, onEndSession]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback((mode: 'whiteboard' | 'ai-chat' | 'tutor-chat' | null) => {
    setFullscreenMode(prev => prev === mode ? null : mode);
  }, []);

  // Guard - show loading if data isn't ready
  if (!session || !summary) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  // Fullscreen mode
  if (fullscreenMode) {
    return (
      <div className={`fixed inset-4 z-50 bg-[#1a1a1a] rounded-2xl ${fullscreenMode === 'whiteboard' ? 'overflow-visible' : 'overflow-hidden'} flex flex-col`}>
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
              {summary.student?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {fullscreenMode === 'whiteboard' && 'Collaborative Whiteboard'}
                {fullscreenMode === 'ai-chat' && 'Student\'s AI Chat'}
                {fullscreenMode === 'tutor-chat' && `Direct Chat with ${summary.student?.name || 'Student'}`}
              </p>
              <p className="text-xs text-emerald-400">Fullscreen Mode</p>
            </div>
          </div>
          <button
            onClick={() => setFullscreenMode(null)}
            className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Fullscreen Content */}
        <div className="flex-1 p-4 overflow-visible">
          {fullscreenMode === 'whiteboard' && (
            <CollaborativeWhiteboard
              key="whiteboard-fullscreen"
              sessionId={session.id}
              className="h-[800px]"
              onSave={(elements) => {
                tutorSessionApi.saveWhiteboard(session.id, { elements });
              }}
            />
          )}

          {fullscreenMode === 'ai-chat' && (
            <div className="h-full bg-gray-900/50 rounded-xl p-4 overflow-y-auto">
              {aiChatHistory.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'} mb-4`}>
                  <div className={`max-w-[85%] ${msg.role === 'USER' ? 'order-2' : ''}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-xs ${msg.role === 'USER' ? 'text-violet-400' : 'text-gray-400'}`}>
                        {msg.role === 'USER' ? '👤 Student' : '🤖 AI'}
                      </span>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'USER'
                        ? 'bg-violet-500/20 text-gray-200'
                        : 'bg-gray-800 text-gray-300'
                    }`}>
                      {msg.role === 'ASSISTANT' ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={aiChatEndRef} />
            </div>
          )}

          {fullscreenMode === 'tutor-chat' && (
            <div className="h-full flex flex-col bg-gray-900/50 rounded-xl">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tutorStudentChat.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageSquare className="w-8 h-8 mb-2" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : (
                  tutorStudentChat.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'tutor' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${
                        msg.role === 'tutor'
                          ? 'bg-emerald-500/20 text-gray-200'
                          : 'bg-gray-800 text-gray-300'
                      } rounded-lg px-3 py-2`}>
                        <p className="text-xs text-gray-500 mb-1">{msg.senderName}</p>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}

                {/* Typing indicator */}
                {studentIsTyping && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </span>
                    <span>Student is typing...</span>
                  </div>
                )}

                <div ref={tutorChatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim()}
                    className="p-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#0f0f0f] ${className}`}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold">
              {summary.student?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                Session with {summary.student?.name || 'Student'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded">
                  {session.subject || 'General'}
                </span>
                <span>•</span>
                <span>{session.messageCount || 0} messages</span>
                {liveSharingEnabled && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Eye className="w-3 h-3" />
                      Live
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadChat}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleEndSession}
              disabled={isEndingSession}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isEndingSession ? 'Ending...' : 'End Session'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left Column - Video & Summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Call Section - Now shows status instead of embedded call */}
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {isInCall ? 'Video Call Active' : 'Video Call Ready'}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {isInCall
                        ? 'Call is open in another tab - use the floating indicator to manage'
                        : 'Use the floating call button to join video call'
                      }
                    </p>
                  </div>
                </div>
                {isInCall && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-400 text-sm font-medium">In Call</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating Call Indicator */}
          {dailyRoom?.url && dailyRoom?.token && (
            <FloatingCallIndicator
              roomUrl={dailyRoom.url}
              token={dailyRoom.token}
              isJoined={isInCall}
              onJoinStateChange={setIsInCall}
            />
          )}

          {/* Summary Panel */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold text-white">Session Summary</h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Topic</p>
                <p className="text-sm text-white font-medium">{session.topic || 'No topic'}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">AI Summary</p>
                <p className="text-sm text-gray-300">{session.summary || 'No summary available'}</p>
              </div>
              
              {session.keywords && session.keywords.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {session.keywords.map((keyword, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Whiteboard */}
          <div className="bg-[#1a1a1a] overflow-visible">
            <button
              onClick={() => setShowWhiteboard(!showWhiteboard)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-fuchsia-400" />
                <h2 className="text-lg font-semibold text-white">Whiteboard</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFullscreen('whiteboard')}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                {showWhiteboard ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {showWhiteboard && (
              <CollaborativeWhiteboard
                key="whiteboard-normal"
                sessionId={session.id}
                className="h-[500px]"
                onSave={(elements) => {
                  tutorSessionApi.saveWhiteboard(session.id, { elements });
                }}
              />
            )}
          </div>
        </div>

        {/* Right Column - Chats */}
        <div className="space-y-4">
          {/* AI Chat History */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowAiChat(!showAiChat)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <h2 className="font-semibold text-white">Student's AI Chat</h2>
                {liveSharingEnabled ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                    <Eye className="w-3 h-3" />
                    Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                    <EyeOff className="w-3 h-3" />
                    Snapshot
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFullscreen('ai-chat')}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                {showAiChat ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
            
            {showAiChat && (
              <div className="border-t border-gray-800 h-[400px] overflow-y-auto p-4 space-y-4">
                {aiChatHistory.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${msg.role === 'USER' ? 'order-2' : ''}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-xs ${msg.role === 'USER' ? 'text-violet-400' : 'text-gray-400'}`}>
                          {msg.role === 'USER' ? '👤 Student' : '🤖 AI'}
                        </span>
                      </div>
                      <div className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'USER'
                          ? 'bg-violet-500/20 text-gray-200'
                          : 'bg-gray-800 text-gray-300'
                      }`}>
                        {msg.role === 'ASSISTANT' ? (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={aiChatEndRef} />
              </div>
            )}
          </div>

          {/* Tutor-Student Chat */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowTutorChat(!showTutorChat)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Direct Chat</h2>
                {tutorStudentChat.length > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                    {tutorStudentChat.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFullscreen('tutor-chat')}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                {showTutorChat ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
            
            {showTutorChat && (
              <div className="border-t border-gray-800">
                {/* Messages */}
                <div className="h-[300px] overflow-y-auto p-4 space-y-3">
                  {tutorStudentChat.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <MessageSquare className="w-8 h-8 mb-2" />
                      <p className="text-sm">No messages yet</p>
                    </div>
                  ) : (
                    tutorStudentChat.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'tutor' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${
                          msg.role === 'tutor'
                            ? 'bg-emerald-500/20 text-gray-200'
                            : 'bg-gray-800 text-gray-300'
                        } rounded-lg px-3 py-2`}>
                          <p className="text-xs text-gray-500 mb-1">{msg.senderName}</p>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Typing indicator */}
                  {studentIsTyping && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <span className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </span>
                      <span>Student is typing...</span>
                    </div>
                  )}
                  
                  <div ref={tutorChatEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-gray-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => handleTyping(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!chatMessage.trim()}
                      className="p-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TutorActiveSession;

