import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Volume2, VolumeX, Check } from 'lucide-react';
import { messagesApi } from '../../api';
import { SenderType, ReactionType } from '../../types';
import toast from 'react-hot-toast';

interface MessageActionsProps {
  messageId: string;
  senderType: SenderType;
  content: string | null;
  likeCount?: number;
  dislikeCount?: number;
  userReaction?: ReactionType | null;
  onReactionChange?: (likeCount: number, dislikeCount: number, userReaction: ReactionType | null) => void;
}

export function MessageActions({
  messageId,
  senderType,
  content,
  likeCount = 0,
  dislikeCount = 0,
  userReaction,
  onReactionChange,
}: MessageActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localDislikeCount, setLocalDislikeCount] = useState(dislikeCount);
  const [localUserReaction, setLocalUserReaction] = useState(userReaction);

  // Only show actions for TUTOR messages
  if (senderType !== SenderType.TUTOR || !content) return null;

  const handleReaction = async (type: ReactionType) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await messagesApi.addReaction(messageId, type);
      const data = response.data;

      let newLikeCount = localLikeCount;
      let newDislikeCount = localDislikeCount;
      let newUserReaction: ReactionType | null = null;

      if (data.removed) {
        // Reaction was removed
        if (type === 'LIKE') newLikeCount--;
        else newDislikeCount--;
        newUserReaction = null;
      } else if (data.added) {
        // New reaction added
        if (type === 'LIKE') newLikeCount++;
        else newDislikeCount++;
        newUserReaction = type;
      } else if (data.updated) {
        // Reaction changed from one to another
        if (type === 'LIKE') {
          newLikeCount++;
          newDislikeCount--;
        } else {
          newLikeCount--;
          newDislikeCount++;
        }
        newUserReaction = type;
      }

      setLocalLikeCount(Math.max(0, newLikeCount));
      setLocalDislikeCount(Math.max(0, newDislikeCount));
      setLocalUserReaction(newUserReaction);
      onReactionChange?.(newLikeCount, newDislikeCount, newUserReaction);
    } catch (error) {
      console.error('Failed to add reaction:', error);
      toast.error('Failed to add reaction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReadAloud = () => {
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to get a good English voice
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex items-center gap-0.5 mt-1">
      {/* Like */}
      <button
        onClick={() => handleReaction('LIKE')}
        disabled={isLoading}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all ${
          localUserReaction === 'LIKE'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
        }`}
      >
        <ThumbsUp className="w-3 h-3" />
        {localLikeCount > 0 && <span>{localLikeCount}</span>}
      </button>

      {/* Dislike */}
      <button
        onClick={() => handleReaction('DISLIKE')}
        disabled={isLoading}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all ${
          localUserReaction === 'DISLIKE'
            ? 'bg-red-500/20 text-red-400'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
        }`}
      >
        <ThumbsDown className="w-3 h-3" />
        {localDislikeCount > 0 && <span>{localDislikeCount}</span>}
      </button>

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-all"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>

      {/* Read Aloud */}
      <button
        onClick={handleReadAloud}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all ${
          isSpeaking
            ? 'bg-blue-500/20 text-blue-400'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
        }`}
      >
        {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>
    </div>
  );
}

export default MessageActions;

