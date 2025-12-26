import { useState } from 'react';
import { X, AlertTriangle, ThumbsDown, UserX, MessageSquare, Loader2 } from 'lucide-react';
import { SessionCancelReason } from '../../types';
import { messagesApi } from '../../api';
import Button from '../ui/Button';
import toast from 'react-hot-toast';

interface CancelSessionModalProps {
  conversationId: string;
  onClose: () => void;
  onCancelled: () => void;
}

interface ReasonOption {
  id: SessionCancelReason;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const reasonOptions: ReasonOption[] = [
  {
    id: 'TUTOR_NOT_UP_TO_MARK',
    label: "Tutor wasn't up to mark",
    description: 'The previous tutor experience was unsatisfactory',
    icon: <ThumbsDown className="w-5 h-5" />,
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
  },
  {
    id: 'NO_TUTOR_ASSIGNED',
    label: 'No tutor was assigned',
    description: "I've been waiting too long without a tutor",
    icon: <UserX className="w-5 h-5" />,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'OTHER',
    label: 'Other reason',
    description: 'Something else (optional details)',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'text-gray-500 bg-gray-500/10 border-gray-500/30',
  },
];

export function CancelSessionModal({ conversationId, onClose, onCancelled }: CancelSessionModalProps) {
  const [selectedReason, setSelectedReason] = useState<SessionCancelReason | null>(null);
  const [otherDetails, setOtherDetails] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);

    try {
      await messagesApi.cancelWaitingSession(
        conversationId,
        selectedReason || undefined,
        selectedReason === 'OTHER' && otherDetails.trim() ? otherDetails.trim() : undefined
      );

      toast.success('Session cancelled');
      onCancelled();
    } catch (error: unknown) {
      console.error('Failed to cancel session:', error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to cancel session');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cancel Session</h2>
                <p className="text-sm text-gray-500">
                  Are you sure you want to leave?
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Help us improve! Let us know why you're leaving (optional):
          </p>

          {/* Reason Options */}
          <div className="space-y-2">
            {reasonOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedReason(
                  selectedReason === option.id ? null : option.id
                )}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                  selectedReason === option.id
                    ? option.color
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  selectedReason === option.id ? 'bg-white/50' : 'bg-gray-100'
                }`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    selectedReason === option.id ? '' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </p>
                  <p className={`text-sm ${
                    selectedReason === option.id ? 'opacity-80' : 'text-gray-500'
                  }`}>
                    {option.description}
                  </p>
                </div>
                {/* Checkbox indicator */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                  selectedReason === option.id
                    ? 'border-current bg-current'
                    : 'border-gray-300'
                }`}>
                  {selectedReason === option.id && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Other reason details */}
          {selectedReason === 'OTHER' && (
            <div className="mt-3">
              <textarea
                value={otherDetails}
                onChange={(e) => setOtherDetails(e.target.value)}
                placeholder="Tell us more (optional)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {otherDetails.length}/500
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Keep Waiting
          </Button>
          <Button
            variant="danger"
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex-1"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Cancelling...
              </>
            ) : (
              'Cancel Session'
            )}
          </Button>
        </div>

        {/* Footer note */}
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400 text-center">
            You can skip this and just cancel without selecting a reason
          </p>
        </div>
      </div>
    </div>
  );
}

export default CancelSessionModal;


