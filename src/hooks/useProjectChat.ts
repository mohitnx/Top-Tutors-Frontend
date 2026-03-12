import { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectStreamChunk } from '../types';
import { projectsApi } from '../api/projects';
import {
  connectProjectSocket,
  joinProject,
  leaveProject,
  joinProjectSession,
  leaveProjectSession,
  onProjectStreamChunk,
  offProjectStreamChunk,
  onProjectSocketConnect,
} from '../services/projectSocket';

interface UseProjectChatOptions {
  projectId: string | null;
  sessionId: string | null;
}

export function useProjectChat({ projectId, sessionId }: UseProjectChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const currentProjectIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const streamCallbackRef = useRef<((chunk: ProjectStreamChunk) => void) | null>(null);

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !projectId) return;

    const socket = connectProjectSocket(token);
    setIsConnected(socket.connected);

    const unsubscribe = onProjectSocketConnect(() => {
      setIsConnected(true);
      if (currentProjectIdRef.current) {
        joinProject(currentProjectIdRef.current);
      }
      if (currentSessionIdRef.current) {
        joinProjectSession(currentSessionIdRef.current);
      }
    });

    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      unsubscribe();
    };
  }, [projectId]);

  // Join/leave project room
  useEffect(() => {
    if (!projectId) return;

    if (currentProjectIdRef.current && currentProjectIdRef.current !== projectId) {
      leaveProject(currentProjectIdRef.current);
    }

    currentProjectIdRef.current = projectId;
    joinProject(projectId);

    return () => {
      if (currentProjectIdRef.current) {
        leaveProject(currentProjectIdRef.current);
        currentProjectIdRef.current = null;
      }
    };
  }, [projectId]);

  // Join/leave session room
  useEffect(() => {
    if (!sessionId) return;

    if (currentSessionIdRef.current && currentSessionIdRef.current !== sessionId) {
      leaveProjectSession(currentSessionIdRef.current);
    }

    currentSessionIdRef.current = sessionId;
    joinProjectSession(sessionId);

    return () => {
      if (currentSessionIdRef.current) {
        leaveProjectSession(currentSessionIdRef.current);
        currentSessionIdRef.current = null;
      }
    };
  }, [sessionId]);

  // Stream chunk handler
  useEffect(() => {
    const handleStreamChunk = (chunk: ProjectStreamChunk) => {
      // Only handle chunks for our current session
      if (sessionId && chunk.sessionId !== sessionId) return;

      switch (chunk.type) {
        case 'start':
          setIsStreaming(true);
          setIsWaitingForStream(false);
          setStreamingMessageId(chunk.messageId);
          setStreamingContent('');
          break;

        case 'chunk':
          if (chunk.content) {
            setStreamingContent((prev) => prev + chunk.content);
          }
          break;

        case 'heartbeat':
          // Don't append content, just keep streaming state
          break;

        case 'end':
          setIsStreaming(false);
          setIsWaitingForStream(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          break;

        case 'error':
          setIsStreaming(false);
          setIsWaitingForStream(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          break;
      }
    };

    // Remove old listener
    if (streamCallbackRef.current) {
      offProjectStreamChunk(streamCallbackRef.current);
    }

    streamCallbackRef.current = handleStreamChunk;
    onProjectStreamChunk(handleStreamChunk);

    return () => {
      if (streamCallbackRef.current) {
        offProjectStreamChunk(streamCallbackRef.current);
        streamCallbackRef.current = null;
      }
    };
  }, [sessionId]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, targetSessionId?: string) => {
      if (!projectId) throw new Error('No project selected');

      setIsWaitingForStream(true);
      const response = await projectsApi.sendMessage(projectId, {
        content,
        sessionId: targetSessionId || sessionId || undefined,
      });

      return response;
    },
    [projectId, sessionId]
  );

  // Send message with attachments
  const sendMessageWithAttachments = useCallback(
    async (files: File[], content?: string, targetSessionId?: string) => {
      if (!projectId) throw new Error('No project selected');

      setIsWaitingForStream(true);
      const response = await projectsApi.sendMessageWithAttachments(
        projectId,
        files,
        content,
        targetSessionId || sessionId || undefined
      );

      return response;
    },
    [projectId, sessionId]
  );

  // Add feedback
  const addFeedback = useCallback(
    async (messageId: string, feedback: 'GOOD' | 'BAD') => {
      if (!projectId) return false;
      try {
        await projectsApi.addFeedback(projectId, messageId, feedback);
        return true;
      } catch {
        return false;
      }
    },
    [projectId]
  );

  return {
    isConnected,
    isStreaming,
    isWaitingForStream,
    streamingContent,
    streamingMessageId,
    sendMessage,
    sendMessageWithAttachments,
    addFeedback,
  };
}

export default useProjectChat;
