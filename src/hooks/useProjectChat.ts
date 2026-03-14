import { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectStreamChunk, ProjectCouncilStatusEvent, ProjectCouncilMemberCompleteEvent } from '../types';
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
  onProjectCouncilStatus,
  offProjectCouncilStatus,
  onProjectCouncilMemberComplete,
  offProjectCouncilMemberComplete,
  onProjectCouncilSynthesisStart,
  offProjectCouncilSynthesisStart,
} from '../services/projectSocket';

interface UseProjectChatOptions {
  projectId: string | null;
  sessionId: string | null;
  onStreamEnd?: (chunk: ProjectStreamChunk) => void;
}

export interface ProjectChatModeOptions {
  deepThink?: boolean;
  deepResearch?: boolean;
  councilMode?: boolean;
}

export function useProjectChat({ projectId, sessionId, onStreamEnd }: UseProjectChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);

  // Council state
  const [councilAnalyzing, setCouncilAnalyzing] = useState(false);
  const [councilExperts, setCouncilExperts] = useState<ProjectCouncilStatusEvent['experts']>([]);
  const [councilMembers, setCouncilMembers] = useState<ProjectCouncilMemberCompleteEvent[]>([]);
  const [isCrossReviewing, setIsCrossReviewing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const currentProjectIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const streamCallbackRef = useRef<((chunk: ProjectStreamChunk) => void) | null>(null);
  const onStreamEndRef = useRef(onStreamEnd);
  onStreamEndRef.current = onStreamEnd;

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
          setStreamStatus(null);
          break;

        case 'chunk':
          if (chunk.content) {
            setStreamingContent((prev) => prev + chunk.content);
          }
          break;

        case 'heartbeat':
          break;

        case 'status':
          if (chunk.message) {
            setStreamStatus(chunk.message);
          }
          break;

        case 'end':
          onStreamEndRef.current?.(chunk);
          setIsStreaming(false);
          setIsWaitingForStream(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          setStreamStatus(null);
          setCouncilAnalyzing(false);
          setCouncilExperts([]);
          setCouncilMembers([]);
          setIsCrossReviewing(false);
          setIsSynthesizing(false);
          break;

        case 'error':
          setIsStreaming(false);
          setIsWaitingForStream(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          setStreamStatus(null);
          setCouncilAnalyzing(false);
          setIsCrossReviewing(false);
          setIsSynthesizing(false);
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

  // Council event handlers
  useEffect(() => {
    const handleCouncilStatus = (data: ProjectCouncilStatusEvent) => {
      if (data.type === 'councilAnalysisStart') {
        setCouncilAnalyzing(true);
        setCouncilExperts(data.experts || []);
        setCouncilMembers([]);
        setIsCrossReviewing(false);
        setIsSynthesizing(false);
      } else if (data.type === 'councilCrossReviewStart') {
        setIsCrossReviewing(true);
      }
    };

    const handleCouncilMemberComplete = (data: ProjectCouncilMemberCompleteEvent) => {
      setCouncilMembers((prev) => [...prev, data]);
    };

    const handleCouncilSynthesisStart = () => {
      setIsCrossReviewing(false);
      setIsSynthesizing(true);
    };

    onProjectCouncilStatus(handleCouncilStatus);
    onProjectCouncilMemberComplete(handleCouncilMemberComplete);
    onProjectCouncilSynthesisStart(handleCouncilSynthesisStart);

    return () => {
      offProjectCouncilStatus(handleCouncilStatus);
      offProjectCouncilMemberComplete(handleCouncilMemberComplete);
      offProjectCouncilSynthesisStart(handleCouncilSynthesisStart);
    };
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (content: string, targetSessionId?: string, options?: ProjectChatModeOptions) => {
      if (!projectId) throw new Error('No project selected');

      setIsWaitingForStream(true);
      const response = await projectsApi.sendMessage(projectId, {
        content,
        sessionId: targetSessionId || sessionId || undefined,
        ...options,
      });

      return response;
    },
    [projectId, sessionId]
  );

  // Send message with attachments
  const sendMessageWithAttachments = useCallback(
    async (files: File[], content?: string, targetSessionId?: string, options?: ProjectChatModeOptions) => {
      if (!projectId) throw new Error('No project selected');

      setIsWaitingForStream(true);
      const response = await projectsApi.sendMessageWithAttachments(
        projectId,
        files,
        content,
        targetSessionId || sessionId || undefined,
        undefined,
        options
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
    streamStatus,
    councilAnalyzing,
    councilExperts,
    councilMembers,
    isCrossReviewing,
    isSynthesizing,
    sendMessage,
    sendMessageWithAttachments,
    addFeedback,
  };
}

export default useProjectChat;
