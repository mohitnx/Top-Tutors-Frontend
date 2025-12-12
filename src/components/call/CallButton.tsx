import { Phone, Loader2 } from 'lucide-react';
import { useCall } from '../../contexts/CallContext';
import { CallStatus, CallType } from '../../types';

interface CallButtonProps {
  conversationId: string;
  disabled?: boolean;
  className?: string;
}

export function CallButton({ conversationId, disabled, className = '' }: CallButtonProps) {
  const { callState, initiateCall } = useCall();
  
  const isInCall = callState.status !== CallStatus.IDLE;
  const isCallForThisConversation = callState.conversationId === conversationId;
  const isInitiating = isCallForThisConversation && (
    callState.status === CallStatus.INITIATING || 
    callState.status === CallStatus.RINGING
  );

  const handleClick = () => {
    if (isInCall && !isCallForThisConversation) {
      // Already in another call
      return;
    }
    initiateCall(conversationId, CallType.AUDIO);
  };

  const buttonDisabled = disabled || (isInCall && !isCallForThisConversation);

  return (
    <button
      onClick={handleClick}
      disabled={buttonDisabled}
      className={`p-2 rounded-lg transition-all ${
        isInitiating
          ? 'bg-green-500 text-white animate-pulse'
          : buttonDisabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-500 hover:text-primary-600 hover:bg-primary-50'
      } ${className}`}
      title={
        buttonDisabled 
          ? 'Cannot call while in another call' 
          : isInitiating 
            ? 'Calling...' 
            : 'Start audio call'
      }
    >
      {isInitiating ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Phone className="w-5 h-5" />
      )}
    </button>
  );
}

export default CallButton;


