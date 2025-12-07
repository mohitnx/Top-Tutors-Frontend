import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Mic, Paperclip, X, Loader2 } from 'lucide-react';
import AudioRecorder from './AudioRecorder';

interface MessageInputProps {
  onSendText: (content: string) => void;
  onSendAudio: (audioFile: File) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  showAudioButton?: boolean;
}

export function MessageInput({ 
  onSendText,
  onSendAudio,
  onTyping, 
  disabled = false,
  placeholder = 'Type a message...',
  showAudioButton = true,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleChange = (value: string) => {
    setMessage(value);

    if (onTyping) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Notify typing started
      onTyping(true);

      // Set timeout to notify typing stopped
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSendText = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    onSendText(trimmedMessage);
    setMessage('');

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (onTyping) {
      onTyping(false);
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleSendAudio = async (file: File) => {
    setIsUploadingAudio(true);
    try {
      await onSendAudio(file);
      setAudioFile(null);
    } catch (error) {
      console.error('Failed to send audio:', error);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      alert('Audio file must be less than 25MB');
      return;
    }

    await handleSendAudio(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // If recording mode is active
  if (isRecording) {
    return (
      <AudioRecorder
        onSend={handleSendAudio}
        onCancel={() => setIsRecording(false)}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="flex items-end gap-2 p-4 bg-white border-t border-gray-200">
      {/* Hidden file input for audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioFileSelect}
      />

      {/* Audio/Attachment buttons */}
      <div className="flex items-center gap-1">
        {/* Upload audio file */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploadingAudio}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          title="Upload audio file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Record audio */}
        {showAudioButton && (
          <button
            onClick={() => setIsRecording(true)}
            disabled={disabled}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Record audio"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none px-3 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        style={{ maxHeight: '120px' }}
      />

      {/* Send button */}
      <button
        onClick={handleSendText}
        disabled={disabled || !message.trim()}
        className="p-2.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        aria-label="Send message"
      >
        {isUploadingAudio ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}

export default MessageInput;
