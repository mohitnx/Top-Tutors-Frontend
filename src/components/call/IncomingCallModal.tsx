import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, MessageSquare, X, Clock, Coffee } from 'lucide-react';
import { useCall } from '../../contexts/CallContext';
import { CallType } from '../../types';

const QUICK_REASONS = [
  { text: "I'll call back in a few minutes", icon: Clock },
  { text: "I'm busy right now", icon: Coffee },
  { text: "Can't talk, please message me", icon: MessageSquare },
];

export function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall } = useCall();
  const modalRef = useRef<HTMLDivElement>(null);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (incomingCall && modalRef.current) {
      modalRef.current.classList.add('animate-slide-down');
    }
    // Reset state when incoming call changes
    if (incomingCall) {
      setShowReasonPicker(false);
      setCustomReason('');
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const isAudioCall = incomingCall.callType === CallType.AUDIO;
  const callerName = incomingCall.callerName || 'Unknown';
  const initials = callerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleQuickReject = (reason: string) => {
    rejectCall(reason);
    setShowReasonPicker(false);
  };

  const handleCustomReject = () => {
    if (customReason.trim()) {
      rejectCall(customReason.trim());
    } else {
      rejectCall('declined');
    }
    setShowReasonPicker(false);
    setCustomReason('');
  };

  const handleSimpleReject = () => {
    rejectCall('declined');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleSimpleReject}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm transform transition-all overflow-hidden"
      >
        {!showReasonPicker ? (
          // Main incoming call view
          <div className="p-8">
            <div className="flex flex-col items-center">
              {/* Avatar with animated rings */}
              <div className="relative mb-6">
                <div className="absolute inset-[-16px] rounded-full border-2 border-primary-300 animate-ping opacity-30" />
                <div className="absolute inset-[-8px] rounded-full border-2 border-primary-400 animate-pulse opacity-50" />
                
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl font-bold">{initials}</span>
                </div>
              </div>

              {/* Caller info */}
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {callerName}
              </h3>
              <p className="text-gray-500 mb-8">
                Incoming {isAudioCall ? 'voice' : 'video'} call
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-6">
                {/* Decline with reason button */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setShowReasonPicker(true)}
                    className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                    title="Decline with message"
                  >
                    <PhoneOff className="w-7 h-7" />
                  </button>
                  <span className="text-sm text-gray-500">Decline</span>
                </div>

                {/* Accept button */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                    title="Accept"
                  >
                    <Phone className="w-7 h-7" />
                  </button>
                  <span className="text-sm text-gray-500">Accept</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Reason picker view
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Reply with message
              </h3>
              <button
                onClick={() => setShowReasonPicker(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Quick reasons */}
            <div className="space-y-2 mb-4">
              {QUICK_REASONS.map((reason, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickReject(reason.text)}
                  className="w-full flex items-center gap-3 p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <reason.icon className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">{reason.text}</span>
                </button>
              ))}
            </div>

            {/* Custom message input */}
            <div className="mb-4">
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Write a custom message..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomReject();
                  }
                }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSimpleReject}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors"
              >
                Decline without message
              </button>
              <button
                onClick={handleCustomReject}
                className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                Decline & Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IncomingCallModal;

