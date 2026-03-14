import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
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
  onCouncilStatus,
  offCouncilStatus,
  onCouncilMemberComplete,
  offCouncilMemberComplete,
  onCouncilSynthesisStart,
  offCouncilSynthesisStart,
} from '../services/geminiSocket';
import {
  StreamChunk,
  TutorStatusUpdateEvent,
  TutorConnectedEvent,
  TutorWaitUpdateEvent,
  CouncilStatusEvent,
  CouncilMemberCompleteEvent,
  CouncilSynthesisStartEvent,
  AIChatSession,
  AIChatMode,
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
  onCouncilStatus?: (data: CouncilStatusEvent) => void;
  onCouncilMemberComplete?: (data: CouncilMemberCompleteEvent) => void;
  onCouncilSynthesisStart?: (data: CouncilSynthesisStartEvent) => void;
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
  onCouncilStatus: onCouncilStatusCallback,
  onCouncilMemberComplete: onCouncilMemberCompleteCallback,
  onCouncilSynthesisStart: onCouncilSynthesisStartCallback,
}: UseGeminiChatOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamStartedAtMs, setStreamStartedAtMs] = useState<number | null>(null);
  const [lastStreamEventAtMs, setLastStreamEventAtMs] = useState<number | null>(null);
  const [lastRealChunkAtMs, setLastRealChunkAtMs] = useState<number | null>(null);
  const [uxNowTick, setUxNowTick] = useState(0);
  const [councilAnalyzing, setCouncilAnalyzing] = useState(false);
  const [councilExperts, setCouncilExperts] = useState<CouncilStatusEvent['experts']>([]);
  const [councilMembers, setCouncilMembers] = useState<CouncilMemberCompleteEvent[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [thinkingTrace, setThinkingTrace] = useState<string[]>([]);
  const [streamMode, setStreamMode] = useState<'single' | 'deep-think' | 'deep-research' | 'council' | null>(null);
  const [streamSources, setStreamSources] = useState<{ title: string; url?: string }[]>([]);
  const [streamProvider, setStreamProvider] = useState<string | null>(null);

  // Refs to hold latest callbacks
  const onStreamStartRef = useRef(onStreamStart);
  const onStreamChunkRef = useRef(onStreamChunkCallback);
  const onStreamEndRef = useRef(onStreamEnd);
  const onStreamErrorRef = useRef(onStreamError);
  const onTutorStatusUpdateRef = useRef(onTutorStatusUpdateCallback);
  const onTutorConnectedRef = useRef(onTutorConnectedCallback);
  const onTutorWaitUpdateRef = useRef(onTutorWaitUpdateCallback);
  const onCouncilStatusRef = useRef(onCouncilStatusCallback);
  const onCouncilMemberCompleteRef = useRef(onCouncilMemberCompleteCallback);
  const onCouncilSynthesisStartRef = useRef(onCouncilSynthesisStartCallback);
  const streamChunkHandlerRef = useRef<((chunk: StreamChunk) => void) | null>(null);
  const preserveContentOnNextStartRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onStreamStartRef.current = onStreamStart;
    onStreamChunkRef.current = onStreamChunkCallback;
    onStreamEndRef.current = onStreamEnd;
    onStreamErrorRef.current = onStreamError;
    onTutorStatusUpdateRef.current = onTutorStatusUpdateCallback;
    onTutorConnectedRef.current = onTutorConnectedCallback;
    onTutorWaitUpdateRef.current = onTutorWaitUpdateCallback;
    onCouncilStatusRef.current = onCouncilStatusCallback;
    onCouncilMemberCompleteRef.current = onCouncilMemberCompleteCallback;
    onCouncilSynthesisStartRef.current = onCouncilSynthesisStartCallback;
  }, [
    onStreamStart,
    onStreamChunkCallback,
    onStreamEnd,
    onStreamError,
    onTutorStatusUpdateCallback,
    onTutorConnectedCallback,
    onTutorWaitUpdateCallback,
    onCouncilStatusCallback,
    onCouncilMemberCompleteCallback,
    onCouncilSynthesisStartCallback,
  ]);

  // Tick while streaming/waiting so UI status can update without events
  useEffect(() => {
    if (!isStreaming && !isWaitingForStream && !councilAnalyzing) return;
    const id = window.setInterval(() => setUxNowTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isStreaming, isWaitingForStream, councilAnalyzing]);

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
      const now = Date.now();
      setLastStreamEventAtMs(now);
      
      switch (chunk.type) {
        case 'start':
          setIsStreaming(true);
          setIsWaitingForStream(false);
          setIsSynthesizing(false);
          setCouncilAnalyzing(false);
          setCouncilExperts([]);
          setStreamStatus(null);
          setStreamStartedAtMs(now);
          setLastRealChunkAtMs(null);
          setThinkingTrace([]);
          setStreamMode(chunk.mode || null);
          setStreamSources([]);
          setStreamProvider(chunk.provider || null);
          if (!preserveContentOnNextStartRef.current) {
            setStreamingContent('');
          }
          preserveContentOnNextStartRef.current = false;
          setStreamingMessageId(chunk.messageId);
          onStreamStartRef.current?.(chunk.messageId, chunk.sessionId);
          break;

        case 'chunk':
          setLastRealChunkAtMs(now);
          // Only append the delta (content). Never use fullContent here —
          // it's the cumulative text and would cause the stream to "repeat".
          if (typeof chunk.content === 'string' && chunk.content.length > 0) {
            setStreamingContent((prev) => prev + chunk.content);
          }
          onStreamChunkRef.current?.(chunk);
          break;

        case 'heartbeat':
          // Keepalive only; do not append to content
          onStreamChunkRef.current?.(chunk);
          break;

        case 'status':
          if (chunk.message) {
            setStreamStatus(chunk.message);
          }
          if (chunk.thinkingTrace) {
            setThinkingTrace(chunk.thinkingTrace);
          }
          if (chunk.sources) {
            setStreamSources(chunk.sources);
          }
          onStreamChunkRef.current?.(chunk);
          break;

        case 'end':
          // Capture final thinkingTrace before resetting
          if (chunk.thinkingTrace) {
            setThinkingTrace(chunk.thinkingTrace);
          }
          setIsStreaming(false);
          setIsWaitingForStream(false);
          setIsSynthesizing(false);
          setCouncilAnalyzing(false);
          setCouncilExperts([]);
          setStreamStatus(null);
          setStreamingContent('');
          setStreamingMessageId(null);
          setStreamStartedAtMs(null);
          setLastStreamEventAtMs(null);
          setLastRealChunkAtMs(null);
          setCouncilMembers([]);
          onStreamEndRef.current?.(chunk);
          break;

        case 'error':
          setIsStreaming(false);
          setIsWaitingForStream(false);
          setStreamStatus(null);
          setStreamingMessageId(null);
          setStreamStartedAtMs(null);
          setLastStreamEventAtMs(null);
          setLastRealChunkAtMs(null);
          onStreamErrorRef.current?.(chunk);
          break;
      }
    };

    streamChunkHandlerRef.current = handleStreamChunk;
    onStreamChunk(handleStreamChunk);

    // On reconnect, remove old listener first to avoid duplicate registrations
    const unsubscribe = onGeminiSocketConnect(() => {
      if (streamChunkHandlerRef.current) {
        offStreamChunk(streamChunkHandlerRef.current);
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

  // Handle council mode events
  useEffect(() => {
    const handleCouncilStatus = (data: CouncilStatusEvent) => {
      setCouncilAnalyzing(true);
      setCouncilExperts(data.experts);
      onCouncilStatusRef.current?.(data);
    };

    const handleCouncilMemberComplete = (data: CouncilMemberCompleteEvent) => {
      setCouncilMembers((prev) => [...prev, data]);
      // Update expert status to done
      setCouncilExperts((prev) =>
        prev.map((e) => e.id === data.memberId ? { ...e, status: 'done' as const } : e)
      );
      onCouncilMemberCompleteRef.current?.(data);
    };

    const handleCouncilSynthesisStart = (data: CouncilSynthesisStartEvent) => {
      setIsSynthesizing(true);
      setCouncilAnalyzing(false);
      onCouncilSynthesisStartRef.current?.(data);
    };

    onCouncilStatus(handleCouncilStatus);
    onCouncilMemberComplete(handleCouncilMemberComplete);
    onCouncilSynthesisStart(handleCouncilSynthesisStart);

    return () => {
      offCouncilStatus(handleCouncilStatus);
      offCouncilMemberComplete(handleCouncilMemberComplete);
      offCouncilSynthesisStart(handleCouncilSynthesisStart);
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
      targetSessionId?: string,
      options?: { deepThink?: boolean; deepResearch?: boolean; council?: boolean; projectId?: string; readAloud?: boolean }
    ): Promise<{ messageId: string; sessionId: string } | null> => {
      try {
        setIsWaitingForStream(true);
        setThinkingTrace([]);
        const response = await geminiChatApi.sendMessage({
          content,
          sessionId: targetSessionId || sessionId,
          stream: true,
          ...options,
        });

        return {
          messageId: response.messageId,
          sessionId: response.sessionId,
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
      targetSessionId?: string,
      options?: { deepThink?: boolean; deepResearch?: boolean; council?: boolean; projectId?: string; readAloud?: boolean }
    ): Promise<{ messageId: string; sessionId: string } | null> => {
      try {
        setIsWaitingForStream(true);
        setThinkingTrace([]);
        const response = await geminiChatApi.sendMessageWithAttachments(
          files,
          content,
          targetSessionId || sessionId,
          undefined,
          options
        );

        return {
          messageId: response.messageId,
          sessionId: response.sessionId,
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
      targetSessionId?: string,
      options?: { deepThink?: boolean; deepResearch?: boolean; council?: boolean; projectId?: string; readAloud?: boolean }
    ): Promise<{ messageId: string; sessionId: string } | null> => {
      try {
        setIsWaitingForStream(true);
        setThinkingTrace([]);
        const response = await geminiChatApi.sendAudioMessage(
          audio,
          targetSessionId || sessionId,
          undefined,
          options
        );

        return {
          messageId: response.messageId,
          sessionId: response.sessionId,
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
      setIsWaitingForStream(true);
      const response = await geminiChatApi.retryMessage(messageId);
      return {
        messageId: response.messageId,
        sessionId: response.sessionId,
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

  const prepareForRetry = useCallback((preservedContent?: string) => {
    preserveContentOnNextStartRef.current = true;
    if (typeof preservedContent === 'string') {
      setStreamingContent(preservedContent);
    }
  }, []);

  // Reconnect to an in-progress or completed stream (e.g. after page reload)
  const reconnectToStream = useCallback((data: { messageId?: string; sessionId?: string }) => {
    return new Promise<import('../services/geminiSocket').ReconnectStreamResponse>((resolve) => {
      import('../services/geminiSocket').then(({ reconnectStream: rs, getGeminiSocket, onGeminiSocketConnect }) => {
        const attempt = () => {
          rs(data, (response) => {
            if (response.success) {
              if (response.thinkingTrace) setThinkingTrace(response.thinkingTrace);
              if (response.mode) setStreamMode(response.mode);
              if (response.provider) setStreamProvider(response.provider);

              if (!response.complete && response.isStreaming) {
                setIsStreaming(true);
                setStreamingContent(response.content || '');
                setStreamingMessageId(response.messageId || null);
                setStreamStartedAtMs(Date.now());
              }
            }
            resolve(response);
          });
        };

        // If socket is already connected, attempt immediately
        if (getGeminiSocket()?.connected) {
          attempt();
        } else {
          // Wait for socket to connect, then attempt
          const unsub = onGeminiSocketConnect(() => {
            unsub();
            attempt();
          });
          // Timeout after 8s so we don't hang forever
          setTimeout(() => {
            unsub();
            resolve({ success: false });
          }, 8000);
        }
      });
    });
  }, []);

  const streamUx = useMemo(() => {
    const now = Date.now();

    const startedAt = streamStartedAtMs ?? now;
    const lastEventAt = lastStreamEventAtMs ?? startedAt;
    const lastChunkAt = lastRealChunkAtMs ?? startedAt;

    const silenceMs = Math.max(0, now - lastEventAt);
    const waitingForRealChunkMs = Math.max(0, now - lastChunkAt);

    const showConnectionSlow = isStreaming && silenceMs >= 25000;
    const showStillGenerating = isStreaming && waitingForRealChunkMs >= 12000;
    const showTakingLongerThanUsual = isStreaming && waitingForRealChunkMs >= 30000;

    const hasReceivedContent = lastRealChunkAtMs !== null;

    let statusText: string | null = null;
    if (streamStatus) {
      // Backend-driven status (Deep Think / Deep Research progress)
      statusText = streamStatus;
    } else if (isWaitingForStream) {
      // Between sending and first stream event — immediate feedback
      if (isSynthesizing) statusText = 'Combining expert perspectives…';
      else if (councilAnalyzing) statusText = 'Our experts are analyzing your question…';
      else statusText = 'Processing your message…';
    } else if (isStreaming) {
      if (showConnectionSlow) statusText = 'Connection is slow…';
      else if (showTakingLongerThanUsual) statusText = 'This is taking longer than usual…';
      else if (isSynthesizing) statusText = 'Combining expert perspectives…';
      else if (councilAnalyzing) statusText = 'Our experts are analyzing your question…';
      else if (showStillGenerating) statusText = 'Still generating…';
      else if (!hasReceivedContent) statusText = 'Thinking…';
      else statusText = 'Writing…';
    } else if (councilAnalyzing || isSynthesizing) {
      // Council events can arrive before streaming starts
      if (isSynthesizing) statusText = 'Combining expert perspectives…';
      else statusText = 'Our experts are analyzing your question…';
    }

    return {
      statusText,
      silenceMs,
      waitingForRealChunkMs,
      showConnectionSlow,
      showStillGenerating,
      showTakingLongerThanUsual,
      shouldOfferRetry: showConnectionSlow,
    };
  }, [isStreaming, isWaitingForStream, lastRealChunkAtMs, lastStreamEventAtMs, streamStartedAtMs, uxNowTick, councilAnalyzing, isSynthesizing, streamStatus]);

  return {
    isConnected,
    isStreaming,
    isWaitingForStream,
    streamingContent,
    streamingMessageId,
    streamUx,
    streamStatus,
    thinkingTrace,
    streamMode,
    streamSources,
    streamProvider,
    councilAnalyzing,
    councilExperts,
    councilMembers,
    isSynthesizing,
    prepareForRetry,
    reconnectToStream,
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
      setSessions(response.sessions);
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
      setSessions((prev) => [response, ...prev]);
      return response;
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
    async (sessionId: string, data: { title?: string; isPinned?: boolean; isArchived?: boolean; mode?: AIChatMode }) => {
      try {
        const response = await geminiChatApi.updateSession(sessionId, data);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? response : s))
        );
        return response;
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

