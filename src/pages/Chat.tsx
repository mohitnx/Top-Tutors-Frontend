import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MoreVertical, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi } from '../api';
import { useConversationSocket } from '../hooks/useSocket';
import { Conversation, Message, MessageType, Role, ConversationStatus } from '../types';
import { MessageBubble, MessageInput, TypingIndicator } from '../components/chat/index';
import { SubjectBadge, StatusBadge } from '../components/ui/Badge';
import { MessageSkeleton } from '../components/ui/Loading';
import Avatar from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

export function Chat() {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

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

  // Handle new message from socket
  const handleNewMessage = useCallback((message: Message) => {
    // Skip messages from ourselves (we already added them locally when sending)
    if (message.senderId === user?.id) {
      return;
    }
    
    setMessages(prev => {
      // Avoid duplicates
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
    setIsOtherTyping(false);
    
    // Mark as read
    if (conversationId) {
      messagesApi.markAsRead(conversationId);
    }
  }, [user?.id, conversationId]);

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
      
      // Update conversation status if needed
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

  // Send audio message
  const handleSendAudio = async (audioFile: File) => {
    if (!conversationId) return;

    try {
      const response = await messagesApi.sendAudioMessage(
        audioFile,
        conversationId,
        (progress) => {
          // Could show upload progress here
          console.log(`Upload progress: ${progress}%`);
        }
      );

      // Add the message to the list
      setMessages(prev => [...prev, response.data.message as Message]);
      
      // Show transcription in toast if available
      if (response.data.classification?.transcription) {
        toast.success(`Audio transcribed: "${response.data.classification.transcription.slice(0, 50)}..."`);
      }

      // Update conversation status if needed
      if (conversation?.status !== response.data.conversation.status) {
        setConversation(prev => prev ? { ...prev, status: response.data.conversation.status } : prev);
      }
    } catch (error) {
      console.error('Failed to send audio:', error);
      toast.error('Failed to send audio message');
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

  // Determine other party
  const isStudent = user?.role === Role.STUDENT;
  const otherParty = isStudent 
    ? conversation?.tutor?.user 
    : conversation?.student?.user;

  const canSendMessages = conversation?.status !== ConversationStatus.CLOSED 
    && conversation?.status !== ConversationStatus.RESOLVED;

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <MessageSkeleton />
          <MessageSkeleton isOwn />
          <MessageSkeleton />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <p className="text-gray-500">Conversation not found</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gray-50 lg:bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/conversations')}
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Link to="/conversations" className="hidden lg:block p-1 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <Avatar name={otherParty?.name || null} size="md" />
          
          <div>
            <h2 className="font-semibold text-gray-900">
              {otherParty?.name || 'Unknown'}
            </h2>
            <div className="flex items-center gap-2">
              <SubjectBadge subject={conversation.subject} />
              <StatusBadge status={conversation.status} />
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowOptionsModal(true)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Topic */}
      {conversation.topic && (
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Topic:</span> {conversation.topic}
          </p>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
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
                isOwn={message.senderId === user?.id}
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
        <MessageInput
          onSendText={handleSendText}
          onSendAudio={handleSendAudio}
          onTyping={sendTyping}
          disabled={isSending}
          placeholder={`Message ${otherParty?.name?.split(' ')[0] || 'tutor'}...`}
          showAudioButton={true}
        />
      ) : (
        <div className="p-4 bg-gray-100 border-t border-gray-200 text-center text-sm text-gray-500">
          This conversation has been {conversation.status.toLowerCase()}.
        </div>
      )}

      {/* Options Modal */}
      <Modal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        title="Conversation Options"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">
              <strong>Subject:</strong> {conversation.subject}
            </p>
            {conversation.topic && (
              <p className="text-sm text-gray-600 mt-1">
                <strong>Topic:</strong> {conversation.topic}
              </p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              <strong>Status:</strong> {conversation.status}
            </p>
          </div>

          {canSendMessages && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Close Conversation</p>
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleCloseConversation('RESOLVED')}
                  isLoading={isClosing}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  className="flex-1"
                >
                  Mark Resolved
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCloseConversation('CLOSED')}
                  isLoading={isClosing}
                  leftIcon={<X className="w-4 h-4" />}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Chat;
