import { useEffect, useCallback, useRef, useState } from 'react';
import {
  connectGeminiSocket,
  onGeminiSocketConnect,
  joinGeminiSession,
  leaveGeminiSession,
  onStreamChunk,
  offStreamChunk,
  onTutorStatusUpdate,
  offTutorStatusUpdate,
  onTutorConnected,
  offTutorConnected,
  onTutorWaitUpdate,
  offTutorWaitUpdate,
} from '../services/geminiSocket';
import {
  StreamChunk,
  TutorStatusUpdateEvent,
  TutorConnectedEvent,
  TutorWaitUpdateEvent,
  AIChatSession,
} from '../types';
import { geminiChatApi } from '../api';

interface UseGeminiChatOptions {
  sessionId?: string;
  onStreamStart?: (messageId: string, sessionId: string) => void;
  onStreamChunk?: (chunk: StreamChunk) => void;
  onStreamEnd?: (chunk: StreamChunk) => void;
  onStreamError?: (chunk: StreamChunk) => void;
  onTutorStatusUpdate?: (data: TutorStatusUpdateEvent) => void;
  onTutorConnected?: (data: TutorConnectedEvent) => void;
  onTutorWaitUpdate?: (data: TutorWaitUpdateEvent) => void;
}

export function useGeminiChat({
  sessionId,
  onStreamStart,
  onStreamChunk: onStreamChunkCallback,
  onStreamEnd,
  onStreamError,
  onTutorStatusUpdate: onTutorStatusUpdateCallback,
  onTutorConnected: onTutorConnectedCallback,
  onTutorWaitUpdate: onTutorWaitUpdateCallback,
}: UseGeminiChatOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Refs to hold latest callbacks
  const onStreamStartRef = useRef(onStreamStart);
  const onStreamChunkRef = useRef(onStreamChunkCallback);
  const onStreamEndRef = useRef(onStreamEnd);
  const onStreamErrorRef = useRef(onStreamError);
  const onTutorStatusUpdateRef = useRef(onTutorStatusUpdateCallback);
  const onTutorConnectedRef = useRef(onTutorConnectedCallback);
  const onTutorWaitUpdateRef = useRef(onTutorWaitUpdateCallback);
  const streamChunkHandlerRef = useRef<((chunk: StreamChunk) => void) | null>(null);

  // Update refs when callbacks change
  useEffect(() => {
    onStreamStartRef.current = onStreamStart;
    onStreamChunkRef.current = onStreamChunkCallback;
    onStreamEndRef.current = onStreamEnd;
    onStreamErrorRef.current = onStreamError;
    onTutorStatusUpdateRef.current = onTutorStatusUpdateCallback;
    onTutorConnectedRef.current = onTutorConnectedCallback;
    onTutorWaitUpdateRef.current = onTutorWaitUpdateCallback;
  }, [
    onStreamStart,
    onStreamChunkCallback,
    onStreamEnd,
    onStreamError,
    onTutorStatusUpdateCallback,
    onTutorConnectedCallback,
    onTutorWaitUpdateCallback,
  ]);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectGeminiSocket(token);

    const handleConnect = () => {
      setIsConnected(true);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', () => setIsConnected(false));

    // Check if already connected
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect');
    };
  }, []);

  // Handle stream chunks
  useEffect(() => {
    const handleStreamChunk = (chunk: StreamChunk) => {
      console.log('[useGeminiChat] Stream chunk:', chunk.type);
      
      switch (chunk.type) {
        case 'start':
          setIsStreaming(true);
          setStreamingContent('');
          setStreamingMessageId(chunk.messageId);
          onStreamStartRef.current?.(chunk.messageId, chunk.sessionId);
          break;

        case 'chunk':
          setStreamingContent(chunk.fullContent || '');
          onStreamChunkRef.current?.(chunk);
          break;

        case 'end':
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          onStreamEndRef.current?.(chunk);
          break;

        case 'error':
          setIsStreaming(false);
          setStreamingMessageId(null);
          onStreamErrorRef.current?.(chunk);
          break;
      }
    };

    streamChunkHandlerRef.current = handleStreamChunk;
    onStreamChunk(handleStreamChunk);

    const unsubscribe = onGeminiSocketConnect(() => {
      if (streamChunkHandlerRef.current) {
        onStreamChunk(streamChunkHandlerRef.current);
      }
    });

    return () => {
      if (streamChunkHandlerRef.current) {
        offStreamChunk(streamChunkHandlerRef.current);
      }
      unsubscribe();
    };
  }, []);

  // Handle tutor status events
  useEffect(() => {
    const handleTutorStatusUpdate = (data: TutorStatusUpdateEvent) => {
      onTutorStatusUpdateRef.current?.(data);
    };

    const handleTutorConnected = (data: TutorConnectedEvent) => {
      onTutorConnectedRef.current?.(data);
    };

    const handleTutorWaitUpdate = (data: TutorWaitUpdateEvent) => {
      onTutorWaitUpdateRef.current?.(data);
    };

    onTutorStatusUpdate(handleTutorStatusUpdate);
    onTutorConnected(handleTutorConnected);
    onTutorWaitUpdate(handleTutorWaitUpdate);

    return () => {
      offTutorStatusUpdate(handleTutorStatusUpdate);
      offTutorConnected(handleTutorConnected);
      offTutorWaitUpdate(handleTutorWaitUpdate);
    };
  }, []);

  // Join/leave session
  useEffect(() => {
    if (!sessionId || !isConnected) return;

    joinGeminiSession(sessionId, (response) => {
      console.log('[useGeminiChat] Joined session:', response);
    });

    return () => {
      leaveGeminiSession(sessionId);
    };
  }, [sessionId, isConnected]);

  // Send message via API (streaming happens via socket)
  const sendMessage = useCallback(
    async (
      content: string,
      targetSessionId?: string
    ): Promise<{ messageId: string; sessionId: string } | null> => {
      try {
        const response = await geminiChatApi.sendMessage({
          content,
          sessionId: targetSessionId || sessionId,
          stream: true,
        });

        return {
          messageId: response.data.messageId,
          sessionId: response.data.sessionId,
        };
      } catch (error) {
        console.error('[useGeminiChat] Failed to send message:', error);
        return null;
      }
    },
    [sessionId]
  );

  // Send message with attachments
  const sendMessageWithAttachments = useCallback(
    async (
      files: File[],
      content?: string,
      targetSessionId?: string
    ): Promise<{ messageId: string; sessionId: string } | null> => {
      try {
        const response = await geminiChatApi.sendMessageWithAttachments(
          files,
          content,
          targetSessionId || sessionId
        );

        return {
          messageId: response.data.messageId,
          sessionId: response.data.sessionId,
        };
      } catch (error) {
        console.error('[useGeminiChat] Failed to send attachments:', error);
        return null;
      }
    },
    [sessionId]
  );

  // Send audio message
  const sendAudioMessage = useCallback(
    async (
      audio: File,
      targetSessionId?: string
    ): Promise<{ messageId: string; sessionId: string } | null> => {
      try {
        const response = await geminiChatApi.sendAudioMessage(
          audio,
          targetSessionId || sessionId
        );

        return {
          messageId: response.data.messageId,
          sessionId: response.data.sessionId,
        };
      } catch (error) {
        console.error('[useGeminiChat] Failed to send audio:', error);
        return null;
      }
    },
    [sessionId]
  );

  // Retry failed message
  const retryMessage = useCallback(async (messageId: string) => {
    try {
      const response = await geminiChatApi.retryMessage(messageId);
      return {
        messageId: response.data.messageId,
        sessionId: response.data.sessionId,
      };
    } catch (error) {
      console.error('[useGeminiChat] Failed to retry message:', error);
      return null;
    }
  }, []);

  // Add feedback to message
  const addFeedback = useCallback(
    async (messageId: string, feedback: 'GOOD' | 'BAD') => {
      try {
        await geminiChatApi.addFeedback(messageId, feedback);
        return true;
      } catch (error) {
        console.error('[useGeminiChat] Failed to add feedback:', error);
        return false;
      }
    },
    []
  );

  return {
    isConnected,
    isStreaming,
    streamingContent,
    streamingMessageId,
    sendMessage,
    sendMessageWithAttachments,
    sendAudioMessage,
    retryMessage,
    addFeedback,
  };
}

// Hook for managing sessions
export function useGeminiSessions() {
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (params?: { search?: string; limit?: number }) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await geminiChatApi.getSessions({
        limit: params?.limit || 20,
        search: params?.search,
      });
      setSessions(response.data.sessions);
    } catch (err) {
      console.error('[useGeminiSessions] Failed to fetch sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSession = useCallback(async (title?: string) => {
    try {
      const response = await geminiChatApi.createSession({ title });
      const newSession = response.data.session;
      setSessions((prev) => [newSession, ...prev]);
      return newSession;
    } catch (err) {
      console.error('[useGeminiSessions] Failed to create session:', err);
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await geminiChatApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      return true;
    } catch (err) {
      console.error('[useGeminiSessions] Failed to delete session:', err);
      return false;
    }
  }, []);

  const updateSession = useCallback(
    async (sessionId: string, data: { title?: string; isPinned?: boolean; isArchived?: boolean }) => {
      try {
        const response = await geminiChatApi.updateSession(sessionId, data);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? response.data.session : s))
        );
        return response.data.session;
      } catch (err) {
        console.error('[useGeminiSessions] Failed to update session:', err);
        return null;
      }
    },
    []
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    fetchSessions,
    createSession,
    deleteSession,
    updateSession,
    setSessions,
  };
}

export default useGeminiChat;

