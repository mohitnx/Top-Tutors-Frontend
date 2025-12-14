import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Eye, MessageSquare, ThumbsUp, ThumbsDown, ArrowLeft, Loader2, AlertCircle, User, GraduationCap } from 'lucide-react';
import { messagesApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { SubjectBadge, StatusBadge } from '../components/ui/Badge';
import { ConversationStatus, Subject, Role } from '../types';

interface SharedMessage {
  id: string;
  senderType: 'STUDENT' | 'TUTOR' | 'SYSTEM';
  content?: string;
  messageType: string;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
}

interface SharedConversationData {
  id: string;
  subject: string;
  topic?: string;
  studentName: string;
  tutorName?: string;
  status: string;
  createdAt: string;
  messages: SharedMessage[];
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function SharedConversation() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [conversation, setConversation] = useState<SharedConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  useEffect(() => {
    const fetchSharedConversation = async () => {
      if (!shareToken) return;

      setIsLoading(true);
      try {
        const response = await messagesApi.getSharedConversation(shareToken);
        const sharedConv = response.data;
        setConversation(sharedConv);

        // If user is authenticated and is a student or tutor, check if they're a participant
        if (isAuthenticated && user && (user.role === Role.STUDENT || user.role === Role.TUTOR)) {
          setIsCheckingAccess(true);
          try {
            // Try to fetch the actual conversation - if successful, user is a participant
            await messagesApi.getConversation(sharedConv.id);
            // User has access - redirect to the actual conversation
            navigate(`/conversations/${sharedConv.id}`, { replace: true });
            return;
          } catch {
            // User doesn't have access - show read-only view
            setIsCheckingAccess(false);
          }
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: { message?: string } } } };
        setError(error.response?.data?.error?.message || 'Failed to load shared conversation');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedConversation();
  }, [shareToken, isAuthenticated, user, navigate]);

  if (isLoading || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {isCheckingAccess ? 'Checking access...' : 'Loading shared conversation...'}
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated and there's an error (likely 401), show login prompt
  if (!isAuthenticated && (error || !conversation)) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Shared Conversation</h1>
          <p className="text-gray-400 mb-6">
            Sign in to view this shared conversation.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to={`/?redirect=/shared/${shareToken}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
            >
              Sign In to View
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Unable to Load</h1>
          <p className="text-gray-400 mb-6">{error || 'This shared conversation is no longer available.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#212121] text-white">
      {/* View-only Banner */}
      <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm text-blue-200">
          <Eye className="w-4 h-4" />
          <span className="font-medium">Shared Conversation</span>
          <span className="text-blue-300/70">— View Only</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#1c1c1c] border-b border-gray-700/50 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link
              to="/"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <SubjectBadge subject={conversation.subject as Subject} />
              <StatusBadge status={conversation.status as ConversationStatus} />
            </div>
          </div>

          {conversation.topic && (
            <h1 className="text-lg font-semibold mb-2">{conversation.topic}</h1>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>{conversation.studentName}</span>
            </div>
            {conversation.tutorName && (
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4" />
                <span>{conversation.tutorName}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>{conversation.messages.length} messages</span>
            </div>
            <span>{formatDate(conversation.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {conversation.messages.map((message) => {
          if (message.senderType === 'SYSTEM') {
            return (
              <div key={message.id} className="flex justify-center">
                <div className="bg-gray-700/50 text-gray-400 text-xs px-4 py-1.5 rounded-full">
                  {message.content}
                </div>
              </div>
            );
          }

          const isStudent = message.senderType === 'STUDENT';
          
          return (
            <div key={message.id} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isStudent
                    ? 'bg-amber-500 text-black rounded-br-md'
                    : 'bg-gray-800/80 border border-gray-700/50 text-gray-100 rounded-bl-md'
                }`}
              >
                {/* Sender Label */}
                <div className={`text-xs font-medium mb-1 ${isStudent ? 'text-black/60' : 'text-gray-500'}`}>
                  {isStudent ? conversation.studentName : conversation.tutorName}
                </div>

                {/* Content */}
                {message.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}

                {/* Footer */}
                <div className={`flex items-center justify-between gap-2 mt-1.5 ${isStudent ? 'text-black/50' : 'text-gray-500'}`}>
                  {/* Reactions for tutor messages */}
                  {!isStudent && (message.likeCount > 0 || message.dislikeCount > 0) ? (
                    <div className="flex items-center gap-2 text-xs">
                      {message.likeCount > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-400">
                          <ThumbsUp className="w-3 h-3" /> {message.likeCount}
                        </span>
                      )}
                      {message.dislikeCount > 0 && (
                        <span className="flex items-center gap-0.5 text-red-400">
                          <ThumbsDown className="w-3 h-3" /> {message.dislikeCount}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div />
                  )}
                  <span className="text-[10px]">{formatTime(message.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1c1c1c] border-t border-gray-700/50 p-4">
        <div className="max-w-3xl mx-auto text-center">
          {isAuthenticated ? (
            <>
              <p className="text-sm text-gray-400 mb-2">
                You're viewing a shared conversation
              </p>
              <Link
                to="/conversations"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
              >
                Go to My Conversations
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-2">
                Want to get help like this?
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
              >
                Get Started with TopTutors
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SharedConversation;

