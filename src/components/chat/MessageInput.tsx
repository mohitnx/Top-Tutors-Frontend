import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, X, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface AttachmentPreview {
  file: File;
  preview?: string; // Only for images
  type: 'image' | 'pdf';
}

interface MessageInputProps {
  onSendText: (content: string) => void;
  onSendAttachments?: (files: File[], content?: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_IMAGE_COUNT = 1;
const MAX_PDF_COUNT = 3;
const MAX_FILE_SIZE_MB = 10;

export function MessageInput({ 
  onSendText,
  onSendAttachments,
  onTyping, 
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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

  // Cleanup image previews on unmount
  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.preview) {
          URL.revokeObjectURL(att.preview);
        }
      });
    };
  }, [attachments]);

  const handleChange = (value: string) => {
    setMessage(value);

    if (onTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    const hasContent = trimmedMessage || attachments.length > 0;
    
    if (!hasContent || disabled || isUploading) return;

    // If we have attachments, send them with optional text
    if (attachments.length > 0 && onSendAttachments) {
      setIsUploading(true);
      try {
        const files = attachments.map(a => a.file);
        await onSendAttachments(files, trimmedMessage || undefined);
        
        // Clear attachments
        attachments.forEach(att => {
          if (att.preview) {
            URL.revokeObjectURL(att.preview);
          }
        });
        setAttachments([]);
        setMessage('');
      } catch (error) {
        console.error('Failed to send attachments:', error);
        toast.error('Failed to send attachments');
      } finally {
        setIsUploading(false);
      }
    } else if (trimmedMessage) {
      // Just text message
      onSendText(trimmedMessage);
      setMessage('');
    }

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
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Validate and categorize files
    const newAttachments: AttachmentPreview[] = [];
    const currentImages = attachments.filter(a => a.type === 'image');
    const currentPdfs = attachments.filter(a => a.type === 'pdf');

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max size is ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }

      // Check if it's an image
      if (file.type.startsWith('image/')) {
        // Can only have 1 image OR PDFs, not both
        if (currentPdfs.length > 0 || newAttachments.some(a => a.type === 'pdf')) {
          toast.error('Cannot mix images and PDFs. Choose one type.');
          continue;
        }
        if (currentImages.length + newAttachments.filter(a => a.type === 'image').length >= MAX_IMAGE_COUNT) {
          toast.error(`Maximum ${MAX_IMAGE_COUNT} image allowed`);
          continue;
        }
        
        newAttachments.push({
          file,
          preview: URL.createObjectURL(file),
          type: 'image',
        });
      } 
      // Check if it's a PDF
      else if (file.type === 'application/pdf') {
        // Can only have PDFs OR images, not both
        if (currentImages.length > 0 || newAttachments.some(a => a.type === 'image')) {
          toast.error('Cannot mix images and PDFs. Choose one type.');
          continue;
        }
        if (currentPdfs.length + newAttachments.filter(a => a.type === 'pdf').length >= MAX_PDF_COUNT) {
          toast.error(`Maximum ${MAX_PDF_COUNT} PDFs allowed`);
          continue;
        }
        
        newAttachments.push({
          file,
          type: 'pdf',
        });
      } else {
        toast.error(`${file.name}: Only images and PDFs are allowed`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      const removed = newAttachments.splice(index, 1)[0];
      if (removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return newAttachments;
    });
  };

  const canSend = (message.trim() || attachments.length > 0) && !disabled && !isUploading;

  return (
    <div className="bg-[#1c1c1c]">
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative group"
            >
              {attachment.type === 'image' ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-700">
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                  <FileText className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-gray-300 max-w-[100px] truncate">
                    {attachment.file.name}
                  </span>
                </div>
              )}
              
              {/* Remove button */}
              <button
                onClick={() => removeAttachment(index)}
                className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2 p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="Attach image or PDF"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          rows={1}
          className="flex-1 resize-none px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
          style={{ maxHeight: '100px' }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed flex-shrink-0"
          aria-label="Send message"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Help text for attachments */}
      {attachments.length > 0 && (
        <div className="px-3 pb-2 text-xs text-gray-500">
          {attachments[0].type === 'image' 
            ? 'Max 1 image allowed' 
            : `${attachments.length}/${MAX_PDF_COUNT} PDFs`}
        </div>
      )}
    </div>
  );
}

export default MessageInput;
