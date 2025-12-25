import { useEffect, useRef, useState, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Trash2 } from 'lucide-react';
import {
  sendWhiteboardUpdate,
  sendWhiteboardCursor,
  getWhiteboardData,
  onWhiteboardUpdate,
  offWhiteboardUpdate,
  onWhiteboardData,
  offWhiteboardData,
  onWhiteboardCursor,
  offWhiteboardCursor,
} from '../../services/tutorSessionSocket';
import { WhiteboardUpdateEvent, WhiteboardCursorEvent } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

interface CollaborativeWhiteboardProps {
  sessionId: string;
  initialData?: { elements?: ExcalidrawElement[] };
  readOnly?: boolean;
  className?: string;
  onSave?: (elements: ExcalidrawElement[]) => void;
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
  
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

  // Load existing whiteboard data and handle incoming updates
  useEffect(() => {
    // Load existing whiteboard data
    getWhiteboardData(sessionId);

    const handleWhiteboardUpdate = (data: WhiteboardUpdateEvent) => {
      if (data.sessionId !== sessionId) return;

      // Avoid echo - don't apply our own updates
      const elementsJson = JSON.stringify(data.elements);
      if (elementsJson === lastSentElementsRef.current) return;

      if (excalidrawRef.current) {
        excalidrawRef.current.updateScene({
          elements: data.elements as ExcalidrawElement[],
        });
      }
    };

    const handleWhiteboardData = (data: any) => {
      if (data.sessionId !== sessionId) return;

      if (data.whiteboardEnabled && data.whiteboardData && excalidrawRef.current) {
        excalidrawRef.current.updateScene(data.whiteboardData);
      }
    };

    const handleWhiteboardCursor = (data: WhiteboardCursorEvent) => {
      if (data.sessionId !== sessionId) return;

      setRemoteCursors(prev => {
        const updated = new Map(prev);
        updated.set(data.userId, {
          x: data.x,
          y: data.y,
          lastUpdate: Date.now(),
        });
        return updated;
      });
    };

    onWhiteboardUpdate(handleWhiteboardUpdate);
    onWhiteboardData(handleWhiteboardData);
    onWhiteboardCursor(handleWhiteboardCursor);

    return () => {
      offWhiteboardUpdate();
      offWhiteboardData();
      offWhiteboardCursor();
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
  const handleChange = useCallback((elements: readonly ExcalidrawElement[]) => {

    if (readOnly) return;

    // Debounce and avoid sending identical updates
    const elementsJson = JSON.stringify(elements);
    if (elementsJson === lastSentElementsRef.current) return;
    lastSentElementsRef.current = elementsJson;

    // Send real-time update via socket
    const isConnected = sendWhiteboardUpdate(sessionId, elements as ExcalidrawElement[]);
    console.log('[CollaborativeWhiteboard] Socket send result:', isConnected);

    // Also save to backend for persistence
    if (onSave) {
      onSave(elements as ExcalidrawElement[]);
    }
  }, [sessionId, readOnly, onSave]);

  // Handle pointer move for cursor sharing
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (readOnly) return;

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
      sendWhiteboardCursor(sessionId, x, y);
    }
  }, [sessionId, readOnly]);


  // Clear whiteboard
  const handleClear = useCallback(() => {
    if (!excalidrawRef.current || readOnly) return;
    
    excalidrawRef.current.updateScene({
      elements: [],
    });
    sendWhiteboardUpdate(sessionId, []);
  }, [sessionId, readOnly]);


  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onPointerMove={handlePointerMove}
    >
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
          <div className="text-xs text-gray-400">
            Collaborative Whiteboard
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
            // Hide the default toolbar to prevent it from taking full page
            toolbar: false,
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

