import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

export interface UseAudioRecorderReturn extends AudioRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  getAudioFile: () => File | null;
}

const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
];

function getSupportedMimeType(): string {
  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return 'audio/webm'; // fallback
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'webm';
}

export function useAudioRecorder(maxDuration = 300): UseAudioRecorderReturn {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>('');

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Reset state
      chunksRef.current = [];
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: prev.audioUrl ? (URL.revokeObjectURL(prev.audioUrl), null) : null,
        error: null,
      }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      // Get supported mime type
      mimeTypeRef.current = getSupportedMimeType();

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeTypeRef.current,
      });
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioBlob: blob,
          audioUrl: url,
        }));

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        clearTimer();
      };

      // Handle error
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setState(prev => ({
          ...prev,
          isRecording: false,
          error: 'Recording failed. Please try again.',
        }));
        clearTimer();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second

      // Start duration timer
      timerRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 1;
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            mediaRecorderRef.current?.stop();
            return { ...prev, duration: maxDuration };
          }
          return { ...prev, duration: newDuration };
        });
      }, 1000);

      setState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (err) {
      console.error('Failed to start recording:', err);
      const errorMessage = err instanceof Error 
        ? err.name === 'NotAllowedError' 
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : err.message
        : 'Failed to access microphone';
      
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [maxDuration, clearTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      clearTimer();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, state.isPaused, clearTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 1;
          if (newDuration >= maxDuration) {
            mediaRecorderRef.current?.stop();
            return { ...prev, duration: maxDuration };
          }
          return { ...prev, duration: newDuration };
        });
      }, 1000);
      
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isRecording, state.isPaused, maxDuration]);

  const resetRecording = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Revoke URL
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    
    clearTimer();
    chunksRef.current = [];
    
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
    });
  }, [state.isRecording, state.audioUrl, clearTimer]);

  const getAudioFile = useCallback((): File | null => {
    if (!state.audioBlob) return null;
    
    const extension = getFileExtension(mimeTypeRef.current);
    const filename = `audio_${Date.now()}.${extension}`;
    
    return new File([state.audioBlob], filename, { 
      type: mimeTypeRef.current,
      lastModified: Date.now(),
    });
  }, [state.audioBlob]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAudioFile,
  };
}

export default useAudioRecorder;

