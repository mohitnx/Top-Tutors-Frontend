import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Filter, Search, ChevronRight, Clock, CheckCircle, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi } from '../api';
import { Conversation, ConversationStatus, Role, Message, StatusChangeEvent } from '../types';
import { SubjectBadge, StatusBadge } from '../components/ui/Badge';
import Avatar from '../components/ui/Avatar';
import { useConversationListUpdates } from '../hooks/useSocket';

export function Conversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await messagesApi.getConversations(
        page, 
        20, 
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

  // Real-time updates
  const handleNewMessage = useCallback((message: Message) => {
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

  // Client-side filtering
  const filteredConversations = conversations.filter(conv => {
    if (statusFilter && conv.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        conv.topic?.toLowerCase().includes(query) ||
        conv.subject.toLowerCase().includes(query) ||
        conv.messages[0]?.content?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Get status icon
  const getStatusIcon = (status: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.PENDING:
        return <Clock className="w-3 h-3 text-amber-400" />;
      case ConversationStatus.ACTIVE:
      case ConversationStatus.ASSIGNED:
        return <MessageSquare className="w-3 h-3 text-emerald-400" />;
      case ConversationStatus.RESOLVED:
      case ConversationStatus.CLOSED:
        return <CheckCircle className="w-3 h-3 text-gray-500" />;
      default:
        return <MessageSquare className="w-3 h-3 text-gray-400" />;
    }
  };

  // Format time
  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-[#212121] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#212121]/95 backdrop-blur-sm border-b border-gray-700/50 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Messages</h1>
            <p className="text-gray-400 text-xs">
              {isStudent 
                ? 'Your conversations with tutors' 
                : 'Your assigned conversations'}
            </p>
          </div>
          {isStudent && (
            <Link 
              to="/dashboard/student"
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Question
            </Link>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ConversationStatus | '');
                setPage(1);
              }}
              className="pl-8 pr-6 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              <option value="">All</option>
              <option value={ConversationStatus.PENDING}>Pending</option>
              <option value={ConversationStatus.ASSIGNED}>Assigned</option>
              <option value={ConversationStatus.ACTIVE}>Active</option>
              <option value={ConversationStatus.RESOLVED}>Resolved</option>
              <option value={ConversationStatus.CLOSED}>Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="px-3 py-2">
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 bg-gray-800/30 rounded-lg animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-3.5 w-28 bg-gray-700 rounded mb-1.5" />
                    <div className="h-3 w-40 bg-gray-700/50 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-gray-800/50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">No conversations yet</h3>
            <p className="text-gray-500 text-xs mb-4">
              {isStudent 
                ? "Start a conversation by asking a question" 
                : "You'll see student questions here"}
            </p>
            {isStudent && (
              <Link
                to="/dashboard/student"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors text-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Ask your first question
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredConversations.map((conversation) => {
              const otherParty = isStudent
                ? conversation.tutor?.user
                : conversation.student?.user;
              const lastMessage = conversation.messages[conversation.messages.length - 1];

              return (
                <Link
                  key={conversation.id}
                  to={`/conversations/${conversation.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/30 hover:border-gray-600/50 rounded-lg transition-all group"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar name={otherParty?.name || null} size="sm" className="w-10 h-10" />
                    <div className="absolute -bottom-0.5 -right-0.5">
                      {getStatusIcon(conversation.status)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-medium text-white truncate">
                        {otherParty?.name || (isStudent ? 'Waiting for tutor...' : 'Student')}
                      </span>
                      <SubjectBadge subject={conversation.subject} />
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {conversation.topic || lastMessage?.content || 'No messages yet'}
                    </p>
                  </div>

                  {/* Time & Arrow */}
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-xs text-gray-500">{formatTime(conversation.updatedAt)}</p>
                      <StatusBadge status={conversation.status} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-amber-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4 pb-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

export default Conversations;
