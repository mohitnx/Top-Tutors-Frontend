import { useEffect, useCallback, useRef } from 'react';
import { 
  getSocket, 
  joinConversation, 
  leaveConversation, 
  sendTypingIndicator,
  onSocketConnect,
} from '../services/socket';
import { Message, UserTypingEvent, NewAssignmentEvent, StatusChangeEvent } from '../types';

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

  // Keep refs up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
    onTypingRef.current = onTyping;
  }, [onMessage, onTyping]);

  useEffect(() => {
    if (!conversationId) return;

    let isSubscribed = true;

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useConversationSocket] Setting up listeners for:', conversationId);

      // Join conversation room
      joinConversation(conversationId);

      // Remove any existing listeners first
      socket.off('newMessage');
      socket.off('userTyping');

      // Set up listeners using refs to avoid stale closures
      socket.on('newMessage', (message: Message) => {
        console.log('[useConversationSocket] Received newMessage:', message.id);
        // Only process if it's for this conversation
        if (message.conversationId === conversationId && onMessageRef.current) {
          onMessageRef.current(message);
        }
      });

      socket.on('userTyping', (data: UserTypingEvent) => {
        console.log('[useConversationSocket] Received userTyping:', data);
        if (onTypingRef.current) {
          onTypingRef.current(data);
        }
      });
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
        socket.off('newMessage');
        socket.off('userTyping');
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
}

export function useTutorNotifications({ 
  onAssignment, 
  onStatusUpdate 
}: UseTutorNotificationsOptions) {
  const onAssignmentRef = useRef(onAssignment);
  const onStatusUpdateRef = useRef(onStatusUpdate);

  // Keep refs up to date
  useEffect(() => {
    onAssignmentRef.current = onAssignment;
    onStatusUpdateRef.current = onStatusUpdate;
  }, [onAssignment, onStatusUpdate]);

  useEffect(() => {
    let isSubscribed = true;

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useTutorNotifications] Setting up notification listeners');

      // Remove any existing listeners first
      socket.off('newAssignment');
      socket.off('statusChange');

      // Set up listeners using refs
      socket.on('newAssignment', (data: NewAssignmentEvent) => {
        console.log('[useTutorNotifications] Received newAssignment:', data);
        if (onAssignmentRef.current) {
          onAssignmentRef.current(data);
        }
      });

      socket.on('statusChange', (data: StatusChangeEvent) => {
        console.log('[useTutorNotifications] Received statusChange:', data);
        if (onStatusUpdateRef.current) {
          onStatusUpdateRef.current(data);
        }
      });
    };

    // Set up listeners immediately if socket is connected
    setupListeners();

    // Also set up listeners when socket connects/reconnects
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      const socket = getSocket();
      if (socket) {
        socket.off('newAssignment');
        socket.off('statusChange');
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

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onStatusChangeRef.current = onStatusChange;
  }, [onNewMessage, onStatusChange]);

  useEffect(() => {
    let isSubscribed = true;

    const setupListeners = () => {
      const socket = getSocket();
      if (!socket || !isSubscribed) return;

      console.log('[useConversationListUpdates] Setting up listeners');

      // Listen for new messages (for updating unread counts, etc.)
      socket.on('newMessage', (message: Message) => {
        console.log('[useConversationListUpdates] Received newMessage');
        if (onNewMessageRef.current) {
          onNewMessageRef.current(message);
        }
      });

      socket.on('statusChange', (data: StatusChangeEvent) => {
        console.log('[useConversationListUpdates] Received statusChange');
        if (onStatusChangeRef.current) {
          onStatusChangeRef.current(data);
        }
      });
    };

    setupListeners();
    const unsubscribe = onSocketConnect(setupListeners);

    return () => {
      isSubscribed = false;
      unsubscribe();
      // Note: Don't remove listeners here as they might be used by other hooks
    };
  }, []);
}

export default { useConversationSocket, useTutorNotifications, useConversationListUpdates };

