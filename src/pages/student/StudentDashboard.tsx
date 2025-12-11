import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, HelpCircle, Clock, CheckCircle, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus, TutorAssignedEvent, AllTutorsBusyEvent } from '../../types';
import { ConversationItem } from '../../components/chat/ConversationItem';
import { ConversationSkeleton } from '../../components/ui/Loading';
import { NoConversations } from '../../components/ui/EmptyState';
import { useStudentNotifications } from '../../hooks/useSocket';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    pending: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const response = await messagesApi.getConversations(1, 10);
      setConversations(response.data.data);
      
      // Calculate stats
      const allConversations = response.data.data;
      setStats({
        total: response.data.meta.total,
        pending: allConversations.filter(c => c.status === ConversationStatus.PENDING).length,
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
    fetchData();
  }, [fetchData]);

  // Handle tutor assigned notification
  const handleTutorAssigned = useCallback((data: TutorAssignedEvent) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-slide-down' : 'opacity-0'
        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex border-2 border-green-400`}
      >
        <div className="flex-1 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-bold text-gray-900">
                🎉 Tutor Found!
              </p>
              <p className="mt-1 text-sm text-gray-600">
                <span className="font-medium">{data.tutor.name}</span> is ready to help you!
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/conversations/${data.conversationId}`);
            }}
            className="w-full px-4 flex items-center justify-center text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 focus:outline-none rounded-r-lg"
          >
            Chat Now
          </button>
        </div>
      </div>
    ), { duration: 15000 });

    // Refresh conversations
    fetchData();
  }, [navigate, fetchData]);

  // Handle all tutors busy
  const handleAllTutorsBusy = useCallback((data: AllTutorsBusyEvent) => {
    toast.error(data.message, { duration: 8000 });
  }, []);

  // Subscribe to student notifications
  useStudentNotifications({
    onTutorAssigned: handleTutorAssigned,
    onAllTutorsBusy: handleAllTutorsBusy,
  });

  return (
    <div className="p-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Welcome back, {user?.name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your tutoring sessions.
        </p>
      </div>

      {/* Quick Action Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-600 to-emerald-500 text-white p-6 rounded-lg mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 transform translate-x-16 -translate-y-16">
          <div className="w-full h-full bg-white/10 rounded-full" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium text-primary-100">AI-Powered Matching</span>
            </div>
            <h2 className="text-xl font-bold mb-1">Need help with something?</h2>
            <p className="text-primary-100 text-sm">
              Ask a question and get matched with an expert tutor instantly.
            </p>
          </div>
          <Link to="/ask">
            <Button
              variant="secondary"
              leftIcon={<HelpCircle className="w-4 h-4" />}
              className="bg-white text-primary-600 border-white hover:bg-primary-50 whitespace-nowrap"
            >
              Ask a Question
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Total Questions"
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
          label="Resolved"
          value={stats.resolved}
          color="emerald"
        />
      </div>

      {/* Recent Conversations */}
      <div className="bg-white border border-gray-200 rounded">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Recent Conversations</h2>
          <Link to="/conversations" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <NoConversations
            action={
              <Link to="/ask">
                <Button leftIcon={<HelpCircle className="w-4 h-4" />}>
                  Ask your first question
                </Button>
              </Link>
            }
          />
        ) : (
          <div>
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserRole={user!.role}
              />
            ))}
          </div>
        )}
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

export default StudentDashboard;
