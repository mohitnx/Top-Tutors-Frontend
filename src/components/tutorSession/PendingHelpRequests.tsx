import { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, Clock, MessageSquare, UserPlus, 
  Loader2, RefreshCw, AlertTriangle, Tag
} from 'lucide-react';
import { tutorSessionApi } from '../../api';
import {
  connectTutorSessionSocket,
  disconnectTutorSessionSocket,
  onNewHelpRequest,
  offNewHelpRequest,
} from '../../services/tutorSessionSocket';
import { PendingHelpRequest, NewHelpRequestEvent, AcceptSessionResponse } from '../../types';
import { SubjectBadge, UrgencyBadge } from '../ui/Badge';
import Avatar from '../ui/Avatar';
import toast from 'react-hot-toast';

interface PendingHelpRequestsProps {
  onAcceptSession: (sessionData: AcceptSessionResponse) => void;
  className?: string;
}

export function PendingHelpRequests({ 
  onAcceptSession,
  className = '' 
}: PendingHelpRequestsProps) {
  const [requests, setRequests] = useState<PendingHelpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Connect to socket and fetch initial data
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Connect to tutor session socket
    connectTutorSessionSocket(token);

    // Initial fetch
    fetchPendingRequests();

    // Listen for new help requests
    const handleNewHelpRequest = (request: NewHelpRequestEvent) => {
      console.log('[PendingHelpRequests] New request:', request);
      
      // Add to list if not already present
      setRequests(prev => {
        if (prev.some(r => r.id === request.tutorSessionId)) {
          return prev;
        }
        
        const newRequest: PendingHelpRequest = {
          id: request.tutorSessionId,
          topic: request.topic,
          subject: request.subject,
          summary: request.summary,
          messageCount: request.messageCount,
          urgency: request.urgency,
          student: {
            id: '',
            name: request.studentName,
          },
          createdAt: new Date().toISOString(),
        };
        
        return [newRequest, ...prev];
      });
      
      // Show notification
      toast('New help request!', {
        icon: '📚',
        duration: 5000,
      });
    };

    onNewHelpRequest(handleNewHelpRequest);

    return () => {
      offNewHelpRequest();
      disconnectTutorSessionSocket();
    };
  }, []);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      const response = await tutorSessionApi.getPendingSessions();
      setRequests(response.data || []);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refresh requests
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchPendingRequests();
  }, [fetchPendingRequests]);

  // Accept a session
  const handleAcceptSession = useCallback(async (requestId: string) => {
    setAcceptingId(requestId);
    
    try {
      const response = await tutorSessionApi.acceptSession(requestId);
      
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Notify parent
      onAcceptSession(response.data);
      
      toast.success('Session accepted!');
    } catch (error: any) {
      console.error('Failed to accept session:', error);
      const message = error?.response?.data?.message || 'Failed to accept session';
      
      if (message.includes('already')) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        toast.error('This session has been taken by another tutor');
      } else {
        toast.error(message);
      }
    } finally {
      setAcceptingId(null);
    }
  }, [onAcceptSession]);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className={`bg-[#1a1a1a] rounded-xl border border-gray-800 p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-3" />
          <p className="text-gray-400 text-sm">Loading help requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Help Requests</h2>
          {requests.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-full">
              {requests.length}
            </span>
          )}
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Pending Requests</h3>
          <p className="text-gray-500 text-sm">
            You'll be notified when a student needs help
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {requests.map((request) => (
            <div key={request.id} className="p-4 hover:bg-gray-800/30 transition-colors">
              {/* Student Info & Subject */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={request.student.name} size="md" />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white">
                        {request.student.name}
                      </span>
                      <SubjectBadge subject={request.subject} />
                      <UrgencyBadge urgency={request.urgency as import('../../types').Urgency} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(request.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {request.messageCount} messages
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleAcceptSession(request.id)}
                  disabled={acceptingId === request.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {acceptingId === request.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Accept
                </button>
              </div>

              {/* Topic */}
              <div className="mb-3">
                <p className="text-sm font-medium text-violet-300 mb-1">
                  {request.topic}
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  AI Summary
                </p>
                <p className="text-sm text-gray-300 line-clamp-3">
                  {request.summary}
                </p>
              </div>

              {/* Keywords */}
              {request.keywords && request.keywords.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-3 h-3 text-gray-500" />
                  {request.keywords.slice(0, 5).map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PendingHelpRequests;

