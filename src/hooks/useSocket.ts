import { useEffect, useCallback, useRef } from 'react';
import { 
  getSocket, 
  joinConversation, 
  leaveConversation, 
  sendTypingIndicator,
  onSocketConnect,
} from '../services/socket';
import { 
  Message, 
  UserTypingEvent, 
  NewAssignmentEvent, 
  StatusChangeEvent, 
  NewPendingConversationEvent,
  ProcessingStatusEvent,
  TutorAssignedEvent,
  AllTutorsBusyEvent,
  TutorAvailabilityUpdate,
  TutorAcceptedEvent,
} from '../types';

interface UseConversationSocketOptions {
  conversationId: string;
  onMessage?: (message: Message) => void;
  onTyping?: (data: UserTypingEvent) => void;
}

export function useConversationSocket({ 
  conversationId, 
  onMessage, 
  onTyping 
}: UseConversationSocketOptions) {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const messageHandlerRef = useRef<((message: Message) => void) | null>(null);
  const typingHandlerRef = useRef<((data: UserTypingEvent) => void) | null>(null);

  // Keep refs up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
    onTypingRef.current = onTyping;
  }, [onMessage, onTyping]);

  useEffect(() => {
    if (!conversationId) return;

    let isSubscribed = true;

    // Create handlers that we can reference for removal
    const handleMessage = (message: Message) => {
      if (!isSubscribed) return;
      console.log('[useConversationSocket] Received newMessage:', message.id);
      // Only process if it's for this conversation
      if (message.conversationId === conversationId && onMessageRef.current) {
        onMessageRef.current(message);
      }
    };

    const handleTyping = (data: UserTypingEvent) => {
      if (!isSubscribed) return;
      if (onTypingRef.current) {
        onTypingRef.current(data);
      }
    };

    // Store references for cleanup
    messageHandlerRef.current = handleMessage;
    typingHandlerRef.current = handleTyping;

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useConversationSocket] Setting up listeners for:', conversationId);

      // Join conversation room
      joinConversation(conversationId);

      // Add listeners (don't remove all - just add ours)
      socket.on('newMessage', handleMessage);
      socket.on('userTyping', handleTyping);
    };

    // Set up listeners immediately if socket is connected
    setupListeners();

    // Also set up listeners when socket connects/reconnects
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      const socket = getSocket();
      if (socket) {
        leaveConversation(conversationId);
        // Remove only OUR listeners by reference
        if (messageHandlerRef.current) {
          socket.off('newMessage', messageHandlerRef.current);
        }
        if (typingHandlerRef.current) {
          socket.off('userTyping', typingHandlerRef.current);
        }
      }
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!conversationId) return;
    
    sendTypingIndicator({ conversationId, isTyping });
    
    // Auto-clear typing after 3 seconds
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator({ conversationId, isTyping: false });
      }, 3000);
    }
  }, [conversationId]);

  return { sendTyping };
}

interface UseTutorNotificationsOptions {
  onAssignment?: (data: NewAssignmentEvent) => void;
  onStatusUpdate?: (data: StatusChangeEvent) => void;
  onNewPendingConversation?: (data: NewPendingConversationEvent) => void;
}

export function useTutorNotifications({ 
  onAssignment, 
  onStatusUpdate,
  onNewPendingConversation,
}: UseTutorNotificationsOptions) {
  const onAssignmentRef = useRef(onAssignment);
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onNewPendingConversationRef = useRef(onNewPendingConversation);
  const handlersRef = useRef<{
    assignment: ((data: NewAssignmentEvent) => void) | null;
    status: ((data: StatusChangeEvent) => void) | null;
    pending: ((data: NewPendingConversationEvent) => void) | null;
  }>({ assignment: null, status: null, pending: null });

  // Keep refs up to date
  useEffect(() => {
    onAssignmentRef.current = onAssignment;
    onStatusUpdateRef.current = onStatusUpdate;
    onNewPendingConversationRef.current = onNewPendingConversation;
  }, [onAssignment, onStatusUpdate, onNewPendingConversation]);

  useEffect(() => {
    let isSubscribed = true;

    const handleAssignment = (data: NewAssignmentEvent) => {
      if (!isSubscribed) return;
      console.log('[useTutorNotifications] Received newAssignment:', data);
      if (onAssignmentRef.current) {
        onAssignmentRef.current(data);
      }
    };

    const handleStatus = (data: StatusChangeEvent) => {
      if (!isSubscribed) return;
      console.log('[useTutorNotifications] Received statusChange:', data);
      if (onStatusUpdateRef.current) {
        onStatusUpdateRef.current(data);
      }
    };

    const handlePending = (data: NewPendingConversationEvent) => {
      if (!isSubscribed) return;
      console.log('[useTutorNotifications] Received newPendingConversation:', data);
      if (onNewPendingConversationRef.current) {
        onNewPendingConversationRef.current(data);
      }
    };

    handlersRef.current = {
      assignment: handleAssignment,
      status: handleStatus,
      pending: handlePending,
    };

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useTutorNotifications] Setting up notification listeners');

      socket.on('newAssignment', handleAssignment);
      socket.on('statusChange', handleStatus);
      socket.on('newPendingConversation', handlePending);
    };

    setupListeners();
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      const socket = getSocket();
      if (socket && handlersRef.current) {
        if (handlersRef.current.assignment) {
          socket.off('newAssignment', handlersRef.current.assignment);
        }
        if (handlersRef.current.status) {
          socket.off('statusChange', handlersRef.current.status);
        }
        if (handlersRef.current.pending) {
          socket.off('newPendingConversation', handlersRef.current.pending);
        }
      }
      unsubscribe();
    };
  }, []);
}

// Hook for conversation list updates (new messages, status changes)
interface UseConversationListUpdatesOptions {
  onNewMessage?: (message: Message) => void;
  onStatusChange?: (data: StatusChangeEvent) => void;
}

export function useConversationListUpdates({
  onNewMessage,
  onStatusChange,
}: UseConversationListUpdatesOptions) {
  const onNewMessageRef = useRef(onNewMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  const handlersRef = useRef<{
    message: ((message: Message) => void) | null;
    status: ((data: StatusChangeEvent) => void) | null;
  }>({ message: null, status: null });

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onStatusChangeRef.current = onStatusChange;
  }, [onNewMessage, onStatusChange]);

  useEffect(() => {
    let isSubscribed = true;

    const handleMessage = (message: Message) => {
      if (!isSubscribed) return;
      console.log('[useConversationListUpdates] Received newMessage');
      if (onNewMessageRef.current) {
        onNewMessageRef.current(message);
      }
    };

    const handleStatus = (data: StatusChangeEvent) => {
      if (!isSubscribed) return;
      console.log('[useConversationListUpdates] Received statusChange');
      if (onStatusChangeRef.current) {
        onStatusChangeRef.current(data);
      }
    };

    handlersRef.current = { message: handleMessage, status: handleStatus };

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useConversationListUpdates] Setting up listeners');

      socket.on('newMessage', handleMessage);
      socket.on('statusChange', handleStatus);
    };

    setupListeners();
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      const socket = getSocket();
      if (socket && handlersRef.current) {
        if (handlersRef.current.message) {
          socket.off('newMessage', handlersRef.current.message);
        }
        if (handlersRef.current.status) {
          socket.off('statusChange', handlersRef.current.status);
        }
      }
      unsubscribe();
    };
  }, []);
}

// Hook for student notifications (processing status, tutor assigned, etc.)
interface UseStudentNotificationsOptions {
  onProcessingStatus?: (data: ProcessingStatusEvent) => void;
  onTutorAssigned?: (data: TutorAssignedEvent) => void;
  onAllTutorsBusy?: (data: AllTutorsBusyEvent) => void;
  onTutorAvailabilityUpdate?: (data: TutorAvailabilityUpdate) => void;
  onTutorAccepted?: (data: TutorAcceptedEvent) => void;
}

export function useStudentNotifications({
  onProcessingStatus,
  onTutorAssigned,
  onAllTutorsBusy,
  onTutorAvailabilityUpdate,
  onTutorAccepted,
}: UseStudentNotificationsOptions) {
  const onProcessingStatusRef = useRef(onProcessingStatus);
  const onTutorAssignedRef = useRef(onTutorAssigned);
  const onAllTutorsBusyRef = useRef(onAllTutorsBusy);
  const onTutorAvailabilityUpdateRef = useRef(onTutorAvailabilityUpdate);
  const onTutorAcceptedRef = useRef(onTutorAccepted);
  const handlersRef = useRef<{
    processing: ((data: ProcessingStatusEvent) => void) | null;
    assigned: ((data: TutorAssignedEvent) => void) | null;
    busy: ((data: AllTutorsBusyEvent) => void) | null;
    availability: ((data: TutorAvailabilityUpdate) => void) | null;
    accepted: ((data: TutorAcceptedEvent) => void) | null;
  }>({ processing: null, assigned: null, busy: null, availability: null, accepted: null });

  useEffect(() => {
    onProcessingStatusRef.current = onProcessingStatus;
    onTutorAssignedRef.current = onTutorAssigned;
    onAllTutorsBusyRef.current = onAllTutorsBusy;
    onTutorAvailabilityUpdateRef.current = onTutorAvailabilityUpdate;
    onTutorAcceptedRef.current = onTutorAccepted;
  }, [onProcessingStatus, onTutorAssigned, onAllTutorsBusy, onTutorAvailabilityUpdate, onTutorAccepted]);

  useEffect(() => {
    let isSubscribed = true;

    const handleProcessing = (data: ProcessingStatusEvent) => {
      if (!isSubscribed) return;
      console.log('[useStudentNotifications] Received processingStatus:', data);
      if (onProcessingStatusRef.current) {
        onProcessingStatusRef.current(data);
      }
    };

    const handleAssigned = (data: TutorAssignedEvent) => {
      if (!isSubscribed) return;
      console.log('[useStudentNotifications] Received tutorAssigned:', data);
      if (onTutorAssignedRef.current) {
        onTutorAssignedRef.current(data);
      }
    };

    const handleBusy = (data: AllTutorsBusyEvent) => {
      if (!isSubscribed) return;
      console.log('[useStudentNotifications] Received allTutorsBusy:', data);
      if (onAllTutorsBusyRef.current) {
        onAllTutorsBusyRef.current(data);
      }
    };

    const handleAvailability = (data: TutorAvailabilityUpdate) => {
      if (!isSubscribed) return;
      console.log('[useStudentNotifications] Received tutorAvailabilityUpdate:', data);
      if (onTutorAvailabilityUpdateRef.current) {
        onTutorAvailabilityUpdateRef.current(data);
      }
    };

    const handleAccepted = (data: TutorAcceptedEvent) => {
      if (!isSubscribed) return;
      console.log('[useStudentNotifications] Received tutorAccepted:', data);
      if (onTutorAcceptedRef.current) {
        onTutorAcceptedRef.current(data);
      }
    };

    handlersRef.current = {
      processing: handleProcessing,
      assigned: handleAssigned,
      busy: handleBusy,
      availability: handleAvailability,
      accepted: handleAccepted,
    };

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useStudentNotifications] Setting up student notification listeners');

      socket.on('processingStatus', handleProcessing);
      socket.on('tutorAssigned', handleAssigned);
      socket.on('allTutorsBusy', handleBusy);
      socket.on('tutorAvailabilityUpdate', handleAvailability);
      socket.on('tutorAccepted', handleAccepted);
    };

    setupListeners();
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      const socket = getSocket();
      if (socket && handlersRef.current) {
        if (handlersRef.current.processing) {
          socket.off('processingStatus', handlersRef.current.processing);
        }
        if (handlersRef.current.assigned) {
          socket.off('tutorAssigned', handlersRef.current.assigned);
        }
        if (handlersRef.current.busy) {
          socket.off('allTutorsBusy', handlersRef.current.busy);
        }
        if (handlersRef.current.availability) {
          socket.off('tutorAvailabilityUpdate', handlersRef.current.availability);
        }
        if (handlersRef.current.accepted) {
          socket.off('tutorAccepted', handlersRef.current.accepted);
        }
      }
      unsubscribe();
    };
  }, []);
}

export default { 
  useConversationSocket, 
  useTutorNotifications, 
  useConversationListUpdates,
  useStudentNotifications,
};
