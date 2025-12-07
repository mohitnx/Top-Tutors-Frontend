import { Message, SenderType, MessageType } from '../../types';
import { Check, CheckCheck, Mic } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderTypeLabel = {
    [SenderType.STUDENT]: 'Student',
    [SenderType.TUTOR]: 'Tutor',
    [SenderType.SYSTEM]: 'System',
  };

  if (message.senderType === SenderType.SYSTEM) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  const isAudioMessage = message.messageType === MessageType.AUDIO;

  return (
    <div className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] md:max-w-[65%] ${
          isOwn
            ? 'bg-primary-600 text-white'
            : 'bg-white border border-gray-200 text-gray-900'
        }`}
        style={{ borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px' }}
      >
        {/* Message header for received messages */}
        {!isOwn && (
          <div className="px-3 pt-2 pb-1">
            <span className="text-xs font-medium text-primary-600">
              {senderTypeLabel[message.senderType]}
            </span>
          </div>
        )}

        {/* Message content */}
        <div className={`px-3 ${isOwn ? 'pt-2' : 'pt-0'} pb-1`}>
          {isAudioMessage ? (
            <div className="flex items-start gap-2">
              <div className={`p-1 rounded-full flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-primary-100'}`}>
                <Mic className={`w-3 h-3 ${isOwn ? 'text-white' : 'text-primary-600'}`} />
              </div>
              <div className="flex-1">
                {message.audioUrl ? (
                  <AudioPlayer
                    src={message.audioUrl}
                    duration={message.audioDuration}
                    isOwn={isOwn}
                    transcription={message.transcription}
                    showTranscription={true}
                  />
                ) : (
                  <p className={`text-sm ${isOwn ? 'text-white/80' : 'text-gray-600'}`}>
                    Audio message
                  </p>
                )}
                {/* Show processed content if available */}
                {message.content && !message.transcription && (
                  <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
        </div>

        {/* Message footer */}
        <div className={`px-3 pb-2 flex items-center justify-end gap-1 ${
          isOwn ? 'text-white/70' : 'text-gray-400'
        }`}>
          <span className="text-[10px]">{formatTime(message.createdAt)}</span>
          {isOwn && (
            message.isRead 
              ? <CheckCheck className="w-3.5 h-3.5" />
              : <Check className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
