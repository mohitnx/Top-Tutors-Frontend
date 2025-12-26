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
  getWhiteboardData,
} from '../../services/tutorSessionSocket';
import { WhiteboardUpdateEvent } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;
type ExcalidrawElement = any;

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

// ⭐ CRITICAL: Merge elements from remote with local elements
// Elements are identified by their 'id' property
function mergeElements(localElements: ExcalidrawElement[], remoteElements: ExcalidrawElement[]): ExcalidrawElement[] {
  const elementMap = new Map<string, ExcalidrawElement>();
  
  // Add all local elements first
  for (const el of localElements) {
    if (el && el.id) {
      elementMap.set(el.id, el);
    }
  }
  
  // Override/add with remote elements (remote takes precedence for same IDs)
  for (const el of remoteElements) {
    if (el && el.id) {
      const existing = elementMap.get(el.id);
      // Use remote element if it's newer (higher version) or doesn't exist locally
      if (!existing || (el.version && existing.version && el.version >= existing.version)) {
        elementMap.set(el.id, el);
      } else if (!existing) {
        elementMap.set(el.id, el);
      }
    }
  }
  
  return Array.from(elementMap.values());
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
  const excalidrawReadyRef = useRef(false);
  const pendingUpdatesRef = useRef<any[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [debugInfo, setDebugInfo] = useState<string>('');

  // ⭐ Process any pending updates when Excalidraw becomes ready
  const processPendingUpdates = useCallback(() => {
    if (!excalidrawRef.current || pendingUpdatesRef.current.length === 0) return;
    
    console.log('[CollaborativeWhiteboard] Processing', pendingUpdatesRef.current.length, 'pending updates');
    
    const currentElements = excalidrawRef.current.getSceneElements() || [];
    let mergedElements = [...currentElements];
    
    for (const update of pendingUpdatesRef.current) {
      mergedElements = mergeElements(mergedElements, update.elements || []);
    }
    
    pendingUpdatesRef.current = [];
    
    isRemoteUpdateRef.current = true;
    excalidrawRef.current.updateScene({ elements: mergedElements });
    lastSentElementsRef.current = JSON.stringify(mergedElements);
    setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
  }, []);

  // ⭐ CRITICAL: Set up socket connection and event listeners
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

    // Connect to socket
    const socket = connectTutorSessionSocket(token);

    // ⭐ Handler for when socket connects
    const handleConnected = (data: any) => {
      if (cleanedUp) return;
      console.log('[CollaborativeWhiteboard] ✅ Socket connected:', data);
      setIsConnected(true);
      setConnectionError(false);
      setDebugInfo(`Connected as ${data?.role || 'user'}`);
    };

    // ⭐ Handler for joinSession acknowledgment
    const handleJoinSession = (response: any) => {
      if (cleanedUp) return;
      console.log('[CollaborativeWhiteboard] ✅ Join session response:', response);
      
      if (response.success || response.sessionId === sessionId) {
        joinedSessionRef.current = true;
        setDebugInfo(`Joined as ${response.role || 'user'}`);
        
        // Request whiteboard data after joining
        setTimeout(() => {
          if (!cleanedUp) {
            console.log('[CollaborativeWhiteboard] 📋 Requesting whiteboard data...');
            getWhiteboardData(sessionId);
          }
        }, 100);
      }
    };

    // ⭐ Handler for initial whiteboard data
    const handleWhiteboardData = (data: any) => {
      if (cleanedUp) return;
      console.log('[CollaborativeWhiteboard] 📋 Received whiteboard data:', data);
      
      // Always stop loading
      setIsLoading(false);

      // Check session ID
      if (data.sessionId && data.sessionId !== sessionId) {
        console.log('[CollaborativeWhiteboard] ⚠️ Ignoring data for different session');
        return;
      }

      const remoteElements = data.whiteboardData?.elements || [];
      
      // If Excalidraw isn't ready, queue the update
      if (!excalidrawRef.current) {
        console.log('[CollaborativeWhiteboard] ⏳ Queuing initial data (Excalidraw not ready)');
        pendingUpdatesRef.current.push({ elements: remoteElements });
        return;
      }

      // Get current local elements and merge
      const currentElements = excalidrawRef.current.getSceneElements() || [];
      const mergedElements = mergeElements(currentElements, remoteElements);
      
      console.log('[CollaborativeWhiteboard] 🎨 Applying merged data:', mergedElements.length, 'elements');
      
      isRemoteUpdateRef.current = true;
      try {
        excalidrawRef.current.updateScene({
          elements: mergedElements,
          appState: data.whiteboardData?.appState || { viewBackgroundColor: '#1e1e1e' },
        });
        lastSentElementsRef.current = JSON.stringify(mergedElements);
      } catch (err) {
        console.error('[CollaborativeWhiteboard] ❌ Failed to apply data:', err);
      }
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    // ⭐ Handler for live updates from other users - MERGES instead of replacing
    const handleWhiteboardUpdate = (data: WhiteboardUpdateEvent & { senderId?: string; senderRole?: string }) => {
      if (cleanedUp) return;
      console.log('[CollaborativeWhiteboard] 🔄 RECEIVED whiteboard update:', {
        sessionId: data.sessionId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        elementCount: data.elements?.length || 0,
      });

      // Check session ID
      if (data.sessionId && data.sessionId !== sessionId) {
        console.log('[CollaborativeWhiteboard] ⚠️ Ignoring update for different session');
        return;
      }

      const remoteElements = data.elements || [];

      // If Excalidraw isn't ready, queue the update
      if (!excalidrawRef.current) {
        console.warn('[CollaborativeWhiteboard] ⏳ Queuing update (Excalidraw not ready)');
        pendingUpdatesRef.current.push({ elements: remoteElements });
        return;
      }

      // ⭐ CRITICAL: Get current elements and MERGE with remote
      const currentElements = excalidrawRef.current.getSceneElements() || [];
      const mergedElements = mergeElements(currentElements, remoteElements);
      
      console.log('[CollaborativeWhiteboard] 🎨 MERGING remote update:', {
        local: currentElements.length,
        remote: remoteElements.length,
        merged: mergedElements.length,
      });
      
      isRemoteUpdateRef.current = true;
      try {
        excalidrawRef.current.updateScene({
          elements: mergedElements,
          appState: data.appState || {},
        });
        lastSentElementsRef.current = JSON.stringify(mergedElements);
        console.log('[CollaborativeWhiteboard] ✅ Merged update applied successfully');
      } catch (err) {
        console.error('[CollaborativeWhiteboard] ❌ Failed to apply update:', err);
      }
      setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
    };

    // ⭐ Register event listeners DIRECTLY on socket
    socket.on('connected', handleConnected);
    socket.on('joinSession', handleJoinSession);
    socket.on('whiteboardData', handleWhiteboardData);
    socket.on('whiteboardUpdate', handleWhiteboardUpdate);

    console.log('[CollaborativeWhiteboard] 👂 Event listeners registered on socket');

    // Join session when socket is ready
    const tryJoinSession = () => {
      if (cleanedUp) return;
      
      const currentSocket = getTutorSessionSocket();
      if (currentSocket?.connected) {
        console.log('[CollaborativeWhiteboard] 🚪 Joining session:', sessionId);
        joinSession(sessionId);
        setIsConnected(true);
        
        // Request data after a delay
        setTimeout(() => {
          if (!cleanedUp) {
            getWhiteboardData(sessionId);
          }
        }, 500);
      }
    };

    // Try to join immediately if already connected
    if (socket.connected) {
      tryJoinSession();
    }

    // Also set up connection listener for reconnects
    const unsubscribeConnect = onTutorSessionSocketConnect(() => {
      if (cleanedUp) return;
      console.log('[CollaborativeWhiteboard] 🔄 Socket (re)connected, joining session');
      tryJoinSession();
    });

    // ⭐ Loading timeout - don't wait forever
    const loadingTimeout = setTimeout(() => {
      if (!cleanedUp) {
        console.log('[CollaborativeWhiteboard] ⏰ Loading timeout');
        setIsLoading(false);
      }
    }, 5000);

    // Cleanup
    return () => {
      console.log('[CollaborativeWhiteboard] 🔌 Cleaning up');
      cleanedUp = true;
      joinedSessionRef.current = false;
      pendingUpdatesRef.current = [];
      clearTimeout(loadingTimeout);
      unsubscribeConnect();
      
      // ⭐ Remove event listeners from socket
      const currentSocket = getTutorSessionSocket();
      if (currentSocket) {
        currentSocket.off('connected', handleConnected);
        currentSocket.off('joinSession', handleJoinSession);
        currentSocket.off('whiteboardData', handleWhiteboardData);
        currentSocket.off('whiteboardUpdate', handleWhiteboardUpdate);
      }
    };
  }, [sessionId]);

  // ⭐ Clean up stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors(prev => {
        const now = Date.now();
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

    // Send whiteboard update via socket
    console.log('[CollaborativeWhiteboard] 📤 Sending whiteboard update:', elements.length, 'elements');
    sendWhiteboardUpdate(
      sessionId,
      [...elements],
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
    joinedSessionRef.current = false;
    
    // Re-join session and request data
    joinSession(sessionId);
    setTimeout(() => {
      getWhiteboardData(sessionId);
      // Stop loading after 3 seconds
      setTimeout(() => setIsLoading(false), 3000);
    }, 300);
  }, [sessionId]);

  // ⭐ Handle Excalidraw API ready
  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    console.log('[CollaborativeWhiteboard] ✅ Excalidraw API ready');
    excalidrawRef.current = api;
    excalidrawReadyRef.current = true;
    
    // Process any pending updates
    setTimeout(() => {
      processPendingUpdates();
    }, 100);
  }, [processPendingUpdates]);

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
          excalidrawAPI={handleExcalidrawAPI}
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
