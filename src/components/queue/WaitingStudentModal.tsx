import { useState } from 'react';
import { Clock, User, BookOpen, AlertCircle, X, CheckCircle } from 'lucide-react';
import { WaitingStudentNotification, AvailabilityResponseType, RespondAvailabilityResponse } from '../../types';
import { respondAvailability } from '../../services/socket';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import toast from 'react-hot-toast';

interface WaitingStudentModalProps {
  notification: WaitingStudentNotification;
  onClose: () => void;
  onAccept?: (conversationId: string) => void;
}

export function WaitingStudentModal({ notification, onClose, onAccept }: WaitingStudentModalProps) {
  const [isResponding, setIsResponding] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [responded, setResponded] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  const { conversation, waitingQueue } = notification;

  const handleRespond = (responseType: AvailabilityResponseType, minutes?: number) => {
    setIsResponding(true);

    const request = {
      conversationId: conversation.id,
      responseType,
      ...(responseType === 'CUSTOM' && minutes ? { customMinutes: minutes } : {}),
    };

    respondAvailability(request, (response: RespondAvailabilityResponse) => {
      setIsResponding(false);

      if (response.success) {
        setResponded(true);
        setResponseMessage(response.message || `You'll be reminded in ${response.minutesUntilFree} minutes`);
        
        // Close modal after a brief delay
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        toast.error(response.error || 'Failed to respond');
      }
    });
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'URGENT': return 'text-red-500 bg-red-500/10';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10';
      case 'NORMAL': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  // If already responded, show success state
  if (responded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-700">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Response Recorded!</h3>
            <p className="text-gray-400">{responseMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Student Waiting</h2>
                <p className="text-sm text-amber-300">
                  Waiting for {waitingQueue.waitingMinutes} minutes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Student Info */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-start gap-3">
            <Avatar 
              name={conversation.student.name} 
              src={conversation.student.avatar} 
              size="md" 
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">{conversation.student.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getUrgencyColor(conversation.urgency)}`}>
                  {conversation.urgency}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <BookOpen className="w-4 h-4" />
                <span>{conversation.subject.replace('_', ' ')}</span>
              </div>
              {conversation.topic && (
                <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                  {conversation.topic}
                </p>
              )}
              {conversation.lastMessage && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2 italic">
                  "{conversation.lastMessage}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-gray-300">When will you be free to help?</p>
          </div>

          {/* Quick Response Options */}
          {!showCustomInput ? (
            <div className="space-y-2">
              <button
                onClick={() => handleRespond('MINUTES_5')}
                disabled={isResponding}
                className="w-full flex items-center justify-between px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 transition-colors disabled:opacity-50"
              >
                <span className="font-medium">In 5 minutes</span>
                <Clock className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleRespond('MINUTES_10')}
                disabled={isResponding}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 transition-colors disabled:opacity-50"
              >
                <span className="font-medium">In 10 minutes</span>
                <Clock className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowCustomInput(true)}
                disabled={isResponding}
                className="w-full flex items-center justify-between px-4 py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 transition-colors disabled:opacity-50"
              >
                <span className="font-medium">Custom time</span>
                <span className="text-sm">Specify minutes</span>
              </button>

              <button
                onClick={() => handleRespond('NOT_ANYTIME_SOON')}
                disabled={isResponding}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
              >
                <span className="font-medium">Not anytime soon</span>
                <span className="text-sm text-gray-500">~1 hour</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Math.max(1, Math.min(120, parseInt(e.target.value) || 15)))}
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Minutes"
                />
                <span className="text-gray-400">minutes</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustomInput(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => handleRespond('CUSTOM', customMinutes)}
                  disabled={isResponding}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isResponding ? 'Sending...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Accept Now Option (if tutor can accept) */}
        {onAccept && (
          <div className="p-4 pt-0">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[#2a2a2a] px-2 text-gray-500">or</span>
              </div>
            </div>
            <Button
              onClick={() => onAccept(conversation.id)}
              className="w-full mt-4"
              variant="primary"
            >
              Accept Session Now
            </Button>
          </div>
        )}

        {/* Loading Overlay */}
        {isResponding && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

export default WaitingStudentModal;

