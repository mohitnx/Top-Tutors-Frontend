import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  duration?: number;
  isOwn?: boolean;
  transcription?: string;
  showTranscription?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ 
  src, 
  duration: initialDuration, 
  isOwn = false,
  transcription,
  showTranscription = true,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError(true);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={`text-xs ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
        Audio unavailable
      </div>
    );
  }

  return (
    <div className="w-full max-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-2">
        {/* Play/Pause button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className={`p-2 rounded-full flex-shrink-0 transition-colors ${
            isOwn 
              ? 'bg-white/20 hover:bg-white/30 text-white' 
              : 'bg-primary-100 hover:bg-primary-200 text-primary-600'
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>

        {/* Progress bar and time */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 appearance-none bg-transparent cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${isOwn ? 'rgba(255,255,255,0.8)' : '#0d9488'} ${progress}%, ${isOwn ? 'rgba(255,255,255,0.3)' : '#e2e8f0'} ${progress}%)`,
                borderRadius: '4px',
              }}
            />
          </div>
          <div className={`flex justify-between text-[10px] mt-0.5 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Mute button */}
        <button
          onClick={toggleMute}
          className={`p-1 rounded flex-shrink-0 ${
            isOwn ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Transcription */}
      {showTranscription && transcription && (
        <div className={`mt-2 pt-2 border-t ${isOwn ? 'border-white/20' : 'border-gray-200'}`}>
          <p className={`text-xs italic ${isOwn ? 'text-white/80' : 'text-gray-600'}`}>
            "{transcription}"
          </p>
        </div>
      )}
    </div>
  );
}

export default AudioPlayer;



