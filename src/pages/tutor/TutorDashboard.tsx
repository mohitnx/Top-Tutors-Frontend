import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Clock, CheckCircle, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus, NewAssignmentEvent } from '../../types';
import { ConversationItem } from '../../components/chat/ConversationItem';
import { ConversationSkeleton } from '../../components/ui/Loading';
import { NoConversations } from '../../components/ui/EmptyState';
import { useTutorNotifications } from '../../hooks/useSocket';
import toast from 'react-hot-toast';

export function TutorDashboard() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
  });

  const fetchConversations = useCallback(async () => {
    try {
      const response = await messagesApi.getConversations(1, 10);
      setConversations(response.data.data);
      
      const allConversations = response.data.data;
      setStats({
        total: response.data.meta.total,
        active: allConversations.filter(c => 
          c.status === ConversationStatus.ACTIVE || c.status === ConversationStatus.ASSIGNED
        ).length,
        resolved: allConversations.filter(c => 
          c.status === ConversationStatus.RESOLVED || c.status === ConversationStatus.CLOSED
        ).length,
      });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle new assignment notifications
  const handleNewAssignment = useCallback((data: NewAssignmentEvent) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-slide-down' : 'opacity-0'
        } max-w-md w-full bg-white shadow-lg rounded pointer-events-auto flex border border-gray-200`}
      >
        <div className="flex-1 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                New question assigned!
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {data.studentName} needs help with {data.subject}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
          <Link
            to={`/conversations/${data.conversationId}`}
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r p-4 flex items-center justify-center text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-gray-50 focus:outline-none"
          >
            View
          </Link>
        </div>
      </div>
    ), { duration: 10000 });

    // Refresh conversations
    fetchConversations();
  }, [fetchConversations]);

  useTutorNotifications({
    onAssignment: handleNewAssignment,
  });

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Total Sessions"
          value={stats.total}
          color="primary"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Active"
          value={stats.active}
          color="amber"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Completed"
          value={stats.resolved}
          color="emerald"
        />
      </div>

      {/* Active Conversations */}
      <div className="bg-white border border-gray-200 rounded mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Active Sessions</h2>
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
              You'll be notified when a new question is assigned to you.
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
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: 'primary' | 'amber' | 'emerald';
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
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
