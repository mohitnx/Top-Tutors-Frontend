import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, X, Clock, Loader2, Settings, Share2, Copy, Check, Link2Off } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi } from '../api';
import { useConversationSocket } from '../hooks/useSocket';
import { getSocket, onSocketConnect, closeConversation as socketCloseConversation } from '../services/socket';
import { Conversation, Message, MessageType, Role, ConversationStatus, CallStatus, StatusChangeEvent, SenderType, TutorAssignedEvent, ReactionType, ConversationClosedEvent } from '../types';
import { MessageBubble, MessageInput, TypingIndicator } from '../components/chat/index';
import { SubjectBadge, StatusBadge } from '../components/ui/Badge';
import Avatar from '../components/ui/Avatar';
import { CallButton, ActiveCallUI, CallHistoryModal } from '../components/call';
import { useCall } from '../contexts/CallContext';
import toast from 'react-hot-toast';

export function Chat() {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { callState } = useCall();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shareStatus, setShareStatus] = useState<{
    isShared: boolean;
    shareUrl: string | null;
  }>({ isShared: false, shareUrl: null });
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Check if currently in a call for this conversation
  const isInActiveCall = callState.conversationId === conversationId && 
    callState.status !== CallStatus.IDLE;

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversation
  useEffect(() => {
    const fetchConversation = async () => {
      if (!conversationId) return;
      
      setIsLoading(true);
      try {
        const response = await messagesApi.getConversation(conversationId);
        setConversation(response.data);
        setMessages(response.data.messages || []);
        
        // Mark as read
        await messagesApi.markAsRead(conversationId);
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
        toast.error('Failed to load conversation');
        navigate('/conversations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [conversationId, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Determine the current user's sender type based on their role
  const mySenderType = user?.role === Role.STUDENT ? SenderType.STUDENT : SenderType.TUTOR;

  // Handle new message from socket
  const handleNewMessage = useCallback((message: Message) => {
    if (message.senderType === mySenderType) {
      return;
    }
    
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
    setIsOtherTyping(false);
    
    if (conversationId) {
      messagesApi.markAsRead(conversationId);
    }
  }, [mySenderType, conversationId]);

  // Handle typing indicator
  const handleTyping = useCallback(({ isTyping }: { userId: string; isTyping: boolean }) => {
    setIsOtherTyping(isTyping);
  }, []);

  // Socket hook
  const { sendTyping } = useConversationSocket({
    conversationId: conversationId || '',
    onMessage: handleNewMessage,
    onTyping: handleTyping,
  });

  // Listen for status changes and conversation closed events
  useEffect(() => {
    const handleStatusChange = (data: StatusChangeEvent) => {
      if (data.conversationId === conversationId) {
        setConversation(prev => prev ? { ...prev, status: data.status } : prev);
        
        const statusMessages: Record<string, string> = {
          [ConversationStatus.RESOLVED]: 'This conversation has been marked as resolved',
          [ConversationStatus.CLOSED]: 'This conversation has been closed',
        };
        
        if (statusMessages[data.status]) {
          toast(statusMessages[data.status], { icon: '✅' });
        }
      }
    };

    const handleConversationClosed = (data: ConversationClosedEvent) => {
      if (data.conversationId === conversationId) {
        // Update conversation status
        setConversation(prev => prev ? { ...prev, status: data.status as ConversationStatus } : prev);
        
        // Show notification about who closed it
        const closerRole = data.closedBy.role === 'TUTOR' ? 'Tutor' : 'Student';
        const closerName = data.closedBy.name || closerRole;
        
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden`}
            style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
          >
            <div className={`h-1 bg-gradient-to-r ${
              data.status === 'RESOLVED' 
                ? 'from-emerald-400 to-teal-500' 
                : 'from-gray-400 to-gray-500'
            }`} />
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                  data.status === 'RESOLVED'
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}>
                  {data.status === 'RESOLVED' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Session {data.status === 'RESOLVED' ? 'Resolved' : 'Closed'}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    This session was {data.status.toLowerCase()} by {closerName}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ), { duration: 5000, position: 'top-center' });
      }
    };

    const handleTutorAssigned = (data: TutorAssignedEvent) => {
      if (data.conversationId === conversationId) {
        messagesApi.getConversation(conversationId).then(response => {
          setConversation(response.data);
          toast.success(`${data.tutor.name} is now helping you!`);
        }).catch(console.error);
      }
    };

    const setupListener = () => {
      const socket = getSocket();
      if (!socket) return;
      socket.on('statusChange', handleStatusChange);
      socket.on('tutorAssigned', handleTutorAssigned);
      socket.on('conversationClosed', handleConversationClosed);
    };

    setupListener();
    const unsubscribe = onSocketConnect(setupListener);

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('statusChange', handleStatusChange);
        socket.off('tutorAssigned', handleTutorAssigned);
        socket.off('conversationClosed', handleConversationClosed);
      }
      unsubscribe();
    };
  }, [conversationId]);

  // Send text message
  const handleSendText = async (content: string) => {
    if (!conversationId || isSending) return;

    setIsSending(true);
    try {
      const response = await messagesApi.sendMessage({
        content,
        messageType: MessageType.TEXT,
        conversationId,
      });

      setMessages(prev => [...prev, response.data.message]);
      
      if (conversation?.status !== response.data.conversation.status) {
        setConversation(prev => prev ? { ...prev, status: response.data.conversation.status } : prev);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Send attachments
  const handleSendAttachments = async (files: File[], content?: string) => {
    if (!conversationId) return;

    try {
      const response = await messagesApi.sendAttachments(
        conversationId,
        files,
        content,
        (progress) => {
          console.log(`Upload progress: ${progress}%`);
        }
      );

      setMessages(prev => [...prev, response.data.message as Message]);
    } catch (error) {
      console.error('Failed to send attachments:', error);
      toast.error('Failed to send attachments');
      throw error;
    }
  };

  // Close conversation
  const handleCloseConversation = async (status: 'RESOLVED' | 'CLOSED') => {
    if (!conversationId) return;
    
    setIsClosing(true);
    try {
      const response = await messagesApi.closeConversation(conversationId, status);
      setConversation(prev => prev ? { ...prev, status: response.data.status } : prev);
      toast.success(`Conversation marked as ${status.toLowerCase()}`);
      setShowOptionsModal(false);
    } catch (error) {
      console.error('Failed to close conversation:', error);
      toast.error('Failed to update conversation');
    } finally {
      setIsClosing(false);
    }
  };

  // Fetch share status
  useEffect(() => {
    const fetchShareStatus = async () => {
      if (!conversationId) return;
      try {
        const response = await messagesApi.getShareStatus(conversationId);
        setShareStatus({
          isShared: response.data.isShared,
          shareUrl: response.data.shareUrl ? `${window.location.origin}${response.data.shareUrl}` : null,
        });
      } catch (error) {
        // Ignore - share status not critical
      }
    };
    fetchShareStatus();
  }, [conversationId]);

  // Share conversation
  const handleShare = async () => {
    if (!conversationId) return;
    setIsSharing(true);
    try {
      const response = await messagesApi.shareConversation(conversationId);
      const fullUrl = `${window.location.origin}${response.data.shareUrl}`;
      setShareStatus({ isShared: true, shareUrl: fullUrl });
      await navigator.clipboard.writeText(fullUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      toast.success('Share link copied!');
    } catch (error) {
      console.error('Failed to share:', error);
      toast.error('Failed to share conversation');
    } finally {
      setIsSharing(false);
    }
  };

  // Unshare conversation
  const handleUnshare = async () => {
    if (!conversationId) return;
    try {
      await messagesApi.unshareConversation(conversationId);
      setShareStatus({ isShared: false, shareUrl: null });
      toast.success('Sharing disabled');
    } catch (error) {
      console.error('Failed to unshare:', error);
      toast.error('Failed to disable sharing');
    }
  };

  // Copy share link
  const handleCopyShareLink = async () => {
    if (!shareStatus.shareUrl) return;
    await navigator.clipboard.writeText(shareStatus.shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
    toast.success('Link copied!');
  };

  // Handle reaction changes
  const handleReactionChange = (messageId: string, likeCount: number, dislikeCount: number, userReaction: ReactionType | null) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, likeCount, dislikeCount, userReaction } : m
    ));
  };

  // Determine other party
  const isStudent = user?.role === Role.STUDENT;
  const otherParty = isStudent
    ? conversation?.tutor?.user
    : conversation?.student?.user;

  const isWaitingForTutor = isStudent && 
    conversation?.status === ConversationStatus.PENDING && 
    !conversation?.tutor;

  const canSendMessages = conversation?.status !== ConversationStatus.CLOSED
    && conversation?.status !== ConversationStatus.RESOLVED;

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-[#212121]">
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-xl animate-pulse" />
            <div>
              <div className="h-4 w-32 bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-3 w-24 bg-gray-700/50 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="flex justify-end">
            <div className="w-48 h-16 bg-gray-700/30 rounded-2xl animate-pulse" />
          </div>
          <div className="flex justify-start">
            <div className="w-64 h-20 bg-gray-700/30 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#212121]">
        <p className="text-gray-500">Conversation not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#212121]">
      {/* Header */}
      <div className="bg-[#1c1c1c] border-b border-gray-700/50 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/conversations')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {isWaitingForTutor ? (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white animate-pulse" />
            </div>
          ) : (
            <Avatar name={otherParty?.name || null} size="md" />
          )}

          <div>
            <h2 className="font-semibold text-white">
              {isWaitingForTutor ? 'Finding a tutor...' : (otherParty?.name || 'Tutor')}
            </h2>
            <div className="flex items-center gap-2">
              <SubjectBadge subject={conversation.subject} />
              <StatusBadge status={conversation.status} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {canSendMessages && conversation.tutorId && (
            <CallButton 
              conversationId={conversationId!}
              disabled={!canSendMessages}
            />
          )}
          
          {/* Share Button */}
          <button
            onClick={shareStatus.isShared ? handleCopyShareLink : handleShare}
            disabled={isSharing}
            className={`p-2 rounded-lg transition-colors ${
              shareStatus.isShared 
                ? 'text-emerald-400 hover:bg-emerald-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
            title={shareStatus.isShared ? 'Copy share link' : 'Share conversation'}
          >
            {isSharing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : shareCopied ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setShowCallHistory(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
            title="Call History"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowOptionsModal(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Topic */}
      {conversation.topic && (
        <div className="bg-gray-800/30 px-4 py-2 border-b border-gray-700/30 flex-shrink-0">
          <p className="text-xs text-gray-400">
            <span className="font-medium text-gray-300">Topic:</span> {conversation.topic}
          </p>
        </div>
      )}

      {/* Waiting for Tutor Banner */}
      {isWaitingForTutor && (
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-amber-500/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-500/20 rounded-lg">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-200">
                Looking for the best tutor for you...
              </p>
              <p className="text-xs text-amber-300/70">
                Our tutors are being notified. You'll be connected shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        style={{
          background: 'linear-gradient(180deg, #1a1a1a 0%, #212121 100%)',
        }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderType === mySenderType}
                onReactionChange={handleReactionChange}
              />
            ))}
            {isOtherTyping && (
              <TypingIndicator name={otherParty?.name?.split(' ')[0]} />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      {canSendMessages ? (
        <div className="border-t border-gray-700/50 bg-[#1c1c1c]">
          <MessageInput
            onSendText={handleSendText}
            onSendAttachments={handleSendAttachments}
            onTyping={sendTyping}
            disabled={isSending}
            placeholder={`Message ${otherParty?.name?.split(' ')[0] || 'tutor'}...`}
          />
        </div>
      ) : (
        <div className="p-4 bg-gray-800/50 border-t border-gray-700/50 text-center text-sm text-gray-400">
          This conversation has been {conversation.status.toLowerCase()}.
        </div>
      )}

      {/* Options Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Conversation Options</h3>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 bg-gray-900/50 rounded-xl mb-4">
              <p className="text-sm text-gray-300">
                <strong className="text-gray-200">Subject:</strong> {conversation.subject.replace('_', ' ')}
              </p>
              {conversation.topic && (
                <p className="text-sm text-gray-300 mt-1">
                  <strong className="text-gray-200">Topic:</strong> {conversation.topic}
                </p>
              )}
              <p className="text-sm text-gray-300 mt-1">
                <strong className="text-gray-200">Status:</strong> {conversation.status}
              </p>
            </div>

            {/* Sharing Section */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-300 mb-2">Sharing</p>
              {shareStatus.isShared ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg">
                    <input 
                      type="text" 
                      value={shareStatus.shareUrl || ''} 
                      readOnly 
                      className="flex-1 bg-transparent text-xs text-gray-400 outline-none truncate"
                    />
                    <button 
                      onClick={handleCopyShareLink}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={handleUnshare}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                  >
                    <Link2Off className="w-4 h-4" />
                    Stop Sharing
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors text-sm disabled:opacity-50"
                >
                  {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  Share Conversation
                </button>
              )}
            </div>

            {canSendMessages && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300 mb-2">Close Conversation</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCloseConversation('RESOLVED')}
                    disabled={isClosing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Resolved
                  </button>
                  <button
                    onClick={() => handleCloseConversation('CLOSED')}
                    disabled={isClosing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700/50 text-gray-300 border border-gray-600/50 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Call UI */}
      {isInActiveCall && conversationId && (
        <ActiveCallUI
          conversationId={conversationId}
          otherPartyName={otherParty?.name || undefined}
        />
      )}

      {/* Call History Modal */}
      <CallHistoryModal
        isOpen={showCallHistory}
        onClose={() => setShowCallHistory(false)}
        conversationId={conversationId}
      />
    </div>
  );
}

export default Chat;
