import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Mic, Sparkles, Loader2,
  Play, Pause, X, Trash2, FileText,
  ThumbsUp, ThumbsDown, RotateCcw, UserPlus,
  StopCircle, Paperclip, ChevronDown, ChevronRight,
  Users, Zap, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { geminiChatApi, tutorSessionApi } from '../../api';
import { AIMessage, AIChatMode, DailyRoom, CouncilMemberResponse } from '../../types';
import { useGeminiChat } from '../../hooks/useGeminiChat';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { StudentActiveSession } from '../../components/tutorSession';
import { TutorSessionPanel } from '../../components/tutorSession';
import {
  connectTutorSessionSocket,
  disconnectTutorSessionSocket,
  subscribeToAISession,
  joinSession,
  getChatHistory,
  getWhiteboardData,
  onTutorSessionSocketConnect,
} from '../../services/tutorSessionSocket';
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

// ============================================================================
// Council Expert Card (completed, expandable)
// ============================================================================
function ExpertCard({ memberLabel, memberName, content }: {
  memberLabel: string;
  memberName: string;
  content: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const confidence = confidenceColor(content);
  const keyPoints = extractKeyPoints(content);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800/50 rounded-xl p-3 transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">{memberLabel}</span>
        <span className="text-sm font-medium text-gray-200 flex-1">{memberName}</span>
        <span className="flex items-center gap-1 mr-1" title={`${confidence.label} confidence`}>
          <span className={`w-1.5 h-1.5 rounded-full ${confidence.dot}`} />
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Key points pills (always visible) */}
      {keyPoints.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {keyPoints.map((point, i) => (
            <span
              key={i}
              className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50 truncate max-w-[200px]"
            >
              {point}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 text-sm text-gray-400 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Council Responses Display (collapsible on completed messages)
// ============================================================================
function CouncilResponsesDisplay({ responses }: { responses: CouncilMemberResponse[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!responses || responses.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
      >
        <Users className="w-3.5 h-3.5" />
        <span>View Expert Breakdown</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {responses.map((r) => (
            <ExpertCard
              key={r.memberId}
              memberLabel={r.memberLabel}
              memberName={r.memberName}
              content={r.content}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Extract short key-point phrases from expert content (first 3 bullet / sentence fragments). */
function extractKeyPoints(content: string, max = 3): string[] {
  // Try bullet points first (- or * or numbered)
  const bullets = content.match(/^[\s]*[-*•]\s+(.+)/gm);
  if (bullets && bullets.length > 0) {
    return bullets.slice(0, max).map((b) => b.replace(/^[\s]*[-*•]\s+/, '').replace(/[.*#`]/g, '').trim().slice(0, 60));
  }
  // Fall back to first N sentences
  const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  return sentences.slice(0, max).map((s) => s.replace(/[*#`]/g, '').trim().slice(0, 60));
}

/** Confidence color based on content depth (word count as a proxy). */
function confidenceColor(content: string): { dot: string; label: string } {
  const words = content.split(/\s+/).length;
  if (words >= 120) return { dot: 'bg-emerald-400', label: 'High' };
  if (words >= 60) return { dot: 'bg-amber-400', label: 'Medium' };
  return { dot: 'bg-gray-400', label: 'Low' };
}

// ============================================================================
// Streaming Council Progress (horizontal cards)
// ============================================================================

const EXPERT_DEFAULTS: Array<{ id: string; name: string; label: string; analyzingText: string }> = [
  { id: 'conceptual', name: 'Concept Master', label: 'Theory', analyzingText: 'Analyzing the underlying theory...' },
  { id: 'practical', name: 'Practice Guide', label: 'Solution', analyzingText: 'Breaking down the solution steps...' },
  { id: 'clarity', name: 'Clarity Expert', label: 'Insight', analyzingText: 'Finding the perfect analogy...' },
];

function StreamingCouncilProgress({ councilExperts, councilMembers, isSynthesizing }: {
  councilExperts: Array<{ id: string; name: string; label: string; status: string }>;
  councilMembers: Array<{ memberId: string; memberName: string; memberLabel: string; content: string }>;
  isSynthesizing: boolean;
}) {
  // Use backend experts if available, otherwise defaults
  const experts = councilExperts.length > 0
    ? councilExperts.map((e) => ({
        ...e,
        analyzingText: EXPERT_DEFAULTS.find((d) => d.id === e.id)?.analyzingText || 'Analyzing...',
      }))
    : EXPERT_DEFAULTS.map((d) => ({ ...d, status: 'analyzing' }));

  const allDone = councilMembers.length >= 3;
  const isCrossReviewing = allDone && !isSynthesizing;

  if (isSynthesizing) {
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-violet-300 mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium">Combining expert perspectives into your personalized answer...</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm text-gray-300 mb-3">
        <Users className="w-4 h-4 text-violet-400" />
        <span>
          {isCrossReviewing
            ? 'Cross-reviewing expert perspectives...'
            : 'Our experts are analyzing your question...'}
        </span>
      </div>

      {/* Cross-reviewing animation bar */}
      {isCrossReviewing && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
          <span className="text-xs text-violet-300">Experts are reviewing each other's analysis for accuracy...</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {experts.map((expert) => {
          const completed = councilMembers.find((m) => m.memberId === expert.id);
          const isDone = completed || expert.status === 'done';
          const confidence = completed ? confidenceColor(completed.content) : null;

          return (
            <div
              key={expert.id}
              className={`rounded-xl border p-3 transition-all ${
                isDone
                  ? 'bg-[#1a1a1a] border-emerald-500/30'
                  : 'bg-[#1a1a1a] border-gray-800/50 animate-pulse'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                  {completed?.memberLabel || expert.label}
                </span>
                {isDone && confidence && (
                  <span className="flex items-center gap-1 ml-auto" title={`${confidence.label} confidence`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${confidence.dot}`} />
                    <span className="text-[9px] text-gray-500">{confidence.label}</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-gray-300 mb-1">
                {completed?.memberName || expert.name}
              </p>
              {isDone && completed ? (
                <p className="text-[11px] text-gray-500 line-clamp-2">{completed.content.slice(0, 100)}...</p>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                  <span>{expert.analyzingText}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Mode Toggle
// ============================================================================
function ModeToggle({ mode, onChange, disabled }: {
  mode: AIChatMode;
  onChange: (mode: AIChatMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-gray-800 p-0.5">
      <button
        onClick={() => onChange('SINGLE')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          mode === 'SINGLE'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Zap className="w-3 h-3" />
        Single AI
      </button>
      <button
        onClick={() => onChange('COUNCIL')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          mode === 'COUNCIL'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Users className="w-3 h-3" />
        AI Council
      </button>
    </div>
  );
}

// ============================================================================
// Message Bubble
// ============================================================================
function MessageBubble({
  message,
  isStreaming,
  streamingContent,
  streamStatusText,
  showRetryWhileStreaming,
  councilAnalyzing,
  councilExperts,
  councilMembers,
  isSynthesizing,
  isCouncilMode,
  onRetry,
  onFeedback,
}: {
  message: AIMessage;
  isStreaming?: boolean;
  streamingContent?: string;
  streamStatusText?: string | null;
  showRetryWhileStreaming?: boolean;
  councilAnalyzing?: boolean;
  councilExperts?: Array<{ id: string; name: string; label: string; status: string }>;
  councilMembers?: Array<{ memberId: string; memberName: string; memberLabel: string; content: string }>;
  isSynthesizing?: boolean;
  isCouncilMode?: boolean;
  onRetry?: () => void;
  onFeedback?: (feedback: 'GOOD' | 'BAD') => void;
}) {
  const isUser = message.role === 'USER';
  const content = isStreaming ? streamingContent : message.content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`${isUser ? 'max-w-[85%]' : 'max-w-[90%]'}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-400">AI Tutor</span>
            {message.councilResponses && message.councilResponses.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">Council</span>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[#2a2a2a] text-gray-100 border border-gray-700/50'
              : 'bg-transparent text-gray-100'
          }`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type.startsWith('image/') || att.type === 'image' ? (
                    <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[150px] rounded-lg object-cover" />
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

          {message.audioUrl && (
            <div className="mb-2">
              <audio src={message.audioUrl} controls className="w-full max-w-[250px]" />
              {message.transcription && (
                <p className="text-xs text-gray-400 mt-1 italic">"{message.transcription}"</p>
              )}
            </div>
          )}

          {/* Council streaming progress — show as soon as council events arrive, even before streaming starts */}
          {isCouncilMode && (councilAnalyzing || (councilMembers && councilMembers.length > 0) || isSynthesizing) && (
            <StreamingCouncilProgress
              councilExperts={councilExperts || []}
              councilMembers={councilMembers || []}
              isSynthesizing={isSynthesizing || false}
            />
          )}

          {content && (
            <div className="prose prose-invert prose-sm max-w-none">
              {isUser ? (
                <p className="m-0 whitespace-pre-wrap">{content}</p>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => (
                      <pre className="bg-gray-900/50 rounded-lg p-3 overflow-x-auto text-sm">{children}</pre>
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

          {isStreaming && <span className="inline-block w-2 h-5 bg-violet-400 ml-1 animate-pulse rounded-sm" />}
        </div>

        {/* Council responses on completed messages */}
        {!isUser && !isStreaming && message.councilResponses && (
          <CouncilResponsesDisplay responses={message.councilResponses} />
        )}

        {/* Streaming status */}
        {!isUser && isStreaming && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span className="flex-1">{streamStatusText || 'Generating...'}</span>
            {showRetryWhileStreaming && (
              <button onClick={onRetry} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-lg transition-colors">
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Feedback / error actions */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5">
            {message.hasError ? (
              <>
                {message.errorMessage && <div className="flex-1 text-xs text-red-400">{message.errorMessage}</div>}
                <button onClick={onRetry} className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onFeedback?.('GOOD')}
                  className={`p-1.5 rounded-lg transition-colors ${message.feedback === 'GOOD' ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'}`}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback?.('BAD')}
                  className={`p-1.5 rounded-lg transition-colors ${message.feedback === 'BAD' ? 'text-red-400 bg-red-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'}`}
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

// ============================================================================
// Main StudentDashboard
// ============================================================================
export function StudentDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [currentMode, setCurrentMode] = useState<AIChatMode>('SINGLE');

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
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isRecording, isPaused, duration, audioUrl,
    startRecording, stopRecording, pauseRecording, resumeRecording,
    resetRecording, getAudioFile,
  } = useAudioRecorder(300);

  // Tutor session panel state
  const [showTutorPanel, setShowTutorPanel] = useState(false);

  // Streaming message state
  const [streamingMessage, setStreamingMessage] = useState<AIMessage | null>(null);

  // Gemini chat hook
  const {
    isStreaming, isWaitingForStream, streamingContent, streamUx,
    councilAnalyzing, councilExperts, councilMembers, isSynthesizing,
    prepareForRetry, sendMessage, sendMessageWithAttachments,
    sendAudioMessage, retryMessage, addFeedback,
  } = useGeminiChat({
    sessionId: currentSessionId || undefined,
    onStreamStart: (messageId, sessionId) => {
      if (!currentSessionId && sessionId) {
        setCurrentSessionId(sessionId);
        setSearchParams({ session: sessionId });
      }
      setMessages((prev) => {
        const existing = prev.find((m) => m.id === messageId);
        if (existing) {
          setStreamingMessage({ ...existing, hasError: false, errorMessage: null, isStreaming: true, isComplete: false });
        } else {
          setStreamingMessage({
            id: messageId, sessionId, role: 'ASSISTANT', content: '',
            attachments: null, audioUrl: null, transcription: null,
            isStreaming: true, isComplete: false, hasError: false, errorMessage: null,
            feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
          });
        }
        return prev.map((m) => m.id === messageId ? { ...m, hasError: false, errorMessage: null } : m);
      });
    },
    onStreamEnd: (chunk) => {
      setMessages((prev) => {
        const finalContent = chunk.fullContent ?? streamingContent ?? '';
        const councilData = councilMembers.length > 0
          ? councilMembers.map((cm) => ({
              memberId: cm.memberId as 'conceptual' | 'practical' | 'clarity',
              memberName: cm.memberName,
              memberLabel: cm.memberLabel,
              content: cm.content,
            }))
          : null;

        if (prev.some((m) => m.id === chunk.messageId)) {
          return prev.map((m) =>
            m.id === chunk.messageId
              ? { ...m, content: finalContent, isStreaming: false, isComplete: true, hasError: false, errorMessage: null, councilResponses: councilData || m.councilResponses }
              : m
          );
        }
        return [
          ...prev,
          {
            id: chunk.messageId, sessionId: chunk.sessionId, role: 'ASSISTANT' as const,
            content: finalContent, attachments: null, audioUrl: null, transcription: null,
            isStreaming: false, isComplete: true, hasError: false, errorMessage: null,
            feedback: null, councilResponses: councilData, createdAt: new Date().toISOString(),
          },
        ];
      });
      setStreamingMessage(null);
    },
    onStreamError: (chunk) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === chunk.messageId)) {
          return prev.map((m) =>
            m.id === chunk.messageId
              ? { ...m, content: chunk.fullContent ?? m.content, hasError: true, errorMessage: chunk.error || 'Unknown error', isStreaming: false, isComplete: false }
              : m
          );
        }
        return [
          ...prev,
          {
            id: chunk.messageId, sessionId: chunk.sessionId, role: 'ASSISTANT' as const,
            content: streamingContent || 'Failed to generate response',
            attachments: null, audioUrl: null, transcription: null,
            isStreaming: false, isComplete: false, hasError: true,
            errorMessage: chunk.error || 'Unknown error',
            feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
          },
        ];
      });
      setStreamingMessage(null);
    },
    onTutorStatusUpdate: (data) => toast(data.message, { icon: '\ud83d\udc4b' }),
    onTutorConnected: (data) => toast.success(data.message),
    onTutorWaitUpdate: (data) => toast(data.message, { icon: '\u23f3' }),
  });

  // Connect to tutor session socket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const shouldConnect = token && (currentSessionId || activeTutorSession);
    if (!shouldConnect) return;

    connectTutorSessionSocket(token);
    if (currentSessionId) subscribeToAISession(currentSessionId);

    const geminiSocket = getGeminiSocket();
    if (geminiSocket?.connected && currentSessionId) {
      geminiSocket.emit('joinRoom', `ai:${currentSessionId}`);
    }

    return () => {
      if (!activeTutorSession) disconnectTutorSessionSocket();
      if (currentSessionId) {
        const gs = getGeminiSocket();
        if (gs?.connected) gs.emit('leaveRoom', `ai:${currentSessionId}`);
      }
    };
  }, [currentSessionId, activeTutorSession]);

  // Listen for tutor accepted event
  useEffect(() => {
    const handleTutorAccepted = async (data: any) => {
      setShowTutorPanel(false);
      if (data.tutorSessionId && data.tutor) {
        setActiveTutorSession({
          tutorSessionId: data.tutorSessionId,
          tutorName: data.tutor.name,
          tutorAvatar: data.tutor.avatar,
        });
        toast.success(`${data.tutor.name} connected! Starting video call...`);
        try {
          const response = await tutorSessionApi.getStudentRoomToken(data.tutorSessionId);
          setActiveTutorSession((prev) => prev ? { ...prev, dailyRoom: response } : null);
          const setupSession = () => {
            joinSession(data.tutorSessionId);
            getChatHistory(data.tutorSessionId);
            getWhiteboardData(data.tutorSessionId);
          };
          setupSession();
          let unsubscribe: (() => void) | null = null;
          unsubscribe = onTutorSessionSocketConnect(() => {
            setupSession();
            if (unsubscribe) unsubscribe();
          });
          setTimeout(setupSession, 2000);
        } catch (error: any) {
          toast.error(`Session setup failed: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
        }
      }
    };

    const handleSessionStatusChanged = (data: any) => {
      if (data.sessionId === activeTutorSession?.tutorSessionId) {
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
          setActiveTutorSession(null);
          toast('Session has ended');
        }
      }
    };

    onTutorAccepted(handleTutorAccepted);
    onSessionStatusChanged(handleSessionStatusChanged);
    return () => { offTutorAccepted(); offSessionStatusChanged(); };
  }, [activeTutorSession?.tutorSessionId]);

  // Load session from URL
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
    } else if (!sessionId && (currentSessionId || !initialLoadDone)) {
      setCurrentSessionId(null);
      setMessages([]);
      setStreamingMessage(null);
      setShowTutorPanel(false);
      setCurrentMode('SINGLE');
    }
    if (!initialLoadDone) setInitialLoadDone(true);
  }, [searchParams, initialLoadDone]);

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoadingSession(true);
      const response = await geminiChatApi.getSession(sessionId);
      setCurrentSessionId(sessionId);
      setMessages(response.messages);
      setCurrentMode(response.session.mode || 'SINGLE');
    } catch {
      toast.error('Failed to load chat session');
      setSearchParams({});
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Handle mode change
  const handleModeChange = async (mode: AIChatMode) => {
    setCurrentMode(mode);
    if (currentSessionId) {
      try {
        await geminiChatApi.updateSession(currentSessionId, { mode });
        toast.success(`Switched to ${mode === 'COUNCIL' ? 'AI Council' : 'Single AI'} mode`);
      } catch {
        toast.error('Failed to update mode');
      }
    }
  };

  // Handle text submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isSubmitting || isStreaming) return;

    const messageContent = input.trim();
    const files = [...attachments];
    setInput('');
    setAttachments([]);
    setIsSubmitting(true);

    const tempUserMessage: AIMessage = {
      id: 'temp-' + Date.now(),
      sessionId: currentSessionId || '',
      role: 'USER',
      content: messageContent,
      attachments: files.length > 0
        ? files.map((f) => ({ url: URL.createObjectURL(f), name: f.name, type: f.type, size: f.size }))
        : null,
      audioUrl: null, transcription: null,
      isStreaming: false, isComplete: true, hasError: false, errorMessage: null,
      feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // Show an immediate AI placeholder so there's no dead gap
    setStreamingMessage({
      id: 'waiting-' + Date.now(),
      sessionId: currentSessionId || '',
      role: 'ASSISTANT',
      content: '',
      attachments: null, audioUrl: null, transcription: null,
      isStreaming: true, isComplete: false, hasError: false, errorMessage: null,
      feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
    });

    setTimeout(() => {
      lastUserMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    try {
      if (files.length > 0) {
        await sendMessageWithAttachments(files, messageContent, currentSessionId || undefined);
      } else {
        await sendMessage(messageContent, currentSessionId || undefined);
      }
    } catch {
      toast.error('Failed to send message');
      setStreamingMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle audio submission
  const handleAudioSubmit = async () => {
    const audioFile = getAudioFile();
    if (!audioFile) { toast.error('No audio to send'); return; }

    setIsSubmitting(true);
    resetRecording();
    setIsAudioMode(false);

    const tempUserMessage: AIMessage = {
      id: 'temp-audio-' + Date.now(),
      sessionId: currentSessionId || '',
      role: 'USER', content: '',
      attachments: null, audioUrl: URL.createObjectURL(audioFile), transcription: null,
      isStreaming: false, isComplete: true, hasError: false, errorMessage: null,
      feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // Show an immediate AI placeholder so there's no dead gap
    setStreamingMessage({
      id: 'waiting-audio-' + Date.now(),
      sessionId: currentSessionId || '',
      role: 'ASSISTANT',
      content: '',
      attachments: null, audioUrl: null, transcription: null,
      isStreaming: true, isComplete: false, hasError: false, errorMessage: null,
      feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
    });

    setTimeout(() => {
      lastUserMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    try {
      await sendAudioMessage(audioFile, currentSessionId || undefined);
    } catch {
      toast.error('Failed to send audio message');
      setStreamingMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => setInput(prompt);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => {
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      return (isImage || isPdf) && f.size <= 20 * 1024 * 1024;
    });
    if (validFiles.length !== files.length) toast.error('Some files were skipped (only images and PDFs under 20MB)');
    setAttachments((prev) => [...prev, ...validFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleRetry = async (messageId: string) => {
    const existing = messages.find((m) => m.id === messageId);
    if (existing?.content) prepareForRetry(existing.content);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, hasError: false, errorMessage: null } : m)));
    await retryMessage(messageId);
  };

  const handleRetryStreaming = async () => {
    if (!streamingMessage) return;
    prepareForRetry(streamingContent);
    await retryMessage(streamingMessage.id);
  };

  const handleFeedback = async (messageId: string, feedback: 'GOOD' | 'BAD') => {
    const success = await addFeedback(messageId, feedback);
    if (success) setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
  };

  const handleOpenTutorPanel = () => {
    if (!currentSessionId) { toast.error('Please start a conversation first'); return; }
    setShowTutorPanel(true);
  };

  const handleToggleLiveSharing = useCallback(async (enabled: boolean) => {
    if (!activeTutorSession?.tutorSessionId) return;
    try {
      await tutorSessionApi.updateConsent(activeTutorSession.tutorSessionId, enabled);
      setLiveSharingEnabled(enabled);
      toast.success(enabled ? 'AI chat sharing enabled' : 'AI chat sharing disabled');
    } catch {
      toast.error('Failed to update sharing settings');
    }
  }, [activeTutorSession?.tutorSessionId]);

  const handleEndTutorSession = useCallback(() => {
    setActiveTutorSession(null);
    setLiveSharingEnabled(false);
  }, []);

  // Audio controls
  const handleAudioClick = () => { if (!isAudioMode) { setIsAudioMode(true); startRecording(); } };
  const handleStopRecording = () => stopRecording();
  const handleCancelAudio = () => { resetRecording(); setIsAudioMode(false); };
  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const hasMessages = messages.length > 0 || streamingMessage;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50 bg-[#0f0f0f]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium text-white text-sm tracking-tight">AI Tutor</span>
          </div>
          <ModeToggle mode={currentMode} onChange={handleModeChange} disabled={isStreaming} />
        </header>

        {activeTutorSession && (
          <div className="px-4 py-2 border-b border-gray-800/50">
            <StudentActiveSession
              key={activeTutorSession.tutorSessionId}
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
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                {currentMode === 'COUNCIL' ? (
                  <>
                    <Users className="w-4 h-4 text-violet-400" />
                    <span>AI Council mode - 3 experts will analyze your question</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span>Single AI mode - fast, direct responses</span>
                  </>
                )}
              </div>
            </div>
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
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, index) => {
              const isLastUserMessage = msg.role === 'USER' && index === messages.length - 1;
              return (
                <div key={msg.id} ref={isLastUserMessage ? lastUserMessageRef : undefined}>
                  <MessageBubble
                    message={msg}
                    isCouncilMode={currentMode === 'COUNCIL'}
                    onRetry={() => handleRetry(msg.id)}
                    onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
                  />
                </div>
              );
            })}
            {streamingMessage && !messages.some((m) => m.id === streamingMessage.id) && (
              <MessageBubble
                key={`streaming-${streamingMessage.id}`}
                message={streamingMessage}
                isStreaming={isStreaming || isWaitingForStream}
                streamingContent={streamingContent}
                streamStatusText={streamUx.statusText}
                showRetryWhileStreaming={streamUx.shouldOfferRetry}
                councilAnalyzing={councilAnalyzing}
                councilExperts={councilExperts}
                councilMembers={councilMembers}
                isSynthesizing={isSynthesizing}
                isCouncilMode={currentMode === 'COUNCIL'}
                onRetry={handleRetryStreaming}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f] to-transparent pt-6 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((file, i) => (
                <div key={i} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-gray-700" />
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-xs text-gray-300 truncate max-w-[100px]">{file.name}</span>
                    </div>
                  )}
                  <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isRecording && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-3 border border-gray-800">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium text-white">{isPaused ? 'Paused' : 'Recording...'}</span>
                <span className="text-lg font-mono text-gray-300">{formatDuration(duration)}</span>
              </div>
              <div className="flex items-center justify-center gap-0.5 h-8 mb-4">
                {[...Array(32)].map((_, i) => (
                  <div key={i} className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-500 transition-all duration-100" style={{ height: isPaused ? '4px' : `${Math.random() * 28 + 4}px` }} />
                ))}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={isPaused ? resumeRecording : pauseRecording} className="p-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors">
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button onClick={handleStopRecording} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-400 transition-colors">
                  <StopCircle className="w-5 h-5" />
                </button>
                <button onClick={handleCancelAudio} className="p-2.5 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {audioUrl && !isRecording && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-3 border border-gray-800">
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={togglePlayback} className="p-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full hover:opacity-90 transition-opacity">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Voice Message</p>
                  <p className="text-xs text-gray-400">{formatDuration(duration)}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={handleCancelAudio} disabled={isSubmitting} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button onClick={() => { resetRecording(); startRecording(); }} disabled={isSubmitting} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                  <Mic className="w-4 h-4" /> Re-record
                </button>
                <button onClick={handleAudioSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl transition-all hover:opacity-90 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          )}

          {!isRecording && !audioUrl && (
            <form onSubmit={handleSubmit}>
              <div className="relative bg-[#1a1a1a] rounded-2xl border border-gray-800 focus-within:border-violet-500/50 transition-all shadow-xl">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
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
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isStreaming} className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors disabled:opacity-50" title="Attach files">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={handleAudioClick} disabled={isSubmitting || isStreaming} className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors disabled:opacity-50" title="Record voice">
                    <Mic className="w-5 h-5" />
                  </button>
                  {!activeTutorSession && (
                    <button type="button" onClick={handleOpenTutorPanel} disabled={isSubmitting || isStreaming || !currentSessionId} className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors disabled:opacity-50" title="Talk to a human tutor">
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || isStreaming || (!input.trim() && attachments.length === 0)}
                    className={`p-2 rounded-xl transition-all ${input.trim() || attachments.length > 0 ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                  >
                    {isSubmitting || isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-gray-600 mt-3">
            AI can make mistakes. For important topics, verify with your tutor.
          </p>
        </div>
      </div>

      {/* Tutor Session Panel Modal */}
      {showTutorPanel && currentSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md animate-fadeIn">
            <TutorSessionPanel
              aiSessionId={currentSessionId}
              activeTutorSession={activeTutorSession}
              onClose={() => setShowTutorPanel(false)}
            />
          </div>
        </div>
      )}

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
