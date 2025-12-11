import { Message, SenderType, MessageType, CallEvent, Attachment } from '../../types';
import { Check, CheckCheck, Volume2, Phone, PhoneOff, PhoneMissed, PhoneIncoming, PhoneOutgoing, FileText, Download, ExternalLink } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(content: string | null): string | null {
  // Extract duration from content like "📞 AUDIO call ended (2m 30s)"
  if (!content) return null;
  const match = content.match(/\((\d+m?\s*\d*s?)\)/);
  return match ? match[1] : null;
}

function CallSystemMessage({ message }: { message: Message }) {
  const { callEvent, content } = message;
  const duration = formatDuration(content);

  let icon = Phone;
  let iconBg = 'bg-gray-100';
  let iconColor = 'text-gray-500';
  let text = content || 'Call';
  let subtext = '';

  switch (callEvent) {
    case CallEvent.INITIATED:
      icon = PhoneOutgoing;
      iconBg = 'bg-blue-50';
      iconColor = 'text-blue-500';
      text = 'Call started';
      break;
    case CallEvent.ANSWERED:
      icon = Phone;
      iconBg = 'bg-green-50';
      iconColor = 'text-green-500';
      text = 'Call connected';
      break;
    case CallEvent.REJECTED:
      icon = PhoneOff;
      iconBg = 'bg-red-50';
      iconColor = 'text-red-500';
      // Extract reason from content
      const reasonMatch = content?.match(/declined:?\s*"?([^"]+)"?$/i);
      text = 'Call declined';
      if (reasonMatch) {
        subtext = reasonMatch[1];
      }
      break;
    case CallEvent.ENDED:
      icon = PhoneOff;
      iconBg = 'bg-gray-100';
      iconColor = 'text-gray-500';
      text = 'Call ended';
      if (duration) {
        subtext = duration;
      }
      break;
    case CallEvent.MISSED:
      icon = PhoneMissed;
      iconBg = 'bg-amber-50';
      iconColor = 'text-amber-500';
      text = 'Missed call';
      break;
    default:
      // Fallback to parsing content for legacy messages
      if (content?.includes('started')) {
        icon = PhoneOutgoing;
        iconBg = 'bg-blue-50';
        iconColor = 'text-blue-500';
      } else if (content?.includes('connected')) {
        icon = Phone;
        iconBg = 'bg-green-50';
        iconColor = 'text-green-500';
      } else if (content?.includes('declined')) {
        icon = PhoneOff;
        iconBg = 'bg-red-50';
        iconColor = 'text-red-500';
      } else if (content?.includes('ended')) {
        icon = PhoneOff;
      } else if (content?.includes('Missed')) {
        icon = PhoneMissed;
        iconBg = 'bg-amber-50';
        iconColor = 'text-amber-500';
      }
      text = content || 'Call';
  }

  const IconComponent = icon;

  return (
    <div className="flex justify-center my-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3 max-w-[280px]">
        <div className={`p-2.5 rounded-full ${iconBg}`}>
          <IconComponent className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{text}</p>
          {subtext && (
            <p className="text-xs text-gray-500 truncate">{subtext}</p>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function AttachmentDisplay({ attachments, isOwn }: { attachments: Attachment[]; isOwn: boolean }) {
  const images = attachments.filter(a => a.type.startsWith('image/'));
  const pdfs = attachments.filter(a => a.type === 'application/pdf');

  return (
    <div className="space-y-2">
      {/* Image attachments */}
      {images.map((attachment, index) => (
        <a
          key={index}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
        >
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full max-h-[300px] object-contain"
            loading="lazy"
          />
        </a>
      ))}

      {/* PDF attachments */}
      {pdfs.map((attachment, index) => (
        <a
          key={index}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
            isOwn 
              ? 'bg-white/10 hover:bg-white/20' 
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <div className={`p-2 rounded-lg ${isOwn ? 'bg-white/20' : 'bg-red-50'}`}>
            <FileText className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-red-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {attachment.name}
            </p>
            <p className={`text-xs ${isOwn ? 'text-white/60' : 'text-gray-500'}`}>
              PDF • {formatFileSize(attachment.size)}
            </p>
          </div>
          <ExternalLink className={`w-4 h-4 ${isOwn ? 'text-white/60' : 'text-gray-400'}`} />
        </a>
      ))}
    </div>
  );
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  // Handle system messages (including call events)
  if (message.senderType === SenderType.SYSTEM || message.isSystemMessage) {
    // Check if it's a call-related system message
    if (message.callEvent || message.content?.includes('call')) {
      return <CallSystemMessage message={message} />;
    }
    
    // Regular system message
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-500 text-xs px-4 py-1.5 rounded-full font-medium">
          {message.content}
        </div>
      </div>
    );
  }

  const isAudioMessage = message.messageType === MessageType.AUDIO;
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[320px] md:max-w-[400px] ${
          isOwn
            ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl rounded-br-md'
            : 'bg-white border border-gray-100 text-gray-900 rounded-2xl rounded-bl-md shadow-sm'
        }`}
      >
        {/* Message content */}
        <div className="px-4 py-2.5">
          {/* Attachments */}
          {hasAttachments && (
            <div className="mb-2">
              <AttachmentDisplay attachments={message.attachments!} isOwn={isOwn} />
            </div>
          )}

          {isAudioMessage ? (
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isOwn ? 'bg-white/20' : 'bg-primary-50'}`}>
                <Volume2 className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-primary-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                {message.audioUrl ? (
                  <AudioPlayer
                    src={message.audioUrl}
                    duration={message.audioDuration}
                    isOwn={isOwn}
                    transcription={message.transcription}
                    showTranscription={true}
                  />
                ) : (
                  <p className={`text-sm ${isOwn ? 'text-white/80' : 'text-gray-500'}`}>
                    Audio message
                  </p>
                )}
                {message.content && !message.transcription && (
                  <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          ) : message.content ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : null}
        </div>

        {/* Message footer - time and read status */}
        <div className={`px-4 pb-2 flex items-center justify-end gap-1.5 ${
          isOwn ? 'text-white/60' : 'text-gray-400'
        }`}>
          <span className="text-[11px] font-medium">
            {formatTime(message.createdAt)}
          </span>
          {isOwn && (
            message.isRead
              ? <CheckCheck className="w-4 h-4 text-white/80" />
              : <Check className="w-4 h-4" />
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
