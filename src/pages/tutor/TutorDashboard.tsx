import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, CheckCircle, Bell, AlertCircle, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus } from '../../types';
import { ConversationItem } from '../../components/chat/ConversationItem';
import { ConversationSkeleton } from '../../components/ui/Loading';
import { acceptConversation as socketAcceptConversation, rejectConversation as socketRejectConversation } from '../../services/socket';
import { SubjectBadge, UrgencyBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    pending: 0,
  });

  const fetchConversations = useCallback(async () => {
    try {
      const response = await messagesApi.getConversations(1, 20);
      const allConversations = response.data.data;
      
      // Separate pending from active/assigned
      const pending = allConversations.filter(c => c.status === ConversationStatus.PENDING);
      const nonPending = allConversations.filter(c => c.status !== ConversationStatus.PENDING);
      
      setPendingConversations(pending);
      setConversations(nonPending);
      
      setStats({
        total: response.data.meta.total,
        pending: pending.length,
        active: nonPending.filter(c => 
          c.status === ConversationStatus.ACTIVE || c.status === ConversationStatus.ASSIGNED
        ).length,
        resolved: nonPending.filter(c => 
          c.status === ConversationStatus.RESOLVED || c.status === ConversationStatus.CLOSED
        ).length,
      });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Accept a pending conversation
  const handleAcceptConversation = async (conversationId: string) => {
    setAcceptingId(conversationId);
    try {
      // Try API first, fallback to socket
      await messagesApi.acceptConversation(conversationId);
      toast.success('Conversation accepted!');
      navigate(`/conversations/${conversationId}`);
    } catch (error) {
      // Try socket as fallback
      socketAcceptConversation(conversationId);
      toast.success('Conversation accepted!');
      navigate(`/conversations/${conversationId}`);
    } finally {
      setAcceptingId(null);
    }
  };

  // Reject/dismiss a pending conversation
  const handleRejectConversation = (conversationId: string) => {
    socketRejectConversation(conversationId);
    // Remove from local state
    setPendingConversations(prev => prev.filter(c => c.id !== conversationId));
    toast('Conversation dismissed');
  };

  useEffect(() => {
    fetchConversations();
    
    // Refresh every 30 seconds to catch any missed updates
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const activeConversations = conversations.filter(
    c => c.status === ConversationStatus.ACTIVE || c.status === ConversationStatus.ASSIGNED
  );

  return (
    <div className="p-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Hello, {user?.name?.split(' ')[0] || 'Tutor'} 👋
        </h1>
        <p className="text-gray-600">
          Help students succeed with your expertise.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Total Sessions"
          value={stats.total}
          color="primary"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          label="Pending"
          value={stats.pending}
          color="amber"
          highlight={stats.pending > 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Active"
          value={stats.active}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Completed"
          value={stats.resolved}
          color="emerald"
        />
      </div>

      {/* Pending Conversations - Students waiting for help */}
      {pendingConversations.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg mb-6 animate-pulse-subtle">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-amber-900">Students Waiting for Help</h2>
            </div>
            <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
              {pendingConversations.length} waiting
            </span>
          </div>

          <div className="divide-y divide-amber-200">
            {pendingConversations.map((conversation) => (
              <div key={conversation.id} className="p-4 hover:bg-amber-100/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {conversation.student?.user?.name || 'Student'}
                      </span>
                      <SubjectBadge subject={conversation.subject} />
                      <UrgencyBadge urgency={conversation.urgency} />
                    </div>
                    {conversation.topic && (
                      <p className="text-sm text-gray-600 truncate mb-2">
                        {conversation.topic}
                      </p>
                    )}
                    {conversation.messages && conversation.messages.length > 0 && (
                      <p className="text-sm text-gray-500 line-clamp-2">
                        "{conversation.messages[0]?.content?.slice(0, 100)}
                        {(conversation.messages[0]?.content?.length || 0) > 100 ? '...' : ''}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRejectConversation(conversation.id)}
                      leftIcon={<X className="w-4 h-4" />}
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptConversation(conversation.id)}
                      isLoading={acceptingId === conversation.id}
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Conversations */}
      <div className="bg-white border border-gray-200 rounded mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">My Active Sessions</h2>
          <span className="text-sm text-gray-500">{activeConversations.length} active</span>
        </div>

        {isLoading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : activeConversations.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No active sessions</h3>
            <p className="text-sm text-gray-500">
              {pendingConversations.length > 0 
                ? 'Accept a pending question above to start helping!'
                : 'You\'ll be notified when a new question arrives.'}
            </p>
          </div>
        ) : (
          <div>
            {activeConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserRole={user!.role}
              />
            ))}
          </div>
        )}
      </div>

      {/* All Conversations Link */}
      <div className="text-center">
        <Link 
          to="/conversations" 
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          View all conversations →
        </Link>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color,
  highlight = false,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: 'primary' | 'amber' | 'emerald' | 'blue';
  highlight?: boolean;
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className={`bg-white border rounded p-4 ${
      highlight ? 'border-amber-400 ring-2 ring-amber-200 animate-pulse' : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default TutorDashboard;
