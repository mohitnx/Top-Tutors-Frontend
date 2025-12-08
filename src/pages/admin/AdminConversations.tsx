import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, ExternalLink } from 'lucide-react';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus } from '../../types';
import { Spinner, ConversationSkeleton } from '../../components/ui/Loading';
import { NoConversations } from '../../components/ui/EmptyState';
import { SubjectBadge, StatusBadge, UrgencyBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Avatar from '../../components/ui/Avatar';

export function AdminConversations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | ''>
    (searchParams.get('status')?.toUpperCase() as ConversationStatus || '');

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      try {
        let response;
        if (statusFilter === ConversationStatus.PENDING) {
          response = await messagesApi.getPendingConversations(page, 10);
        } else {
          response = await messagesApi.getConversations(page, 10, statusFilter || undefined);
        }
        setConversations(response.data.data);
        setTotalPages(response.data.meta.totalPages);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [page, statusFilter]);

  const handleStatusFilterChange = (status: ConversationStatus | '') => {
    setStatusFilter(status);
    setPage(1);
    if (status) {
      setSearchParams({ status: status.toLowerCase() });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <p className="text-gray-600">Monitor and manage all platform conversations</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as ConversationStatus | '')}
              className="input w-auto"
            >
              <option value="">All Status</option>
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
          <div className="divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <NoConversations />
        ) : (
          <div className="divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} />
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

function ConversationRow({ conversation }: { conversation: Conversation }) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Student Info */}
        <div className="flex items-center gap-3 lg:w-1/4">
          <Avatar name={conversation.student?.user.name || null} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {conversation.student?.user.name || 'Unknown Student'}
            </p>
            <p className="text-xs text-gray-500">
              {conversation.student?.user.email}
            </p>
          </div>
        </div>

        {/* Topic & Subject */}
        <div className="lg:w-1/4">
          <div className="flex items-center gap-2 mb-1">
            <SubjectBadge subject={conversation.subject} />
            <UrgencyBadge urgency={conversation.urgency} />
          </div>
          {conversation.topic && (
            <p className="text-xs text-gray-500 truncate">{conversation.topic}</p>
          )}
        </div>

        {/* Tutor Info */}
        <div className="lg:w-1/4">
          {conversation.tutor ? (
            <div className="flex items-center gap-2">
              <Avatar name={conversation.tutor.user.name} size="sm" />
              <span className="text-sm text-gray-700">
                {conversation.tutor.user.name}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400 italic">Unassigned</span>
          )}
        </div>

        {/* Status & Actions */}
        <div className="flex items-center justify-between lg:w-1/4">
          <StatusBadge status={conversation.status} />
          <Link
            to={`/conversations/${conversation.id}`}
            className="p-2 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded"
            title="View conversation"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminConversations;


