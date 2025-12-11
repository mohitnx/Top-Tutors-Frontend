import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, CheckCircle, Bell, AlertCircle, UserPlus, X, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { messagesApi } from '../../api';
import { Conversation, ConversationStatus } from '../../types';
import { ConversationItem } from '../../components/chat/ConversationItem';
import { ConversationSkeleton } from '../../components/ui/Loading';
import { rejectConversation as socketRejectConversation } from '../../services/socket';
import { SubjectBadge, UrgencyBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

interface PendingConversation extends Conversation {
  canAccept: boolean;
}

interface TutorStatus {
  isBusy: boolean;
  hasActiveSession: boolean;
  canAcceptNew: boolean;
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
      
      // Only keep non-pending (tutor's own sessions)
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

  // Fetch pending conversations matching tutor's topics
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
      // Fallback: fetch regular pending and assume tutor can accept
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
    // First check if tutor can accept
    if (!tutorStatus.canAcceptNew) {
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} 
            max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden`}
          style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
        >
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Complete Your Current Session First
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Please finish or close your active session before accepting a new one.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                // Scroll to active sessions
                document.getElementById('active-sessions')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full mt-3 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Go to Active Session
            </button>
          </div>
        </div>
      ), { duration: 5000, position: 'top-center' });
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
        // Refresh status
        fetchPendingForMe();
      } else if (error?.response?.status === 404 || errorMessage.toLowerCase().includes('taken')) {
        toast.error('This conversation has been taken by another tutor');
        // Remove from list
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

  // Initial fetch and refresh interval
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchConversations(), fetchPendingForMe()]);
      setIsLoading(false);
    };

    fetchAll();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchConversations();
      fetchPendingForMe();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchConversations, fetchPendingForMe]);

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

      {/* Tutor Status Banner */}
      {tutorStatus.hasActiveSession && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">You have an active session</p>
            <p className="text-sm text-amber-700">
              Complete your current session to accept new requests
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => document.getElementById('active-sessions')?.scrollIntoView({ behavior: 'smooth' })}
          >
            View Session
          </Button>
        </div>
      )}

      {!tutorStatus.hasActiveSession && pendingConversations.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Unlock className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">You're available</p>
            <p className="text-sm text-emerald-700">
              {pendingConversations.length} student{pendingConversations.length !== 1 ? 's' : ''} waiting for help
            </p>
          </div>
        </div>
      )}

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
          highlight={stats.pending > 0 && tutorStatus.canAcceptNew}
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

      {/* Active Sessions First (if tutor is busy) */}
      {tutorStatus.hasActiveSession && activeConversations.length > 0 && (
        <div id="active-sessions" className="bg-blue-50 border-2 border-blue-200 rounded-lg mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-blue-900">Current Session</h2>
            </div>
            <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
              Complete to unlock new requests
            </span>
          </div>
          <div>
            {activeConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserRole={user!.role}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending Conversations - Students waiting for help */}
      {pendingConversations.length > 0 && (
        <div className={`border-2 rounded-lg mb-6 ${
          tutorStatus.canAcceptNew 
            ? 'bg-amber-50 border-amber-200 animate-pulse-subtle' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-inherit">
            <div className="flex items-center gap-2">
              <Bell className={`w-5 h-5 ${tutorStatus.canAcceptNew ? 'text-amber-600' : 'text-gray-500'}`} />
              <h2 className={`font-bold ${tutorStatus.canAcceptNew ? 'text-amber-900' : 'text-gray-700'}`}>
                {tutorStatus.canAcceptNew ? 'Students Waiting for Help' : 'Pending Requests (Locked)'}
              </h2>
            </div>
            <span className={`text-sm font-medium px-2 py-1 rounded ${
              tutorStatus.canAcceptNew 
                ? 'text-amber-700 bg-amber-100' 
                : 'text-gray-600 bg-gray-200'
            }`}>
              {pendingConversations.length} waiting
            </span>
          </div>

          <div className="divide-y divide-inherit">
            {pendingConversations.map((conversation) => (
              <div key={conversation.id} className={`p-4 transition-colors ${
                tutorStatus.canAcceptNew ? 'hover:bg-amber-100/50' : 'opacity-75'
              }`}>
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
                    {!tutorStatus.canAcceptNew && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Complete your current session to accept
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
                      disabled={!tutorStatus.canAcceptNew || !conversation.canAccept}
                      leftIcon={tutorStatus.canAcceptNew ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    >
                      {tutorStatus.canAcceptNew ? 'Accept' : 'Locked'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Conversations (if tutor is NOT busy, show them normally) */}
      {!tutorStatus.hasActiveSession && (
        <div id="active-sessions" className="bg-white border border-gray-200 rounded mb-6">
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
      )}

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
