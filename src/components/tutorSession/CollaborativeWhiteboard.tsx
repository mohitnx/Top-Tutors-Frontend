import { useEffect, useRef, useState, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Trash2 } from 'lucide-react';
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
  lastUpdate: number;
}

export function CollaborativeWhiteboard({
  sessionId,
  initialData,
  readOnly = false,
  className = '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSave,
}: CollaborativeWhiteboardProps) {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSentElementsRef = useRef<string>('');

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

  // Connect to shared socket and handle whiteboard events
  useEffect(() => {
    console.log('[CollaborativeWhiteboard] 🔌 Using shared socket for session:', sessionId);

    const token = localStorage.getItem('accessToken') || localStorage.getItem('authToken');
    if (!token) {
      console.error('[CollaborativeWhiteboard] ❌ No auth token found');
      return;
    }

    // Ensure socket is connected
    const connectAndJoin = () => {
      const socket = getTutorSessionSocket();
      if (socket?.connected) {
        console.log('[CollaborativeWhiteboard] ✅ Socket connected, joining session');
        joinSession(sessionId);
        setIsConnected(true);
        setConnectionError(false);
      } else {
        console.log('[CollaborativeWhiteboard] 🔄 Socket not connected, waiting...');
        // Wait for socket to connect with timeout
        const unsubscribe = onTutorSessionSocketConnect(() => {
          console.log('[CollaborativeWhiteboard] ✅ Socket connected via listener, joining session');
          joinSession(sessionId);
          setIsConnected(true);
          setConnectionError(false);
          unsubscribe();
        });

        // Set timeout for connection attempt
        setTimeout(() => {
          if (!socket?.connected) {
            console.warn('[CollaborativeWhiteboard] ⚠️ Socket connection timeout - enabling offline mode');
            setConnectionError(true);
            setIsConnected(false);
            unsubscribe();
          }
        }, 5000);
      }
    };

    // Try to connect the socket if it's not connected
    const existingSocket = getTutorSessionSocket();
    if (!existingSocket || !existingSocket.connected) {
      console.log('[CollaborativeWhiteboard] 🔌 Connecting tutor session socket...');
      connectTutorSessionSocket(token);
    }

    connectAndJoin();

    // Handle whiteboard data response
    const handleWhiteboardData = (data: any) => {
      console.log('[CollaborativeWhiteboard] 📋 Received whiteboard data:', data);
      if (data.sessionId === sessionId && data.whiteboardEnabled && data.whiteboardData && excalidrawRef.current) {
        excalidrawRef.current.updateScene({
          elements: data.whiteboardData.elements || [],
          appState: data.whiteboardData.appState || { viewBackgroundColor: '#ffffff' }
        });
      }
    };

    // Handle live updates from other users
    const handleWhiteboardUpdate = (data: WhiteboardUpdateEvent) => {
      console.log('[CollaborativeWhiteboard] 🔄 Whiteboard update from:', data.senderId, 'session:', data.sessionId);
      if (data.sessionId !== sessionId) return; // Only handle updates for this session

      if (excalidrawRef.current) {
        excalidrawRef.current.updateScene({
          elements: data.elements,
          appState: data.appState
        });
      }
    };

    // Handle session join response
    const handleJoinSession = (response: any) => {
      console.log('[CollaborativeWhiteboard] ✅ Joined session:', response);
      if (response.sessionId === sessionId) {
        // Get whiteboard data after joining
        console.log('[CollaborativeWhiteboard] 📋 Getting whiteboard data...');
        getWhiteboardData(sessionId);
      }
    };

    // Set up event listeners
    onWhiteboardData(handleWhiteboardData);
    onWhiteboardUpdate(handleWhiteboardUpdate);
    onJoinSession(handleJoinSession);

    return () => {
      console.log('[CollaborativeWhiteboard] 🔌 Removing whiteboard event listeners');
      offWhiteboardData();
      offWhiteboardUpdate();
      offJoinSession();
      // Don't disconnect socket as it's shared
    };
  }, [sessionId]);

  // Clean up stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const updated = new Map(prev);
        for (const [userId, cursor] of updated) {
          if (now - cursor.lastUpdate > 5000) {
            updated.delete(userId);
          }
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle local changes
  const handleChange = useCallback((elements: readonly any[], appState?: any) => {
    if (readOnly) return;

    // Debounce and avoid sending identical updates
    const elementsJson = JSON.stringify(elements);
    if (elementsJson === lastSentElementsRef.current) return;
    lastSentElementsRef.current = elementsJson;

    // Try to send real-time update if connected
    if (isConnected && !connectionError) {
      console.log('[CollaborativeWhiteboard] ✏️ Sending whiteboard update, elements count:', elements.length);
      try {
        sendWhiteboardUpdate(
          sessionId,
          elements.filter(el => !el.isDeleted),
          appState
        );
      } catch (error) {
        console.warn('[CollaborativeWhiteboard] Failed to send update via socket:', error);
      }
    } else if (connectionError) {
      console.log('[CollaborativeWhiteboard] 📝 Working in offline mode - changes saved locally');
    }

    // Always save to backend for persistence (if available)
    if (onSave) {
      onSave(elements as any[]);
    }
  }, [sessionId, readOnly, isConnected, connectionError, onSave]);

  // Handle pointer move for cursor sharing
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (readOnly || !isConnected || connectionError) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const scrollTop = container.scrollTop || 0;

    // Calculate position relative to the container, accounting for scroll
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    // Only send cursor updates if within bounds
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      try {
        sendWhiteboardCursor(sessionId, x, y);
      } catch (error) {
        console.warn('[CollaborativeWhiteboard] Failed to send cursor update:', error);
      }
    }
  }, [sessionId, readOnly, isConnected, connectionError]);


  // Clear whiteboard
  const handleClear = useCallback(() => {
    if (!excalidrawRef.current || readOnly) return;

    excalidrawRef.current.updateScene({
      elements: [],
    });

    // Try to send clear update if connected
    if (isConnected && !connectionError) {
      try {
        sendWhiteboardUpdate(sessionId, [], { viewBackgroundColor: '#ffffff' });
      } catch (error) {
        console.warn('[CollaborativeWhiteboard] Failed to send clear update:', error);
      }
    }
  }, [sessionId, readOnly, isConnected, connectionError]);


  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onPointerMove={handlePointerMove}
    >
      {/* Connection Status for readonly mode */}
      {readOnly && (
        <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded text-xs ${
          isConnected ? 'bg-green-500/20 text-green-400' :
          connectionError ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {isConnected ? '🟢 Connected' :
           connectionError ? '🟡 Offline Mode' :
           '🔴 Connecting...'}
        </div>
      )}
      {/* Horizontal Toolbar at Top */}
      {!readOnly && (
        <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Clear whiteboard"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400">
              Collaborative Whiteboard
            </div>
            {/* Connection Status */}
            <div className={`px-2 py-1 rounded text-xs ${
              isConnected ? 'bg-green-500/20 text-green-400' :
              connectionError ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {isConnected ? '🟢 Connected' :
               connectionError ? '🟡 Offline Mode' :
               '🔴 Connecting...'}
            </div>
          </div>
        </div>
      )}

      {/* Excalidraw Canvas - Full height minus toolbar */}
      <div className="w-full" style={{ height: readOnly ? '100%' : 'calc(100% - 48px)' }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api;
          }}
          initialData={initialData}
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
      {Array.from(remoteCursors.entries()).map(([userId, cursor]) => (
        <div
          key={userId}
          className="absolute pointer-events-none z-20 transition-all duration-75"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: 'translate(-2px, -2px)',
          }}
        >
          <div className="w-4 h-4 text-violet-500">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.5 3.21V20.8l5.3-5.3h8.4L5.5 3.21z" />
            </svg>
          </div>
          <span className="absolute left-4 top-0 px-1.5 py-0.5 bg-violet-500 text-white text-xs rounded whitespace-nowrap">
            {userId.slice(0, 8)}
          </span>
        </div>
      ))}

    </div>
  );
}

export default CollaborativeWhiteboard;

