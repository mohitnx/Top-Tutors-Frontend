import { useEffect, useRef, useState, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Trash2, RefreshCw } from 'lucide-react';
import {
  connectTutorSessionSocket,
  getTutorSessionSocket,
  onTutorSessionSocketConnect,
  joinSession,
  sendWhiteboardUpdate,
  sendWhiteboardCursor,
  getWhiteboardData,
  onWhiteboardUpdate,
  onWhiteboardData,
  offWhiteboardUpdate,
  offWhiteboardData,
  onJoinSession,
  offJoinSession,
  onConnected,
  offConnected,
} from '../../services/tutorSessionSocket';
import { WhiteboardUpdateEvent } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

interface CollaborativeWhiteboardProps {
  sessionId: string;
  initialData?: { elements?: any[] };
  readOnly?: boolean;
  className?: string;
  onSave?: (elements: any[]) => void;
}

interface RemoteCursor {
  x: number;
  y: number;
  userId: string;
  role?: string;
  lastUpdate: number;
}

export function CollaborativeWhiteboard({
  sessionId,
  initialData,
  readOnly = false,
  className = '',
  onSave,
}: CollaborativeWhiteboardProps) {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSentElementsRef = useRef<string>('');
  const isRemoteUpdateRef = useRef(false);
  const joinedSessionRef = useRef(false);
  const connectionAttemptRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [debugInfo, setDebugInfo] = useState<string>('');

  // ⭐ CRITICAL: Connect to socket and handle whiteboard events
  useEffect(() => {
    console.log('[CollaborativeWhiteboard] 🔌 Initializing for session:', sessionId);

    const token = localStorage.getItem('accessToken') || localStorage.getItem('authToken');
    if (!token) {
      console.error('[CollaborativeWhiteboard] ❌ No auth token found');
      setConnectionError(true);
      setIsLoading(false);
      return;
    }

    let cleanedUp = false;
    let connectionTimeout: ReturnType<typeof setTimeout>;

    // ⭐ Handler for when socket connects
    const handleSocketConnected = (data: any) => {
      console.log('[CollaborativeWhiteboard] ✅ Socket connected event received:', data);
      setIsConnected(true);
      setConnectionError(false);
      
      // Join session immediately after socket connects
      if (!joinedSessionRef.current) {
        console.log('[CollaborativeWhiteboard] 🚪 Joining session:', sessionId);
        joinSession(sessionId);
      }
    };

    // ⭐ Handler for joinSession acknowledgment
    const handleJoinSession = (response: any) => {
      console.log('[CollaborativeWhiteboard] ✅ Join session response:', response);
      
      if (response.success || response.sessionId === sessionId) {
        joinedSessionRef.current = true;
        setIsConnected(true);
        setConnectionError(false);
        setDebugInfo(`Joined as ${response.role || 'user'}`);
        
        // ⭐ CRITICAL: Request whiteboard data AFTER successfully joining
        console.log('[CollaborativeWhiteboard] 📋 Requesting whiteboard data...');
        setTimeout(() => {
          getWhiteboardData(sessionId);
        }, 100); // Small delay to ensure room join is processed
      }
    };

    // ⭐ Handler for whiteboard data response
    const handleWhiteboardData = (data: any) => {
      console.log('[CollaborativeWhiteboard] 📋 Received whiteboard data:', {
        sessionId: data.sessionId,
        hasElements: !!data.whiteboardData?.elements,
        elementCount: data.whiteboardData?.elements?.length || 0,
        enabled: data.whiteboardEnabled,
      });

      // ⭐ CRITICAL FIX: Always stop loading when we receive ANY whiteboard data event
      setIsLoading(false);

      // ⭐ FIX: Accept data if sessionId matches OR if no sessionId filter needed
      if (data.sessionId && data.sessionId !== sessionId) {
        console.log('[CollaborativeWhiteboard] ⚠️ Ignoring data for different session');
        return;
      }

      if (data.whiteboardData && excalidrawRef.current) {
        const elements = data.whiteboardData.elements || [];
        const appState = data.whiteboardData.appState || { viewBackgroundColor: '#1e1e1e' };
        
        console.log('[CollaborativeWhiteboard] 🎨 Applying whiteboard data:', elements.length, 'elements');
        
        isRemoteUpdateRef.current = true;
        excalidrawRef.current.updateScene({
          elements,
          appState: {
            ...appState,
            viewBackgroundColor: appState.viewBackgroundColor || '#1e1e1e',
          },
        });
        
        // Update our tracking ref
        lastSentElementsRef.current = JSON.stringify(elements);
        
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 100);
      }
    };

    // ⭐ Handler for live updates from other users
    const handleWhiteboardUpdate = (data: WhiteboardUpdateEvent & { senderId?: string; senderRole?: string }) => {
      console.log('[CollaborativeWhiteboard] 🔄 Whiteboard update received:', {
        sessionId: data.sessionId,
        senderId: data.senderId,
        elementCount: data.elements?.length || 0,
      });

      // ⭐ FIX: Check sessionId properly
      if (data.sessionId && data.sessionId !== sessionId) {
        console.log('[CollaborativeWhiteboard] ⚠️ Ignoring update for different session');
        return;
      }

      if (excalidrawRef.current && data.elements) {
        console.log('[CollaborativeWhiteboard] 🎨 Applying remote update:', data.elements.length, 'elements');
        
        isRemoteUpdateRef.current = true;
        excalidrawRef.current.updateScene({
          elements: data.elements,
          appState: data.appState || {},
        });
        
        // Update tracking ref to prevent echo
        lastSentElementsRef.current = JSON.stringify(data.elements);
        
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 100);
      }
    };

    // ⭐ Main connection logic
    const setupConnection = () => {
      connectionAttemptRef.current++;
      console.log('[CollaborativeWhiteboard] 🔌 Connection attempt #', connectionAttemptRef.current);

      // Set up event listeners FIRST
      onConnected(handleSocketConnected);
      onJoinSession(handleJoinSession);
      onWhiteboardData(handleWhiteboardData);
      onWhiteboardUpdate(handleWhiteboardUpdate);

      // Check if socket already exists and is connected
      let socket = getTutorSessionSocket();
      
      if (socket?.connected) {
        console.log('[CollaborativeWhiteboard] ✅ Socket already connected');
        setIsConnected(true);
        setConnectionError(false);
        
        // Join session immediately
        if (!joinedSessionRef.current) {
          console.log('[CollaborativeWhiteboard] 🚪 Joining session (already connected):', sessionId);
          joinSession(sessionId);
          joinedSessionRef.current = true; // ⭐ FIX: Mark as joined immediately
          
          // Request data after a brief delay
          setTimeout(() => {
            if (!cleanedUp) {
              console.log('[CollaborativeWhiteboard] 📋 Requesting whiteboard data (already connected)...');
              getWhiteboardData(sessionId);
            }
          }, 300);
          
          // ⭐ FIX: Set loading timeout - don't wait forever for data
          setTimeout(() => {
            if (!cleanedUp) {
              setIsLoading(false); // Stop loading after 3 seconds regardless
            }
          }, 3000);
        }
      } else {
        console.log('[CollaborativeWhiteboard] 🔌 Connecting socket...');
        
        // Connect the socket
        socket = connectTutorSessionSocket(token);
        
        // Set up connection listener
        const unsubscribe = onTutorSessionSocketConnect(() => {
          if (cleanedUp) return;
          
          console.log('[CollaborativeWhiteboard] ✅ Socket connected via listener');
          setIsConnected(true);
          setConnectionError(false);
          
          // Join session
          if (!joinedSessionRef.current) {
            console.log('[CollaborativeWhiteboard] 🚪 Joining session (via listener):', sessionId);
            joinSession(sessionId);
            joinedSessionRef.current = true; // ⭐ FIX: Mark as joined
            
            // ⭐ FIX: Request data and set loading timeout
            setTimeout(() => {
              if (!cleanedUp) {
                getWhiteboardData(sessionId);
              }
            }, 200);
            
            setTimeout(() => {
              if (!cleanedUp) {
                setIsLoading(false);
              }
            }, 3000);
          }
          
          unsubscribe();
        });

        // Set timeout for connection
        connectionTimeout = setTimeout(() => {
          if (cleanedUp) return;
          
          const currentSocket = getTutorSessionSocket();
          if (!currentSocket?.connected && !joinedSessionRef.current) {
            console.warn('[CollaborativeWhiteboard] ⚠️ Connection timeout - entering offline mode');
            setConnectionError(true);
            setIsLoading(false);
          }
        }, 8000);
      }
      
      // ⭐ CRITICAL FIX: Always stop loading after max 5 seconds
      setTimeout(() => {
        if (!cleanedUp) {
          console.log('[CollaborativeWhiteboard] ⏰ Loading timeout - stopping loader');
          setIsLoading(false);
        }
      }, 5000);
    };

    // Start connection
    setupConnection();

    // Cleanup
    return () => {
      console.log('[CollaborativeWhiteboard] 🔌 Cleaning up whiteboard');
      cleanedUp = true;
      joinedSessionRef.current = false;
      
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      
      offConnected();
      offJoinSession();
      offWhiteboardData();
      offWhiteboardUpdate();
    };
  }, [sessionId]);

  // ⭐ Clean up stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const updated = new Map(prev);
        let changed = false;
        for (const [key, cursor] of updated) {
          if (now - cursor.lastUpdate > 5000) {
            updated.delete(key);
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ⭐ Handle local changes - send updates to other users
  const handleChange = useCallback((elements: readonly any[], appState?: any) => {
    // Skip if this is a remote update we just applied
    if (isRemoteUpdateRef.current) {
      return;
    }

    // Skip if read-only
    if (readOnly) {
      return;
    }

    // Debounce: only send if elements actually changed
    const elementsJson = JSON.stringify(elements);
    if (elementsJson === lastSentElementsRef.current) {
      return;
    }

    lastSentElementsRef.current = elementsJson;

    // ⭐ CRITICAL: Send whiteboard update via socket
    console.log('[CollaborativeWhiteboard] 📤 Sending whiteboard update:', elements.length, 'elements');
    
    sendWhiteboardUpdate(
      sessionId,
      [...elements], // Convert readonly to mutable array
      appState ? { viewBackgroundColor: appState.viewBackgroundColor } : undefined
    );

    // Trigger onSave callback if provided
    if (onSave) {
      onSave([...elements]);
    }
  }, [sessionId, readOnly, onSave]);

  // ⭐ Clear whiteboard
  const handleClear = useCallback(() => {
    if (excalidrawRef.current && !readOnly) {
      excalidrawRef.current.updateScene({ elements: [] });
      lastSentElementsRef.current = '[]';
      sendWhiteboardUpdate(sessionId, [], { viewBackgroundColor: '#1e1e1e' });
    }
  }, [sessionId, readOnly]);

  // ⭐ Force refresh whiteboard data
  const handleRefresh = useCallback(() => {
    console.log('[CollaborativeWhiteboard] 🔄 Force refreshing whiteboard data');
    setIsLoading(true);
    
    // Re-join session and request data
    joinSession(sessionId);
    setTimeout(() => {
      getWhiteboardData(sessionId);
    }, 200);
  }, [sessionId]);

  // ⭐ Connection status indicator
  const getConnectionStatus = () => {
    if (isLoading) return { color: 'bg-yellow-500/20 text-yellow-400', text: '🔄 Loading...' };
    if (isConnected && !connectionError) return { color: 'bg-green-500/20 text-green-400', text: '🟢 Connected' };
    if (connectionError) return { color: 'bg-yellow-500/20 text-yellow-400', text: '🟡 Offline Mode' };
    return { color: 'bg-red-500/20 text-red-400', text: '🔴 Connecting...' };
  };

  const status = getConnectionStatus();

  return (
    <div 
      ref={containerRef}
      className={`relative flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: '400px' }}
    >
      {/* Toolbar - only show if not read-only */}
      {!readOnly && (
        <div className="flex items-center justify-between px-3 py-2 bg-[#2a2a2a] border-b border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Clear whiteboard"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Refresh whiteboard"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {debugInfo && (
              <span className="text-xs text-gray-500">{debugInfo}</span>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded ${status.color}`}>
              {status.text}
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1e1e1e]/80">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Loading whiteboard...</span>
          </div>
        </div>
      )}

      {/* Excalidraw Canvas */}
      <div className="w-full flex-1" style={{ minHeight: readOnly ? '100%' : 'calc(100% - 48px)' }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api;
            console.log('[CollaborativeWhiteboard] ✅ Excalidraw API ready');
          }}
          initialData={{
            elements: initialData?.elements || [],
            appState: {
              viewBackgroundColor: '#1e1e1e',
              currentItemStrokeColor: '#ffffff',
              currentItemBackgroundColor: 'transparent',
            },
          }}
          onChange={handleChange}
          viewModeEnabled={readOnly}
          theme="dark"
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: false,
            },
          }}
        />
      </div>

      {/* Remote Cursors */}
      {Array.from(remoteCursors.entries()).map(([key, cursor]) => (
        <div
          key={key}
          className="absolute pointer-events-none z-20 transition-all duration-75"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: 'translate(-2px, -2px)',
          }}
        >
          <div className={`w-4 h-4 ${cursor.role === 'tutor' ? 'text-emerald-500' : 'text-violet-500'}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.5 3.21V20.8l5.3-5.3h8.4L5.5 3.21z" />
            </svg>
          </div>
          <span className={`absolute left-4 top-0 px-1.5 py-0.5 text-white text-xs rounded whitespace-nowrap ${
            cursor.role === 'tutor' ? 'bg-emerald-500' : 'bg-violet-500'
          }`}>
            {cursor.role === 'tutor' ? 'Tutor' : cursor.userId.slice(0, 8)}
          </span>
        </div>
      ))}

      {/* Connection error banner */}
      {connectionError && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-yellow-500/20 text-yellow-400 text-xs text-center">
          Working offline - changes will sync when connection is restored
          <button
            onClick={handleRefresh}
            className="ml-2 underline hover:text-yellow-300"
          >
            Retry connection
          </button>
        </div>
      )}
    </div>
  );
}

export default CollaborativeWhiteboard;
