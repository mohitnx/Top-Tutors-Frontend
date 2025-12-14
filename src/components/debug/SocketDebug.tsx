import { useEffect, useState } from 'react';
import { getSocket, onSocketConnect } from '../../services/socket';

/**
 * DEBUG COMPONENT - Shows all WebSocket events in real-time
 * Add this to any page to see what's happening with the socket
 */
export function SocketDebug() {
  const [events, setEvents] = useState<Array<{ time: string; event: string; data: string }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = () => {
      const socket = getSocket();
      setIsConnected(socket?.connected || false);
      setSocketId(socket?.id || null);
    };

    checkConnection();
    const unsubscribe = onSocketConnect(checkConnection);

    // Listen to ALL events
    const socket = getSocket();
    if (socket) {
      socket.onAny((eventName: string, ...args: unknown[]) => {
        const now = new Date().toLocaleTimeString();
        setEvents(prev => [{
          time: now,
          event: eventName,
          data: JSON.stringify(args, null, 2).slice(0, 500),
        }, ...prev.slice(0, 50)]);
      });
    }

    return () => {
      unsubscribe();
      socket?.offAny();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden text-xs font-mono">
      <div className="p-2 bg-gray-800 flex items-center justify-between">
        <span className="font-bold">🔌 Socket Debug</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      {socketId && (
        <div className="px-2 py-1 bg-gray-700 text-gray-300">
          ID: {socketId}
        </div>
      )}
      <div className="p-2 max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-gray-500">Waiting for events...</p>
        ) : (
          events.map((e, i) => (
            <div key={i} className="mb-2 border-b border-gray-700 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{e.time}</span>
                <span className="text-green-400 font-bold">{e.event}</span>
              </div>
              <pre className="text-gray-400 whitespace-pre-wrap break-all mt-1">
                {e.data}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SocketDebug;



