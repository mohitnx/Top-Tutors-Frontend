import { useState, useEffect } from 'react';
import { X, Phone, PhoneOff, PhoneMissed, PhoneIncoming, PhoneOutgoing, Clock, Video } from 'lucide-react';
import { messagesApi } from '../../api';
import { CallLog, CallEvent, CallType } from '../../types';

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string; // If provided, shows calls for this conversation only
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function CallStatusIcon({ status, direction }: { status: CallEvent; direction: 'OUTGOING' | 'INCOMING' }) {
  switch (status) {
    case CallEvent.ANSWERED:
    case CallEvent.ENDED:
      return direction === 'OUTGOING' 
        ? <PhoneOutgoing className="w-4 h-4 text-green-500" />
        : <PhoneIncoming className="w-4 h-4 text-green-500" />;
    case CallEvent.REJECTED:
      return <PhoneOff className="w-4 h-4 text-red-500" />;
    case CallEvent.MISSED:
      return <PhoneMissed className="w-4 h-4 text-amber-500" />;
    case CallEvent.INITIATED:
    default:
      return direction === 'OUTGOING'
        ? <PhoneOutgoing className="w-4 h-4 text-blue-500" />
        : <PhoneIncoming className="w-4 h-4 text-blue-500" />;
  }
}

function CallItem({ call }: { call: CallLog }) {
  const statusText = {
    [CallEvent.INITIATED]: 'Calling...',
    [CallEvent.ANSWERED]: 'Connected',
    [CallEvent.REJECTED]: 'Declined',
    [CallEvent.ENDED]: call.duration ? `${formatDuration(call.duration)}` : 'Ended',
    [CallEvent.MISSED]: 'Missed',
  };

  const isDeclined = call.status === CallEvent.REJECTED;
  const isMissed = call.status === CallEvent.MISSED;

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
      {/* Avatar */}
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
          {call.otherParty.name.charAt(0).toUpperCase()}
        </div>
        <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-sm">
          {call.callType === CallType.VIDEO ? (
            <Video className="w-3 h-3 text-gray-500" />
          ) : (
            <Phone className="w-3 h-3 text-gray-500" />
          )}
        </div>
      </div>

      {/* Call info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {call.otherParty.name}
          </span>
          <CallStatusIcon status={call.status} direction={call.direction} />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className={`${isMissed ? 'text-amber-600' : isDeclined ? 'text-red-600' : ''}`}>
            {statusText[call.status] || call.status}
          </span>
          {call.endReason && call.endReason !== 'completed' && call.endReason !== 'declined' && (
            <span className="text-gray-400 truncate max-w-[150px]">
              • "{call.endReason}"
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="text-right">
        <span className="text-sm text-gray-400">
          {formatDate(call.startedAt)}
        </span>
      </div>
    </div>
  );
}

export function CallHistoryModal({ isOpen, onClose, conversationId }: CallHistoryModalProps) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCalls = async () => {
      setLoading(true);
      setError(null);
      try {
        if (conversationId) {
          const response = await messagesApi.getConversationCalls(conversationId);
          if (response.success && response.data) {
            setCalls(response.data);
          }
        } else {
          const response = await messagesApi.getCallHistory(1, 50);
          if (response.success && response.data) {
            setCalls(response.data.calls);
          }
        }
      } catch (err) {
        console.error('Failed to fetch call history:', err);
        setError('Failed to load call history');
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-xl">
              <Clock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Call History</h2>
              <p className="text-sm text-gray-500">
                {conversationId ? 'Calls in this conversation' : 'All your calls'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-500">Loading calls...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <PhoneOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{error}</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="p-8 text-center">
              <Phone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No calls yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Your call history will appear here
              </p>
            </div>
          ) : (
            <div className="p-2">
              {calls.map((call) => (
                <CallItem key={call.id} call={call} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallHistoryModal;

