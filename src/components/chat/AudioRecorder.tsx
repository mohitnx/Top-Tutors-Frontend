import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, Trash2, Send, X, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface AudioRecorderProps {
  onSend: (audioFile: File) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioRecorder({ onSend, onCancel, disabled }: AudioRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAudioFile,
  } = useAudioRecorder(300); // 5 min max

  const [isSending, setIsSending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      resetRecording();
    };
  }, []);

  // Handle audio playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [audioUrl]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = async () => {
    const audioFile = getAudioFile();
    if (!audioFile) return;

    setIsSending(true);
    try {
      await onSend(audioFile);
      resetRecording();
      onCancel();
    } catch (err) {
      console.error('Failed to send audio:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    resetRecording();
    onCancel();
  };

  if (error) {
    return (
      <div className="flex items-center justify-between p-4 bg-red-50 border-t border-red-200">
        <div className="flex items-center gap-2 text-red-600">
          <Mic className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 text-red-600 hover:bg-red-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center justify-between p-4 bg-red-50 border-t border-red-200">
        <div className="flex items-center gap-3">
          {/* Recording indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-sm font-medium text-red-700">
              {isPaused ? 'Paused' : 'Recording'}
            </span>
          </div>
          
          {/* Duration */}
          <span className="text-sm text-red-600 font-mono">
            {formatDuration(duration)}
          </span>
          
          {/* Waveform visualization */}
          <div className="hidden sm:flex items-center gap-0.5 h-6">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`w-1 bg-red-400 rounded-full transition-all duration-75 ${
                  isPaused ? 'h-1' : ''
                }`}
                style={{
                  height: isPaused ? '4px' : `${Math.random() * 16 + 8}px`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause/Resume */}
          <button
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="p-2 text-red-600 hover:bg-red-100 rounded"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          
          {/* Stop */}
          <button
            onClick={stopRecording}
            className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
            title="Stop recording"
          >
            <Square className="w-5 h-5" />
          </button>
          
          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Review state (after recording)
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-3 flex-1">
          {/* Audio element */}
          <audio ref={audioRef} src={audioUrl} />
          
          {/* Play/Pause button */}
          <button
            onClick={togglePlayback}
            className="p-2 bg-primary-100 text-primary-600 rounded-full hover:bg-primary-200"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          {/* Duration */}
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: isPlaying ? '100%' : '0%', transition: isPlaying ? `width ${duration}s linear` : 'none' }}
              />
            </div>
            <span className="text-xs text-gray-500 mt-1">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Delete */}
          <button
            onClick={resetRecording}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded"
            title="Delete"
            disabled={isSending}
          >
            <Trash2 className="w-5 h-5" />
          </button>
          
          {/* Re-record */}
          <button
            onClick={startRecording}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded"
            title="Record again"
            disabled={isSending}
          >
            <Mic className="w-5 h-5" />
          </button>
          
          {/* Send */}
          <button
            onClick={handleSend}
            disabled={isSending || disabled}
            className="p-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
            title="Send"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
          
          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded"
            title="Cancel"
            disabled={isSending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Initial state (waiting to record)
  return (
    <div className="flex items-center justify-center p-4 bg-gray-50 border-t border-gray-200">
      <button
        onClick={startRecording}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600"
      >
        <Mic className="w-5 h-5" />
        <span>Start Recording</span>
      </button>
    </div>
  );
}

export default AudioRecorder;





