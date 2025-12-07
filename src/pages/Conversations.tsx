import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi } from '../api';
import { Conversation, ConversationStatus, Role, Message, StatusChangeEvent } from '../types';
import { ConversationItem } from '../components/chat/ConversationItem';
import { ConversationSkeleton } from '../components/ui/Loading';
import { NoConversations } from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import { useConversationListUpdates } from '../hooks/useSocket';

export function Conversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | ''>('');

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await messagesApi.getConversations(
        page, 
        10, 
        statusFilter || undefined
      );
      setConversations(response.data.data);
      setTotalPages(response.data.meta.totalPages);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Real-time updates: refresh list when new messages or status changes occur
  const handleNewMessage = useCallback((message: Message) => {
    // Update conversation's last message in place, or refetch
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === message.conversationId) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            updatedAt: message.createdAt,
          };
        }
        return conv;
      });
      // Sort by updated time (most recent first)
      return updated.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, []);

  const handleStatusChange = useCallback((data: StatusChangeEvent) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === data.conversationId 
          ? { ...conv, status: data.status }
          : conv
      )
    );
  }, []);

  useConversationListUpdates({
    onNewMessage: handleNewMessage,
    onStatusChange: handleStatusChange,
  });

  const isStudent = user?.role === Role.STUDENT;

  // Client-side filtering as fallback (in case backend doesn't filter)
  const filteredConversations = statusFilter 
    ? conversations.filter(conv => conv.status === statusFilter)
    : conversations;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">
            {isStudent 
              ? 'Your conversations with tutors' 
              : 'Your assigned conversations'}
          </p>
        </div>
        {isStudent && (
          <Link to="/ask">
            <Button leftIcon={<HelpCircle className="w-4 h-4" />}>
              Ask a Question
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded">
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ConversationStatus | '');
                setPage(1);
              }}
              className="input w-auto py-1.5"
            >
              <option value="">All Conversations</option>
              <option value={ConversationStatus.PENDING}>Pending</option>
              <option value={ConversationStatus.ASSIGNED}>Assigned</option>
              <option value={ConversationStatus.ACTIVE}>Active</option>
              <option value={ConversationStatus.RESOLVED}>Resolved</option>
              <option value={ConversationStatus.CLOSED}>Closed</option>
            </select>
          </div>
        </div>

        {/* Conversations List */}
        {isLoading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <NoConversations
            action={
              isStudent ? (
                <Link to="/ask">
                  <Button leftIcon={<HelpCircle className="w-4 h-4" />}>
                    Ask your first question
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div>
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserRole={user!.role}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Conversations;

