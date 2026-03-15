import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Mic, Sparkles, Loader2,
  X, FileText,
  ThumbsUp, ThumbsDown, RotateCcw, UserPlus,
  Paperclip, ChevronDown, ChevronRight,
  Users, Zap, RefreshCw, Brain, Globe, FolderOpen,
  Check, Search, Download,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { geminiChatApi, tutorSessionApi, projectsApi } from '../../api';
import { AIMessage, AIChatMode, DailyRoom, CouncilMemberResponse, Role, ProjectResponse } from '../../types';
import { useGeminiChat } from '../../hooks/useGeminiChat';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useReadAloud } from '../../hooks/useReadAloud';
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
// Thinking Trace — persistent steps shown above the AI answer
// ============================================================================
const MODE_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  'single': { label: 'AI', icon: Sparkles, color: 'text-violet-400' },
  'deep-think': { label: 'Deep Think', icon: Brain, color: 'text-amber-400' },
  'deep-research': { label: 'Deep Research', icon: Search, color: 'text-blue-400' },
  'council': { label: 'AI Council', icon: Users, color: 'text-fuchsia-400' },
};

function ThinkingTrace({ trace, mode, isActive }: {
  trace: string[];
  mode?: string | null;
  isActive: boolean;
}) {
  // Start expanded while streaming, collapsed once done
  const [expanded, setExpanded] = useState(isActive);

  // Auto-expand when streaming starts, keep user's choice when done
  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  if (!trace || trace.length === 0) return null;

  const cfg = MODE_CONFIG[mode || 'single'] || MODE_CONFIG['single'];
  const Icon = cfg.icon;

  return (
    <div className="opacity-50 mb-4 font-mono text-[13px] border-l-[3px] border-violet-500/60 pl-3">
      <button
        type="button"
        onClick={() => !isActive && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 mb-1.5 font-semibold text-gray-300 ${!isActive ? 'cursor-pointer hover:text-gray-200' : 'cursor-default'}`}
      >
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        <span>{cfg.label} Process</span>
        {!isActive && (
          <ChevronRight className={`w-3 h-3 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
        {!isActive && !expanded && (
          <span className="text-[11px] text-gray-600 font-normal ml-1">({trace.length} steps)</span>
        )}
      </button>
      {expanded && trace.map((step, i) => {
        const isDone = i < trace.length - 1 || !isActive;
        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 py-0.5 animate-fadeIn ${isDone ? 'text-gray-500' : cfg.color}`}
          >
            {isDone && (
              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            )}
            <span>{step}</span>
          </div>
        );
      })}
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
  councilAnalyzing,
  councilExperts,
  councilMembers,
  isSynthesizing,
  isCouncilMode,
  isLastAssistant,
  thinkingTrace,
  streamMode,
  statusText,
  onRetry,
  onFeedback,
  onAttachmentPreview,
}: {
  message: AIMessage;
  isStreaming?: boolean;
  streamingContent?: string;
  isLastAssistant?: boolean;
  councilAnalyzing?: boolean;
  councilExperts?: Array<{ id: string; name: string; label: string; status: string }>;
  councilMembers?: Array<{ memberId: string; memberName: string; memberLabel: string; content: string }>;
  isSynthesizing?: boolean;
  isCouncilMode?: boolean;
  thinkingTrace?: string[];
  streamMode?: string | null;
  statusText?: string | null;
  onRetry?: () => void;
  onFeedback?: (feedback: 'GOOD' | 'BAD') => void;
  onAttachmentPreview?: (messageId: string, index: number) => void;
}) {
  const isUser = message.role === 'USER';
  const content = isStreaming ? streamingContent : message.content;
  // Use live thinkingTrace for streaming, or stored trace for completed messages
  const trace = isStreaming ? thinkingTrace : message.thinkingTrace;
  const mode = isStreaming ? streamMode : message.mode;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`${isUser ? 'max-w-[85%]' : 'w-full'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[#2a2a2a] text-[#faf9f5] border border-gray-700/50'
              : 'bg-transparent text-[#faf9f5]'
          }`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onAttachmentPreview?.(message.id, i)}
                  className="relative group cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {att.type.startsWith('image/') || att.type === 'image' ? (
                    <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[150px] rounded-lg object-cover" />
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-sm truncate max-w-[150px]">{att.name}</span>
                    </div>
                  )}
                </button>
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

          {/* Thinking trace — persistent above AI answer */}
          {!isUser && trace && trace.length > 0 && (
            <ThinkingTrace trace={trace} mode={mode} isActive={!!isStreaming} />
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
            isUser ? (
              <p className="m-0 whitespace-pre-wrap text-[16px] text-[#faf9f5]" style={{ fontWeight: 360 }}>{content}</p>
            ) : (
              <div className="ai-response-prose prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-xl font-semibold text-[#faf9f5] mt-5 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-semibold text-[#faf9f5] mt-4 mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[17px] font-medium text-[#faf9f5] mt-3 mb-1.5">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-[16px] font-medium text-[#faf9f5] mt-3 mb-1">{children}</h4>,
                    pre: ({ children }) => (
                      <pre className="bg-gray-900/50 rounded-lg p-4 overflow-x-auto text-sm my-4">{children}</pre>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-violet-300 text-sm">{children}</code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                  }}
                >
                  {content
                    // Ensure headings start on their own line with a blank line before
                    .replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2')
                    .replace(/([^\n#])(#{1,6} )/g, '$1\n\n$2')
                  }
                </ReactMarkdown>
              </div>
            )
          )}

          {/* Status text when streaming with no content (e.g. report generation) */}
          {isStreaming && !content && statusText && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />
              <span>{statusText}</span>
            </div>
          )}

          {isStreaming && (
            <span className="inline-block ml-1 animate-breathe">
              <svg width="16" height="16" viewBox="0 0 200 200" fill="none">
                <path d="M100 20C130 10 170 30 180 70C190 110 170 140 150 160C130 180 100 190 70 175C40 160 15 130 15 100C15 70 30 40 60 25C75 18 90 22 100 20Z" fill="url(#blob-grad-stream)" />
                <path d="M100 20C130 10 170 30 180 70C190 110 170 140 150 160C130 180 100 190 70 175C40 160 15 130 15 100C15 70 30 40 60 25C75 18 90 22 100 20Z" stroke="url(#blob-grad-stream)" strokeWidth="6" strokeLinecap="round" opacity="0.4" transform="scale(1.15) translate(-12, -12)" />
                <defs><linearGradient id="blob-grad-stream" x1="0" y1="0" x2="200" y2="200"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#c084fc" /></linearGradient></defs>
              </svg>
            </span>
          )}
        </div>

        {/* Council responses on completed messages */}
        {!isUser && !isStreaming && message.councilResponses && (
          <CouncilResponsesDisplay responses={message.councilResponses} />
        )}

        {/* Report PDF download */}
        {!isUser && !isStreaming && message.reportDownload && (
          <button
            type="button"
            onClick={() => {
              const { downloadUrl, filename } = message.reportDownload!;
              fetch(downloadUrl)
                .then((res) => res.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                })
                .catch(() => window.open(downloadUrl, '_blank'));
            }}
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {message.reportDownload.filename}
          </button>
        )}

        {/* Feedback / error actions */}
        {!isUser && !isStreaming && (
          <div className="flex flex-col gap-1.5 mt-1.5">
            <div className="flex items-center gap-1">
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
            {/* Static dot — streaming complete indicator (last message only) */}
            {isLastAssistant && message.isComplete && (
              <span className="ml-2 opacity-50">
                <svg width="18" height="18" viewBox="0 0 200 200" fill="none">
                  <path d="M100 20C130 10 170 30 180 70C190 110 170 140 150 160C130 180 100 190 70 175C40 160 15 130 15 100C15 70 30 40 60 25C75 18 90 22 100 20Z" fill="url(#blob-grad-static)" />
                  <path d="M100 20C130 10 170 30 180 70C190 110 170 140 150 160C130 180 100 190 70 175C40 160 15 130 15 100C15 70 30 40 60 25C75 18 90 22 100 20Z" stroke="url(#blob-grad-static)" strokeWidth="6" strokeLinecap="round" opacity="0.4" transform="scale(1.15) translate(-12, -12)" />
                  <defs><linearGradient id="blob-grad-static" x1="0" y1="0" x2="200" y2="200"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#c084fc" /></linearGradient></defs>
                </svg>
              </span>
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
  const [isLoadingSession, setIsLoadingSession] = useState(() => !!new URLSearchParams(window.location.search).get('session'));
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
  const isAudioModeRef = useRef(false);
  const speechRecRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToUser, setShouldScrollToUser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isRecording, audioUrl,
    startRecording, stopRecording,
    resetRecording, getAudioFile,
  } = useAudioRecorder(300);

  // Read-aloud (TTS)
  const { speaking: isSpeaking, speakInsight, speakAnswer, stop: stopSpeaking } = useReadAloud();

  // Tutor session panel state
  const [showTutorPanel, setShowTutorPanel] = useState(false);

  // Deep Think / Deep Research / Project context state
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTitle, setSelectedProjectTitle] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [previewData, setPreviewData] = useState<{ url: string; mimeType: string; name: string } | null>(null);

  // Streaming message state
  const [streamingMessage, setStreamingMessage] = useState<AIMessage | null>(null);

  // Gemini chat hook
  const {
    isStreaming, isWaitingForStream, streamingContent, streamUx,
    thinkingTrace, streamMode, streamSources, streamProvider,
    councilAnalyzing, councilExperts, councilMembers, isSynthesizing,
    prepareForRetry, reconnectToStream, cancelStream, sendMessage, sendMessageWithAttachments,
    sendAudioMessage, retryMessage, addFeedback,
  } = useGeminiChat({
    sessionId: currentSessionId || undefined,
    onStreamChunk: (chunk) => {
      // Speak insights aloud during thinking phase
      if (chunk.readAloud && chunk.type === 'status' && chunk.message) {
        speakInsight(chunk.message);
      }
    },
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
      // Read the full answer aloud if readAloud was enabled for this message
      if (chunk.readAloud) {
        const answerText = chunk.fullContent ?? streamingContent ?? '';
        if (answerText) speakAnswer(answerText);
      }

      const finalTrace = chunk.thinkingTrace || thinkingTrace;
      const finalMode = chunk.mode || streamMode;
      const finalProvider = chunk.provider || streamProvider;
      const finalSources = streamSources.length > 0 ? streamSources : undefined;
      const reportDl = chunk.reportDownload ? { downloadUrl: chunk.reportDownload.downloadUrl, filename: chunk.reportDownload.filename } : undefined;

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

        const traceData = finalTrace && finalTrace.length > 0 ? finalTrace : undefined;

        if (prev.some((m) => m.id === chunk.messageId)) {
          return prev.map((m) =>
            m.id === chunk.messageId
              ? { ...m, content: finalContent, isStreaming: false, isComplete: true, hasError: false, errorMessage: null, councilResponses: councilData || m.councilResponses, thinkingTrace: traceData, mode: finalMode || undefined, provider: finalProvider || undefined, sources: finalSources, reportDownload: reportDl || m.reportDownload }
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
            thinkingTrace: traceData, mode: finalMode || undefined, provider: finalProvider || undefined, sources: finalSources, reportDownload: reportDl,
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

  // Save scroll position when leaving a session
  const saveScrollPosition = useCallback(() => {
    if (currentSessionId && chatContainerRef.current) {
      sessionStorage.setItem(`scroll_${currentSessionId}`, String(chatContainerRef.current.scrollTop));
    }
  }, [currentSessionId]);

  // Load session from URL
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId && sessionId !== currentSessionId) {
      saveScrollPosition();
      loadSession(sessionId);
    } else if (!sessionId && (currentSessionId || !initialLoadDone)) {
      saveScrollPosition();
      setCurrentSessionId(null);
      setMessages([]);
      setStreamingMessage(null);
      setIsLoadingSession(false);
      setShowTutorPanel(false);
      setCurrentMode('SINGLE');
      setDeepThinkEnabled(false);
      setDeepResearchEnabled(false);
      setSelectedProjectId(null);
      setSelectedProjectTitle(null);
      setShowProjectDropdown(false);
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

      // Try to reconnect to any in-progress stream for this session
      try {
        const streamState = await reconnectToStream({ sessionId });
        if (streamState.success && streamState.isStreaming && !streamState.complete && streamState.messageId) {
          // Remove the in-progress message from the loaded messages so
          // it renders via the streaming bubble with live content
          setMessages((prev) => prev.filter((m) => m.id !== streamState.messageId));

          // Show the streaming message bubble
          setStreamingMessage({
            id: streamState.messageId,
            sessionId,
            role: 'ASSISTANT',
            content: streamState.content || '',
            attachments: null, audioUrl: null, transcription: null,
            isStreaming: true, isComplete: false, hasError: false, errorMessage: null,
            feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
            thinkingTrace: streamState.thinkingTrace,
            mode: streamState.mode,
            provider: streamState.provider,
          });
        }
      } catch {
        // Stream reconnection is best-effort, don't fail the session load
      }

      // Restore scroll position after render
      requestAnimationFrame(() => {
        const saved = sessionStorage.getItem(`scroll_${sessionId}`);
        if (saved && chatContainerRef.current) {
          chatContainerRef.current.scrollTop = Number(saved);
        }
      });
    } catch {
      toast.error('Failed to load chat session');
      setSearchParams({});
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Fetch projects for the project context selector
  useEffect(() => {
    if (user && [Role.STUDENT, Role.TEACHER, Role.TUTOR].includes(user.role)) {
      projectsApi.getProjects({ limit: 50 }).then((r) => setProjects(r.projects)).catch(() => {});
    }
  }, [user]);

  // Deep Think / Deep Research toggle handlers (mutually exclusive, disabled in council)

  const handleProjectSelect = (project: ProjectResponse | null) => {
    if (project) {
      setSelectedProjectId(project.id);
      setSelectedProjectTitle(project.title);
    } else {
      setSelectedProjectId(null);
      setSelectedProjectTitle(null);
    }
    setShowProjectDropdown(false);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) setShowModeDropdown(false);
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAttachmentPreview = async (messageId: string, index: number) => {
    try {
      const preview = await geminiChatApi.getAttachmentPreview(messageId, index);
      setPreviewData(preview);
    } catch {
      toast.error('Failed to load preview');
    }
  };

  // Handle mode change
  const handleModeChange = async (mode: AIChatMode) => {
    setCurrentMode(mode);
    if (mode === 'COUNCIL') {
      setDeepThinkEnabled(false);
      setDeepResearchEnabled(false);
    }
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

    // Stop any ongoing speech when sending a new message
    if (isSpeaking) stopSpeaking();

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

    setShouldScrollToUser(true);

    const sendOptions = {
      deepThink: deepThinkEnabled || undefined,
      deepResearch: deepResearchEnabled || undefined,
      council: currentMode === 'COUNCIL' || undefined,
      projectId: selectedProjectId || undefined,
      readAloud: isAudioModeRef.current || undefined,
    };

    try {
      if (files.length > 0) {
        await sendMessageWithAttachments(files, messageContent, currentSessionId || undefined, sendOptions);
      } else {
        await sendMessage(messageContent, currentSessionId || undefined, sendOptions);
      }
    } catch {
      toast.error('Failed to send message');
      setStreamingMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle audio submission

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

  // Keep ref in sync with state for use in stale closures
  useEffect(() => { isAudioModeRef.current = isAudioMode; }, [isAudioMode]);

  // Check SpeechRecognition support
  const speechRecSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Start speech recognition alongside audio recording
  const startSpeechRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('[Audio] SpeechRecognition not supported in this browser');
      return;
    }

    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      let finalTranscript = '';

      rec.onresult = (e: any) => {
        // Clear silence timer on every result
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript + ' ';
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        setInput(finalTranscript + interim);

        // Auto-send after 2s of silence
        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            // Stop recording and auto-submit
            stopRecording();
            rec.stop();
          }
        }, 2000);
      };

      rec.onerror = (e: any) => {
        console.warn('[Audio] SpeechRecognition error:', e.error);
        // 'not-allowed' = mic permission denied for speech recognition
        // 'no-speech' = no speech detected
        speechRecRef.current = null;
      };
      rec.onend = () => { speechRecRef.current = null; };

      rec.start();
      speechRecRef.current = rec;
    } catch (err) {
      console.warn('[Audio] Failed to start SpeechRecognition:', err);
    }
  }, [stopRecording]);

  // Handle audio button click — toggle recording
  const handleAudioClick = useCallback(() => {
    if (isAudioMode) {
      // Cancel audio mode
      if (speechRecRef.current) speechRecRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopSpeaking();
      resetRecording();
      setIsAudioMode(false);
      setInput('');
    } else {
      setIsAudioMode(true);
      setInput('');
      startRecording();
      startSpeechRecognition();
    }
  }, [isAudioMode, startRecording, resetRecording, stopSpeaking, startSpeechRecognition]);

  // When recording stops (audioUrl becomes available), auto-submit
  useEffect(() => {
    if (audioUrl && isAudioMode) {
      const audioFile = getAudioFile();
      if (!audioFile) return;

      // Stop speech recognition
      if (speechRecRef.current) speechRecRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Auto-submit the audio
      const doSubmit = async () => {
        if (isSpeaking) stopSpeaking();
        setIsSubmitting(true);

        const transcribedText = input.trim();
        const tempUserMessage: AIMessage = {
          id: 'temp-audio-' + Date.now(),
          sessionId: currentSessionId || '',
          role: 'USER',
          content: transcribedText || '',
          attachments: null, audioUrl: URL.createObjectURL(audioFile), transcription: transcribedText || null,
          isStreaming: false, isComplete: true, hasError: false, errorMessage: null,
          feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempUserMessage]);
        setInput('');
        resetRecording();
        setIsAudioMode(false); // Close audio mode to prevent mic picking up spoken answer

        setStreamingMessage({
          id: 'waiting-audio-' + Date.now(),
          sessionId: currentSessionId || '',
          role: 'ASSISTANT', content: '',
          attachments: null, audioUrl: null, transcription: null,
          isStreaming: true, isComplete: false, hasError: false, errorMessage: null,
          feedback: null, councilResponses: null, createdAt: new Date().toISOString(),
        });

        setShouldScrollToUser(true);

        try {
          await sendAudioMessage(audioFile, currentSessionId || undefined, {
            deepThink: deepThinkEnabled || undefined,
            deepResearch: deepResearchEnabled || undefined,
            council: currentMode === 'COUNCIL' || undefined,
            projectId: selectedProjectId || undefined,
            readAloud: true,
          });
        } catch {
          toast.error('Failed to send audio message');
          setStreamingMessage(null);
        } finally {
          setIsSubmitting(false);
        }
      };

      doSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);


  const hasMessages = messages.length > 0 || streamingMessage || isLoadingSession;

  // Random greeting for empty state
  const [greeting] = useState(() => {
    const firstName = user?.name?.split(' ')[0] || 'there';
    const greetings = [
      `Welcome back, ${firstName}`,
      `Namaste, ${firstName}`,
      `Back at it again, ${firstName}`,
      `Ready to learn, ${firstName}?`,
      `Good to see you, ${firstName}`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  });

  // Save scroll position on unmount
  useEffect(() => {
    return () => { saveScrollPosition(); };
  }, [saveScrollPosition]);

  // Scroll so the latest user message is at the very top of the chat area
  useEffect(() => {
    if (!shouldScrollToUser || !lastUserMessageRef.current) return;

    // Double rAF ensures the browser has committed the layout after React render
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lastUserMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [shouldScrollToUser, messages]);

  // Remove spacer: wait until streaming has started then finished
  const sawStreamingRef = useRef(false);
  useEffect(() => {
    if (!shouldScrollToUser) {
      sawStreamingRef.current = false;
      return;
    }
    // Mark that streaming has begun
    if (isStreaming || isWaitingForStream || streamingMessage) {
      sawStreamingRef.current = true;
    }
    // Only remove spacer after we saw streaming AND it's now done
    if (sawStreamingRef.current && !isStreaming && !isWaitingForStream && !streamingMessage) {
      const timer = setTimeout(() => setShouldScrollToUser(false), 500);
      return () => clearTimeout(timer);
    }
  }, [shouldScrollToUser, isStreaming, isWaitingForStream, streamingMessage]);

  return (
    <div className="min-h-screen bg-[#161616] flex flex-col">
      {/* Header - only show when there are messages */}
      {hasMessages && (
        <div className="sticky top-0 z-10 bg-[#161616]">
          <header className="flex items-center justify-center px-4 py-3 border-b border-gray-800/50 bg-[#161616]/80 backdrop-blur-sm">
            <span className="font-medium text-white text-sm tracking-tight">AI Tutor</span>
          </header>
        </div>
      )}

      {/* Tutor Session - rendered OUTSIDE sticky header so whiteboard isn't clipped */}
      {activeTutorSession && (
        <div className="px-4 py-2 border-b border-gray-800/50 relative z-20">
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

      {/* Chat Area - only render when there are messages */}
      {hasMessages && (
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-16">
          {isLoadingSession ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-6 space-y-6">
              {messages.map((msg, index) => {
                const isLastUserMessage = msg.role === 'USER' && index === messages.length - 1;
                const lastAsstIdx = (() => { for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'ASSISTANT') return i; } return -1; })();
                const isLastAssistantMsg = msg.role === 'ASSISTANT' && !streamingMessage && index === lastAsstIdx;
                // Detect orphaned streaming messages (loaded from DB but not reconnected)
                const isOrphanedStream = msg.role === 'ASSISTANT' && msg.isStreaming && !msg.isComplete && !streamingMessage;
                return (
                  <div key={msg.id} ref={isLastUserMessage ? lastUserMessageRef : undefined} style={isLastUserMessage ? { scrollMarginTop: 60 } : undefined}>
                    {isOrphanedStream ? (
                      <div className="flex justify-start animate-fadeIn">
                        <div className="w-full">
                          <div className="rounded-2xl px-4 py-3 bg-transparent text-[#faf9f5]">
                            {/* Show thinking trace if available */}
                            {msg.thinkingTrace && msg.thinkingTrace.length > 0 && (
                              <ThinkingTrace trace={msg.thinkingTrace} mode={msg.mode} isActive={true} />
                            )}
                            {msg.content && (
                              <div className="ai-response-prose prose prose-invert max-w-none mb-2">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content
                                    .replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2')
                                    .replace(/([^\n#])(#{1,6} )/g, '$1\n\n$2')
                                  }
                                </ReactMarkdown>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                              <span>Reconnecting to stream...</span>
                            </div>
                          </div>
                          <div className="mt-1.5 ml-1">
                            <button onClick={() => handleRetry(msg.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors">
                              <RotateCcw className="w-3 h-3" />
                              Retry
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <MessageBubble
                        message={msg}
                        isCouncilMode={currentMode === 'COUNCIL'}
                        isLastAssistant={isLastAssistantMsg}
                        onRetry={() => handleRetry(msg.id)}
                        onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
                        onAttachmentPreview={handleAttachmentPreview}
                      />
                    )}
                  </div>
                );
              })}
              {streamingMessage && !messages.some((m) => m.id === streamingMessage.id) && (
                <MessageBubble
                  key={`streaming-${streamingMessage.id}`}
                  message={streamingMessage}
                  isStreaming={isStreaming || isWaitingForStream}
                  streamingContent={streamingContent}
                  thinkingTrace={thinkingTrace}
                  streamMode={streamMode}
                  statusText={streamUx.statusText}
                  councilAnalyzing={councilAnalyzing}
                  councilExperts={councilExperts}
                  councilMembers={councilMembers}
                  isSynthesizing={isSynthesizing}
                  isCouncilMode={currentMode === 'COUNCIL'}
                  onRetry={handleRetryStreaming}
                />
              )}
              {/* Spacer to keep user message at top while streaming fills below */}
              {(shouldScrollToUser || isStreaming || isWaitingForStream) && <div style={{ minHeight: '80vh' }} />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className={`${!hasMessages ? 'flex-1 flex flex-col items-center justify-center px-4' : 'sticky bottom-0 bg-gradient-to-t from-[#161616] via-[#161616] to-transparent px-4 lg:px-16'} pt-6 pb-4`}>
        <div className={`${hasMessages ? 'max-w-4xl' : 'w-full max-w-3xl'} mx-auto w-full`}>
          {/* Greeting - only in empty state */}
          {!hasMessages && (
            <h1 className="text-2xl md:text-3xl font-light text-gray-300 text-center mb-8 tracking-tight">
              {greeting}
            </h1>
          )}
          {/* Mode Toggle - above input */}
          <div className="flex justify-center mb-3">
            <ModeToggle mode={currentMode} onChange={handleModeChange} disabled={isStreaming || isSubmitting || isWaitingForStream} />
          </div>
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

          <form onSubmit={handleSubmit}>
            <div className={`relative rounded-2xl transition-all shadow-xl ${isSpeaking ? 'ring-2 ring-violet-500/40' : ''}`}>
              {/* Gradient glow behind textarea when answer is being spoken */}
              {isSpeaking && (
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-violet-500/20 rounded-2xl blur-lg animate-pulse pointer-events-none" />
              )}
              <div className={`relative bg-[#1a1a1a] rounded-2xl border transition-all ${isSpeaking ? 'border-violet-500/40' : 'border-gray-800 focus-within:border-violet-500/50'}`}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  placeholder={isRecording ? (speechRecSupported ? 'Listening... speak now' : 'Recording... tap send when done') : 'Ask me anything about Math, Science, or any subject...'}
                  rows={1}
                  disabled={isSubmitting || isStreaming}
                  readOnly={isRecording}
                  onFocus={() => setIsTextareaFocused(true)}
                  onBlur={() => setTimeout(() => setIsTextareaFocused(false), 150)}
                  className={`w-full p-3 md:p-4 pb-1.5 md:pb-2 bg-transparent resize-none focus:outline-none text-[16px] text-[#faf9f5] placeholder-gray-500 max-h-[200px] ${isRecording ? 'placeholder-violet-400/60' : ''} ${isTextareaFocused || input.trim() ? 'min-h-[56px]' : 'min-h-[40px] md:min-h-[56px]'}`}
                  style={{ fontWeight: 360, height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                  }}
                />
                <div className="flex items-center gap-1 px-2 pb-2">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileSelect} className="hidden" />

                  {isRecording || isAudioMode ? (
                    /* ── RECORDING MODE: full-width controls ── */
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {isRecording && (
                          <div className="flex items-center gap-[2px] h-5 px-1">
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className="w-[3px] rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-500"
                                style={{
                                  height: `${Math.random() * 14 + 6}px`,
                                  animation: `audioBar 0.4s ease-in-out ${i * 0.1}s infinite alternate`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {isRecording && (
                          <span className="text-xs text-violet-400/70">Listening...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isRecording && (
                          <button
                            type="button"
                            onClick={() => { if (speechRecRef.current) speechRecRef.current.stop(); if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); stopRecording(); }}
                            className="p-2 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
                            title="Stop & send"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAudioClick}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Cancel audio"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── NORMAL MODE: all toolbar buttons ── */
                    <>
                      {/* Left side: mode dropdown + attach */}
                      <div className="flex items-center gap-0.5">
                        {/* Mode dropdown (Deep Think / Deep Research) */}
                        {currentMode !== 'COUNCIL' && (
                          <div className="relative" ref={modeDropdownRef}>
                            <button
                              type="button"
                              onClick={() => { setShowModeDropdown(prev => !prev); setShowAttachMenu(false); }}
                              disabled={isSubmitting || isStreaming || isWaitingForStream}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 ${
                                deepThinkEnabled
                                  ? 'text-blue-400 bg-blue-500/15'
                                  : deepResearchEnabled
                                    ? 'text-green-400 bg-green-500/15'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                              }`}
                            >
                              {deepThinkEnabled ? <Brain className="w-4 h-4" /> : deepResearchEnabled ? <Globe className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                              <span className="hidden sm:inline">{deepThinkEnabled ? 'Think' : deepResearchEnabled ? 'Research' : 'Mode'}</span>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {showModeDropdown && (
                              <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => { setDeepThinkEnabled(false); setDeepResearchEnabled(false); setShowModeDropdown(false); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                                    !deepThinkEnabled && !deepResearchEnabled ? 'bg-violet-500/15 text-violet-300' : 'text-gray-300 hover:bg-gray-800'
                                  }`}
                                >
                                  <Sparkles className="w-4 h-4 text-violet-400" />
                                  <div className="text-left">
                                    <div className="font-medium">Normal</div>
                                    <div className="text-[10px] text-gray-500">Standard response</div>
                                  </div>
                                  {!deepThinkEnabled && !deepResearchEnabled && <Check className="w-3.5 h-3.5 ml-auto text-violet-400" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setDeepThinkEnabled(true); setDeepResearchEnabled(false); setShowModeDropdown(false); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                                    deepThinkEnabled ? 'bg-blue-500/15 text-blue-300' : 'text-gray-300 hover:bg-gray-800'
                                  }`}
                                >
                                  <Brain className="w-4 h-4 text-blue-400" />
                                  <div className="text-left">
                                    <div className="font-medium">Deep Think</div>
                                    <div className="text-[10px] text-gray-500">Extended reasoning</div>
                                  </div>
                                  {deepThinkEnabled && <Check className="w-3.5 h-3.5 ml-auto text-blue-400" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setDeepResearchEnabled(true); setDeepThinkEnabled(false); setShowModeDropdown(false); }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                                    deepResearchEnabled ? 'bg-green-500/15 text-green-300' : 'text-gray-300 hover:bg-gray-800'
                                  }`}
                                >
                                  <Globe className="w-4 h-4 text-green-400" />
                                  <div className="text-left">
                                    <div className="font-medium">Deep Research</div>
                                    <div className="text-[10px] text-gray-500">Web search + synthesis</div>
                                  </div>
                                  {deepResearchEnabled && <Check className="w-3.5 h-3.5 ml-auto text-green-400" />}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Attachment button with popover (files + project) */}
                        <div className="relative" ref={attachMenuRef}>
                          <button
                            type="button"
                            onClick={() => { setShowAttachMenu(prev => !prev); setShowModeDropdown(false); }}
                            disabled={isSubmitting || isStreaming || isWaitingForStream}
                            className={`relative p-2 rounded-xl transition-colors disabled:opacity-30 ${
                              selectedProjectId || attachments.length > 0
                                ? 'text-violet-400 bg-violet-500/10'
                                : 'text-gray-500 hover:text-violet-400 hover:bg-violet-500/10'
                            }`}
                            title="Attach"
                          >
                            <Paperclip className="w-5 h-5" />
                            {(selectedProjectId || attachments.length > 0) && (
                              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-violet-400" />
                            )}
                          </button>
                          {showAttachMenu && (
                            <div className="absolute bottom-full mb-2 left-0 w-64 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                              {/* Add from computer */}
                              <button
                                type="button"
                                onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                              >
                                <Paperclip className="w-4 h-4 text-gray-400" />
                                Add from computer
                              </button>
                              {/* Project section */}
                              {[Role.STUDENT, Role.TEACHER, Role.TUTOR].includes(user?.role as Role) && (
                                <>
                                  <div className="border-t border-gray-700/50" />
                                  <button
                                    type="button"
                                    onClick={() => setShowProjectDropdown(prev => !prev)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                                      selectedProjectId ? 'text-violet-300 bg-violet-500/10' : 'text-gray-300 hover:bg-gray-800'
                                    }`}
                                  >
                                    <FolderOpen className="w-4 h-4 text-violet-400" />
                                    <span className="flex-1 text-left truncate">
                                      {selectedProjectTitle ? `Project: ${selectedProjectTitle}` : 'Attach project'}
                                    </span>
                                    {selectedProjectId ? (
                                      <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleProjectSelect(null); }} />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                                    )}
                                  </button>
                                  {showProjectDropdown && (
                                    <div className="border-t border-gray-700/30 max-h-48 overflow-y-auto">
                                      {projects.filter((p) => !p.isArchived).length === 0 ? (
                                        <div className="px-3 py-3 text-xs text-gray-500 text-center">No projects yet</div>
                                      ) : (
                                        projects.filter((p) => !p.isArchived).map((project) => (
                                          <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => { handleProjectSelect(project); setShowAttachMenu(false); }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                              selectedProjectId === project.id
                                                ? 'bg-violet-500/20 text-violet-300'
                                                : 'text-gray-300 hover:bg-gray-800'
                                            }`}
                                          >
                                            <div className="font-medium truncate text-xs">{project.title}</div>
                                            {project.description && (
                                              <div className="text-[10px] text-gray-500 truncate mt-0.5">{project.description}</div>
                                            )}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Right side: audio, tutor, send */}
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={handleAudioClick} disabled={isSubmitting || isStreaming || isWaitingForStream} className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-colors disabled:opacity-30" title="Record voice">
                          <Mic className="w-5 h-5" />
                        </button>
                        {!activeTutorSession && user?.role === Role.STUDENT && (
                          <button type="button" onClick={handleOpenTutorPanel} disabled={isSubmitting || isStreaming || isWaitingForStream || !currentSessionId} className={`p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors disabled:opacity-30 ${isTextareaFocused ? '' : 'hidden md:flex'}`} title="Talk to a human tutor">
                            <UserPlus className="w-5 h-5" />
                          </button>
                        )}
                        {isStreaming ? (
                          <button
                            type="button"
                            onClick={cancelStream}
                            className="p-2 rounded-xl transition-all bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300"
                            title="Stop generating"
                          >
                            <div className="w-5 h-5 flex items-center justify-center">
                              <div className="w-3 h-3 rounded-sm bg-current" />
                            </div>
                          </button>
                        ) : (
                          <button
                            type="submit"
                            disabled={isSubmitting || isWaitingForStream || (!input.trim() && attachments.length === 0)}
                            className={`p-2 rounded-xl transition-all relative ${
                              isSubmitting || isWaitingForStream
                                ? 'bg-gray-800 text-violet-400'
                                : input.trim() || attachments.length > 0
                                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90'
                                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            }`}
                          >
                            {isSubmitting || isWaitingForStream ? (
                              <div className="relative w-5 h-5">
                                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-20" />
                                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                              </div>
                            ) : (
                              <Send className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>

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

      {/* Attachment Preview Modal */}
      {previewData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewData(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-[#1a1a1a] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-medium text-white truncate">{previewData.name}</h3>
              <button
                onClick={() => setPreviewData(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
              {previewData.mimeType.startsWith('image/') ? (
                <img
                  src={previewData.url}
                  alt={previewData.name}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewData.url}
                  title={previewData.name}
                  className="w-full h-[75vh] rounded-lg border-0"
                />
              )}
            </div>
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
        @keyframes breathe {
          0%   { transform: scale(1) rotate(0deg); opacity: 0.7; }
          25%  { transform: scale(1.35) rotate(15deg); opacity: 0.9; }
          50%  { transform: scale(1.6) rotate(-10deg); opacity: 1; }
          75%  { transform: scale(1.3) rotate(8deg); opacity: 0.85; }
          100% { transform: scale(1) rotate(0deg); opacity: 0.7; }
        }
        .animate-breathe {
          animation: breathe 2s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes audioBar {
          0% { height: 6px; }
          100% { height: 18px; }
        }
        .ai-response-prose p {
          font-size: 16px;
          font-weight: 360;
          color: #faf9f5;
          line-height: 1.6;
          margin-top: 0.75em;
          margin-bottom: 0.75em;
        }
        .ai-response-prose h1,
        .ai-response-prose h2,
        .ai-response-prose h3,
        .ai-response-prose h4 {
          font-size: 17px;
          font-weight: 500;
          color: #faf9f5;
          margin-top: 1.25em;
          margin-bottom: 0.5em;
        }
        .ai-response-prose ul,
        .ai-response-prose ol {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          padding-left: 1.5em;
        }
        .ai-response-prose li {
          font-size: 16px;
          font-weight: 360;
          color: #faf9f5;
          line-height: 1.6;
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }
        .ai-response-prose li > p {
          margin-top: 0;
          margin-bottom: 0;
        }
        .ai-response-prose strong {
          font-weight: 550;
          color: #faf9f5;
        }
        .ai-response-prose blockquote {
          border-left: 3px solid #4b5563;
          padding-left: 1em;
          margin-top: 0.75em;
          margin-bottom: 0.75em;
          color: #9ca3af;
          font-size: 16px;
        }
        .ai-response-prose br {
          display: block;
          content: "";
          margin-top: 0.25em;
        }
      `}</style>
    </div>
  );
}

export default StudentDashboard;




