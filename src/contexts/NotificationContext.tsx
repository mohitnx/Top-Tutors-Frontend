import { createContext, useContext, useEffect, useCallback, useRef, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, X, Check, Clock, AlertTriangle, Bell } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getSocket, onSocketConnect, respondAvailability } from '../services/socket';
import { 
  Role, 
  NewPendingConversationEvent, 
  NewAssignmentEvent,
  WaitingStudentNotification,
  AvailabilityReminder,
  SessionTakenEvent,
  ConversationTakenEvent,
} from '../types';
import { messagesApi } from '../api';
import { WaitingStudentModal } from '../components/queue';
import toast from 'react-hot-toast';

interface NotificationContextType {
  requestNotificationPermission: () => Promise<boolean>;
  waitingStudentNotification: WaitingStudentNotification | null;
  clearWaitingStudentNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  requestNotificationPermission: async () => false,
  waitingStudentNotification: null,
  clearWaitingStudentNotification: () => {},
});

// Request browser notification permission
async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('[Notification] Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show browser notification (works even when tab is not focused)
function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'top-tutors-notification',
      requireInteraction: true,
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    // Auto close after 30 seconds
    setTimeout(() => notification.close(), 30000);
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const shownNotificationsRef = useRef<Set<string>>(new Set());
  
  // Waiting queue state
  const [waitingStudentNotification, setWaitingStudentNotification] = useState<WaitingStudentNotification | null>(null);
  
  const clearWaitingStudentNotification = useCallback(() => {
    setWaitingStudentNotification(null);
  }, []);

  // Request permission on mount for tutors
  useEffect(() => {
    if (isAuthenticated && user?.role === Role.TUTOR) {
      requestBrowserNotificationPermission();
    }
  }, [isAuthenticated, user?.role]);

  // Accept conversation handler
  const handleAcceptConversation = useCallback(async (conversationId: string) => {
    try {
      await messagesApi.acceptConversation(conversationId);
      toast.success('Conversation accepted!');
      navigate(`/conversations/${conversationId}`);
    } catch (error: any) {
      console.error('Failed to accept conversation:', error);
      
      // Handle specific error cases
      const errorMessage = error?.response?.data?.message || error?.message || '';
      const errorCode = error?.response?.status;
      
      if (errorCode === 409 || errorMessage.toLowerCase().includes('busy') || 
          errorMessage.toLowerCase().includes('active conversation') ||
          errorMessage.toLowerCase().includes('already')) {
        // Tutor is busy with another conversation
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
                  <span className="text-xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Complete Your Current Assignment First
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    You already have an active conversation. Please complete or close it before accepting a new one.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate('/conversations?status=ACTIVE');
                }}
                className="w-full mt-3 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                Go to Active Conversations
              </button>
            </div>
          </div>
        ), { duration: 8000, position: 'top-center' });
      } else if (errorCode === 404 || errorMessage.toLowerCase().includes('not found') ||
                 errorMessage.toLowerCase().includes('already accepted')) {
        // Conversation was already taken by another tutor
        toast.error('This conversation has already been accepted by another tutor');
      } else {
        toast.error('Failed to accept conversation. Please try again.');
      }
    }
  }, [navigate]);

  // Handle new pending conversation (for tutors)
  const handleNewPendingConversation = useCallback((data: NewPendingConversationEvent) => {
    console.log('[GlobalNotification] Received newPendingConversation:', data);
    
    const { conversation, wave } = data;
    const isViewOnly = wave === -1; // Tutor is busy, can only view

    // Prevent duplicate notifications
    if (shownNotificationsRef.current.has(conversation.id)) {
      console.log('[GlobalNotification] Skipping duplicate notification for:', conversation.id);
      return;
    }
    shownNotificationsRef.current.add(conversation.id);
    
    // Clear old entries after 1 minute
    setTimeout(() => {
      shownNotificationsRef.current.delete(conversation.id);
    }, 60000);

    const studentName = conversation.student?.user?.name || 'A student';
    const subject = conversation.subject?.replace('_', ' ') || 'General';

    // Show browser notification (works even in background tabs)
    showBrowserNotification(
      isViewOnly ? '📋 New Question (View Only)' : '📚 New Student Question',
      isViewOnly 
        ? `${studentName} needs help with ${subject}. Complete your current session to accept.`
        : `${studentName} needs help with ${subject}`,
      isViewOnly ? undefined : () => handleAcceptConversation(conversation.id)
    );

    // Show in-app toast notification (sleek design)
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden`}
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
      >
        {/* Accent bar - amber for view-only, green for available */}
        <div className={`h-1 bg-gradient-to-r ${
          isViewOnly 
            ? 'from-amber-400 to-orange-500' 
            : 'from-emerald-400 to-teal-500'
        }`} />
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar placeholder */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
              isViewOnly 
                ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                : 'bg-gradient-to-br from-emerald-400 to-teal-500'
            }`}>
              {studentName.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {studentName}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                Needs help with <span className={`font-medium ${isViewOnly ? 'text-amber-600' : 'text-teal-600'}`}>{subject}</span>
              </p>
              {conversation.topic && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {conversation.topic}
                </p>
              )}
              {isViewOnly && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Complete your current session to accept
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {isViewOnly ? (
              // View-only: Just dismiss button and info
              <>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    navigate('/conversations?status=ACTIVE');
                  }}
                  className="flex-1 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium rounded-md transition-colors"
                >
                  Go to Active Session
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              // Available: Accept and dismiss buttons
              <>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    handleAcceptConversation(conversation.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    ), { duration: isViewOnly ? 15000 : 30000, position: 'top-right' });

    // Play notification sound (quieter for view-only)
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = isViewOnly ? 0.15 : 0.3;
      audio.play().catch(() => {});
    } catch {}
  }, [handleAcceptConversation, navigate]);

  // Handle new assignment (admin assigned this tutor specifically)
  const handleNewAssignment = useCallback((data: NewAssignmentEvent) => {
    console.log('[GlobalNotification] Received newAssignment:', data);

    // Prevent duplicates
    if (shownNotificationsRef.current.has(data.conversationId)) {
      return;
    }
    shownNotificationsRef.current.add(data.conversationId);
    setTimeout(() => shownNotificationsRef.current.delete(data.conversationId), 60000);

    // Browser notification
    showBrowserNotification(
      '✅ Question Assigned',
      `${data.studentName} needs help with ${data.subject}`,
      () => navigate(`/conversations/${data.conversationId}`)
    );
    
    // In-app toast
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden`}
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
      >
        <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white flex-shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Question Assigned to You
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {data.studentName} • <span className="text-indigo-600">{data.subject}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/conversations/${data.conversationId}`);
            }}
            className="w-full mt-3 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-md transition-colors"
          >
            Open Chat
          </button>
        </div>
      </div>
    ), { duration: 15000, position: 'top-right' });
  }, [navigate]);

  // Handle waiting student notification (for busy tutors)
  const handleWaitingStudentNotification = useCallback((data: WaitingStudentNotification) => {
    console.log('[GlobalNotification] Received waitingStudentNotification:', data);

    // Prevent duplicates
    const notificationKey = `waiting-${data.conversation.id}`;
    if (shownNotificationsRef.current.has(notificationKey)) {
      return;
    }
    shownNotificationsRef.current.add(notificationKey);
    setTimeout(() => shownNotificationsRef.current.delete(notificationKey), 120000);

    // Set the notification to show modal
    if (data.requiresAvailabilityResponse) {
      setWaitingStudentNotification(data);
    }

    // Browser notification
    showBrowserNotification(
      '⏳ Student Waiting',
      `${data.conversation.student.name} has been waiting ${data.waitingQueue.waitingMinutes} minutes for help with ${data.conversation.subject.replace('_', ' ')}`,
    );

    // Play notification sound
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  // Handle availability reminder (tutor's stated time has arrived)
  const handleAvailabilityReminder = useCallback((data: AvailabilityReminder) => {
    console.log('[GlobalNotification] Received availabilityReminder:', data);

    // Browser notification
    showBrowserNotification(
      '⏰ Time to Help!',
      data.message,
      data.canAcceptNow ? () => handleAcceptConversation(data.conversationId) : undefined
    );

    // Show urgent in-app toast
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden`}
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
      >
        <div className="h-1 bg-gradient-to-r from-amber-400 to-red-500" />
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center text-white flex-shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Time to Help!
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {data.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.conversation.student.name} • {data.conversation.subject.replace('_', ' ')}
              </p>
            </div>
          </div>

          {data.canAcceptNow && (
            <button
              onClick={() => {
                toast.dismiss(t.id);
                handleAcceptConversation(data.conversationId);
              }}
              className="w-full mt-3 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Accept Now
            </button>
          )}
        </div>
      </div>
    ), { duration: 30000, position: 'top-right' });

    // Play urgent notification sound
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  }, [handleAcceptConversation]);

  // Handle session taken (another tutor took the session)
  const handleSessionTaken = useCallback((data: SessionTakenEvent) => {
    console.log('[GlobalNotification] Received sessionTaken:', data);

    // Clear the waiting student notification if it's for this conversation
    setWaitingStudentNotification(prev => 
      prev?.conversation.id === data.conversationId ? null : prev
    );

    // Show brief toast
    toast(data.message || 'Session taken by another tutor', {
      icon: '👋',
      duration: 3000,
    });
  }, []);

  // Handle conversation taken (broadcast to all tutors)
  const handleConversationTaken = useCallback((data: ConversationTakenEvent) => {
    console.log('[GlobalNotification] Received conversationTaken:', data);

    // Clear the waiting student notification if it's for this conversation
    setWaitingStudentNotification(prev => 
      prev?.conversation.id === data.conversationId ? null : prev
    );
  }, []);

  // Set up global socket listeners for tutors
  useEffect(() => {
    // Only for authenticated tutors
    if (!isAuthenticated || user?.role !== Role.TUTOR) {
      return;
    }

    let isSubscribed = true;

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[GlobalNotification] Setting up tutor notification listeners');

      // Remove existing listeners first to prevent duplicates
      socket.off('newPendingConversation');
      socket.off('newAssignment');
      socket.off('waitingStudentNotification');
      socket.off('availabilityReminder');
      socket.off('sessionTaken');
      socket.off('conversationTaken');

      // Listen for new pending conversations
      socket.on('newPendingConversation', (data: NewPendingConversationEvent) => {
        console.log('[GlobalNotification] Received newPendingConversation event!');
        handleNewPendingConversation(data);
      });

      // Listen for admin assignments
      socket.on('newAssignment', (data: NewAssignmentEvent) => {
        handleNewAssignment(data);
      });

      // Listen for waiting student notifications (busy tutors)
      socket.on('waitingStudentNotification', (data: WaitingStudentNotification) => {
        handleWaitingStudentNotification(data);
      });

      // Listen for availability reminders
      socket.on('availabilityReminder', (data: AvailabilityReminder) => {
        handleAvailabilityReminder(data);
      });

      // Listen for session taken
      socket.on('sessionTaken', (data: SessionTakenEvent) => {
        handleSessionTaken(data);
      });

      // Listen for conversation taken
      socket.on('conversationTaken', (data: ConversationTakenEvent) => {
        handleConversationTaken(data);
      });
    };

    // Set up immediately
    setupListeners();

    // Also set up on reconnect
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      const socket = getSocket();
      if (socket) {
        socket.off('newPendingConversation');
        socket.off('newAssignment');
        socket.off('waitingStudentNotification');
        socket.off('availabilityReminder');
        socket.off('sessionTaken');
        socket.off('conversationTaken');
      }
      unsubscribe();
    };
  }, [isAuthenticated, user?.role, handleNewPendingConversation, handleNewAssignment, handleWaitingStudentNotification, handleAvailabilityReminder, handleSessionTaken, handleConversationTaken]);

  const requestNotificationPermission = useCallback(async () => {
    return requestBrowserNotificationPermission();
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      requestNotificationPermission,
      waitingStudentNotification,
      clearWaitingStudentNotification,
    }}>
      {children}
      
      {/* Waiting Student Modal for busy tutors */}
      {waitingStudentNotification && (
        <WaitingStudentModal
          notification={waitingStudentNotification}
          onClose={clearWaitingStudentNotification}
          onAccept={handleAcceptConversation}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export default NotificationContext;


