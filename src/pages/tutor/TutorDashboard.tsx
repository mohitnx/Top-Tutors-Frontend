import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Clock, CheckCircle, Bell, AlertCircle, UserPlus, X, 
  Lock, Unlock, ChevronRight, Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus } from '../../types';
import { rejectConversation as socketRejectConversation } from '../../services/socket';
import { SubjectBadge, UrgencyBadge, StatusBadge } from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import toast from 'react-hot-toast';

interface PendingConversation extends Conversation {
  canAccept: boolean;
}

interface TutorStatus {
  isBusy: boolean;
  hasActiveSession: boolean;
  canAcceptNew: boolean;
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color, highlight = false }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-gray-800/30 rounded-lg p-3 border transition-all ${
      highlight 
        ? 'border-amber-500/50' 
        : 'border-gray-700/50'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<PendingConversation[]>([]);
  const [tutorStatus, setTutorStatus] = useState<TutorStatus>({
    isBusy: false,
    hasActiveSession: false,
    canAcceptNew: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    pending: 0,
  });

  // Fetch tutor's own conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await messagesApi.getConversations(1, 20);
      const allConversations = response.data.data;
      
      const nonPending = allConversations.filter(c => c.status !== ConversationStatus.PENDING);
      setConversations(nonPending);
      
      setStats(prev => ({
        ...prev,
        total: response.data.meta.total,
        active: nonPending.filter(c => 
          c.status === ConversationStatus.ACTIVE || c.status === ConversationStatus.ASSIGNED
        ).length,
        resolved: nonPending.filter(c => 
          c.status === ConversationStatus.RESOLVED || c.status === ConversationStatus.CLOSED
        ).length,
      }));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, []);

  // Fetch pending conversations
  const fetchPendingForMe = useCallback(async () => {
    try {
      const response = await messagesApi.getPendingForMe();
      setPendingConversations(response.data.conversations || []);
      setTutorStatus(response.data.tutorStatus || {
        isBusy: false,
        hasActiveSession: false,
        canAcceptNew: true,
      });
      setStats(prev => ({
        ...prev,
        pending: response.data.conversations?.length || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch pending conversations:', error);
      try {
        const fallback = await messagesApi.getConversations(1, 20, ConversationStatus.PENDING);
        const pending = fallback.data.data.map(c => ({ ...c, canAccept: true }));
        setPendingConversations(pending);
      } catch {
        // Ignore
      }
    }
  }, []);

  // Accept a pending conversation
  const handleAcceptConversation = async (conversationId: string) => {
    if (!tutorStatus.canAcceptNew) {
      toast.error('Complete your current session first');
      return;
    }

    setAcceptingId(conversationId);
    try {
      await messagesApi.acceptConversation(conversationId);
      toast.success('Conversation accepted!');
      navigate(`/conversations/${conversationId}`);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'Failed to accept conversation';
      
      if (error?.response?.status === 409 || errorMessage.toLowerCase().includes('active')) {
        toast.error('Complete your current session first');
        fetchPendingForMe();
      } else if (error?.response?.status === 404 || errorMessage.toLowerCase().includes('taken')) {
        toast.error('This conversation has been taken by another tutor');
        setPendingConversations(prev => prev.filter(c => c.id !== conversationId));
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setAcceptingId(null);
    }
  };

  // Reject/dismiss a pending conversation
  const handleRejectConversation = (conversationId: string) => {
    socketRejectConversation(conversationId);
    setPendingConversations(prev => prev.filter(c => c.id !== conversationId));
    toast('Conversation dismissed');
  };

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchConversations(), fetchPendingForMe()]);
      setIsLoading(false);
    };

    fetchAll();
    
    const interval = setInterval(() => {
      fetchConversations();
      fetchPendingForMe();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchConversations, fetchPendingForMe]);

  const activeConversations = conversations.filter(
    c => c.status === ConversationStatus.ACTIVE || c.status === ConversationStatus.ASSIGNED
  );

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-[#212121] text-white p-4">
      {/* Welcome Section */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'Tutor'}!
            </h1>
            <p className="text-gray-400 text-xs">
              Help students succeed with your expertise
            </p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {tutorStatus.hasActiveSession && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/20 rounded">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-200">Active session in progress</p>
            <p className="text-xs text-amber-300/70">
              Complete to accept new requests
            </p>
          </div>
          <button
            onClick={() => document.getElementById('active-sessions')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded text-xs font-medium hover:bg-amber-500/30 transition-colors"
          >
            View
          </button>
        </div>
      )}

      {!tutorStatus.hasActiveSession && pendingConversations.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 rounded">
            <Unlock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-200">You're available</p>
            <p className="text-xs text-emerald-300/70">
              {pendingConversations.length} student{pendingConversations.length !== 1 ? 's' : ''} waiting
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <StatCard 
          icon={MessageSquare} 
          label="Total" 
          value={stats.total}
          color="bg-blue-500"
        />
        <StatCard 
          icon={AlertCircle} 
          label="Pending" 
          value={stats.pending}
          color="bg-amber-500"
          highlight={stats.pending > 0 && tutorStatus.canAcceptNew}
        />
        <StatCard 
          icon={Clock} 
          label="Active" 
          value={stats.active}
          color="bg-purple-500"
        />
        <StatCard 
          icon={CheckCircle} 
          label="Done" 
          value={stats.resolved}
          color="bg-emerald-500"
        />
      </div>

      {/* Current Session (if busy) */}
      {tutorStatus.hasActiveSession && activeConversations.length > 0 && (
        <div id="active-sessions" className="bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/20">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-blue-200">Current Session</h2>
            </div>
            <span className="text-xs font-medium text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
              Complete to unlock
            </span>
          </div>
          <div>
            {activeConversations.map((conversation) => (
              <Link
                key={conversation.id}
                to={`/conversations/${conversation.id}`}
                className="flex items-center gap-3 p-3 hover:bg-blue-500/10 transition-colors"
              >
                <Avatar name={conversation.student?.user?.name || null} size="sm" className="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium text-white">
                      {conversation.student?.user?.name || 'Student'}
                    </span>
                    <SubjectBadge subject={conversation.subject} />
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {conversation.topic || conversation.messages[0]?.content || 'No messages yet'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pending Requests */}
      {pendingConversations.length > 0 && (
        <div className={`rounded-lg mb-4 overflow-hidden border ${
          tutorStatus.canAcceptNew 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : 'bg-gray-800/30 border-gray-700/50'
        }`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
            <div className="flex items-center gap-1.5">
              <Bell className={`w-4 h-4 ${tutorStatus.canAcceptNew ? 'text-amber-400' : 'text-gray-500'}`} />
              <h2 className={`text-sm font-semibold ${tutorStatus.canAcceptNew ? 'text-amber-200' : 'text-gray-400'}`}>
                {tutorStatus.canAcceptNew ? 'Students Waiting' : 'Pending (Locked)'}
              </h2>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              tutorStatus.canAcceptNew 
                ? 'text-amber-300 bg-amber-500/20' 
                : 'text-gray-500 bg-gray-700/50'
            }`}>
              {pendingConversations.length} waiting
            </span>
          </div>

          <div className="divide-y divide-inherit">
            {pendingConversations.map((conversation) => (
              <div key={conversation.id} className={`p-3 transition-colors ${
                tutorStatus.canAcceptNew ? 'hover:bg-amber-500/10' : 'opacity-60'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Avatar name={conversation.student?.user?.name || null} size="sm" className="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {conversation.student?.user?.name || 'Student'}
                        </span>
                        <SubjectBadge subject={conversation.subject} />
                        <UrgencyBadge urgency={conversation.urgency} />
                      </div>
                      {conversation.topic && (
                        <p className="text-xs text-gray-300 truncate mb-0.5">
                          {conversation.topic}
                        </p>
                      )}
                      {conversation.messages && conversation.messages.length > 0 && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          "{conversation.messages[0]?.content?.slice(0, 80)}..."
                        </p>
                      )}
                      {!tutorStatus.canAcceptNew && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Complete session to accept
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleRejectConversation(conversation.id)}
                      className="flex items-center gap-1 px-2 py-1.5 bg-gray-700/50 text-gray-300 rounded text-xs hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Skip
                    </button>
                    <button
                      onClick={() => handleAcceptConversation(conversation.id)}
                      disabled={!tutorStatus.canAcceptNew || !conversation.canAccept || acceptingId === conversation.id}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                        tutorStatus.canAcceptNew
                          ? 'bg-amber-500 text-black hover:bg-amber-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {acceptingId === conversation.id ? (
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : tutorStatus.canAcceptNew ? (
                        <UserPlus className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      {tutorStatus.canAcceptNew ? 'Accept' : 'Locked'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions (when not busy) */}
      {!tutorStatus.hasActiveSession && (
        <div id="active-sessions" className="bg-gray-800/30 border border-gray-700/50 rounded-lg mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
            <h2 className="text-sm font-semibold text-white">My Active Sessions</h2>
            <span className="text-xs text-gray-500">{activeConversations.length} active</span>
          </div>

          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-700/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : activeConversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 bg-gray-700/50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Clock className="w-5 h-5 text-gray-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-300 mb-1">No active sessions</h3>
              <p className="text-xs text-gray-500">
                {pendingConversations.length > 0 
                  ? 'Accept a pending question above to start!'
                  : 'You\'ll be notified when a question arrives.'}
              </p>
            </div>
          ) : (
            <div>
              {activeConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  to={`/conversations/${conversation.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-gray-700/30 transition-colors"
                >
                  <Avatar name={conversation.student?.user?.name || null} size="sm" className="w-9 h-9" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-medium text-white">
                        {conversation.student?.user?.name || 'Student'}
                      </span>
                      <SubjectBadge subject={conversation.subject} />
                      <StatusBadge status={conversation.status} />
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {conversation.topic || conversation.messages[0]?.content || 'No messages yet'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View All Link */}
      <div className="text-center">
        <Link 
          to="/conversations" 
          className="text-xs text-amber-400 hover:text-amber-300 font-medium"
        >
          View all conversations →
        </Link>
      </div>
    </div>
  );
}

export default TutorDashboard;
