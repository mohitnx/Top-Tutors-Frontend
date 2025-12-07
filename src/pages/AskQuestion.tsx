import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Lightbulb, ArrowLeft, Mic, Paperclip, X, Loader2, Play, Pause, Trash2 } from 'lucide-react';
import { messagesApi } from '../api';
import { MessageType } from '../types';
import Button from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import toast from 'react-hot-toast';

const questionTips = [
  'Be specific about what you need help with',
  'Include any relevant context or background',
  'Mention what you\'ve already tried',
  'Share any error messages or results',
];

type InputMode = 'text' | 'audio' | 'recording';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AskQuestion() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    isPaused,
    duration,
    audioUrl,
    error: recorderError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getAudioFile,
  } = useAudioRecorder(300);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast.error('Please enter your question');
      return;
    }

    if (question.trim().length < 10) {
      toast.error('Please provide more detail in your question');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await messagesApi.sendMessage({
        content: question.trim(),
        messageType: MessageType.TEXT,
      });

      const tutorName = response.data.conversation.tutor?.user?.name || 'a tutor';
      toast.success(`Your question has been sent to ${tutorName}!`);
      
      navigate(`/conversations/${response.data.conversation.id}`);
    } catch (error: unknown) {
      console.error('Failed to send question:', error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to send your question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAudioSubmit = async () => {
    let audioFile: File | null = null;

    if (uploadedAudio) {
      audioFile = uploadedAudio;
    } else if (audioUrl) {
      audioFile = getAudioFile();
    }

    if (!audioFile) {
      toast.error('No audio to send');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const response = await messagesApi.sendAudioMessage(
        audioFile,
        undefined,
        (progress) => setUploadProgress(progress)
      );

      const tutorName = response.data.conversation.tutor?.user?.name || 'a tutor';
      
      // Show classification info
      if (response.data.classification) {
        const { subject, topic, transcription } = response.data.classification;
        toast.success(
          <div>
            <p className="font-medium">Question sent to {tutorName}!</p>
            <p className="text-sm mt-1">Subject: {subject}</p>
            {topic && <p className="text-sm">Topic: {topic}</p>}
            {transcription && (
              <p className="text-sm italic mt-1">"{transcription.slice(0, 50)}..."</p>
            )}
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.success(`Your question has been sent to ${tutorName}!`);
      }
      
      navigate(`/conversations/${response.data.conversation.id}`);
    } catch (error: unknown) {
      console.error('Failed to send audio:', error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to send audio. Please try again.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Audio file must be less than 25MB');
      return;
    }

    setUploadedAudio(file);
    setInputMode('audio');
    resetRecording();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartRecording = () => {
    setUploadedAudio(null);
    setInputMode('recording');
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    setInputMode('audio');
  };

  const handleCancelAudio = () => {
    resetRecording();
    setUploadedAudio(null);
    setInputMode('text');
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ask a Question
          </h1>
          <p className="text-gray-600">
            Type your question or record a voice message — we'll match you with the best tutor.
          </p>
        </div>

        {/* Input Type Toggle */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setInputMode('text')}
              disabled={isRecording}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded transition-colors ${
                inputMode === 'text'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              📝 Text
            </button>
            <button
              onClick={handleStartRecording}
              disabled={isSubmitting}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded transition-colors ${
                inputMode === 'recording' || (inputMode === 'audio' && !uploadedAudio)
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              🎤 Voice
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Text Input Mode */}
          {inputMode === 'text' && (
            <form onSubmit={handleTextSubmit}>
              <Textarea
                label="Your Question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Example: I'm having trouble understanding how to solve quadratic equations using the quadratic formula..."
                className="min-h-[200px]"
              />
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    {question.length} characters
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <Paperclip className="w-3 h-3" />
                    Upload audio instead
                  </button>
                </div>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Question
                </Button>
              </div>
            </form>
          )}

          {/* Recording Mode */}
          {inputMode === 'recording' && isRecording && (
            <div className="text-center py-8">
              {recorderError ? (
                <div className="text-red-600 mb-4">{recorderError}</div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                    <span className="text-lg font-medium text-gray-900">
                      {isPaused ? 'Paused' : 'Recording...'}
                    </span>
                  </div>

                  <div className="text-4xl font-mono font-bold text-gray-900 mb-6">
                    {formatDuration(duration)}
                  </div>

                  {/* Waveform visualization */}
                  <div className="flex items-center justify-center gap-1 h-16 mb-6">
                    {[...Array(30)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 bg-red-400 rounded-full transition-all duration-100`}
                        style={{
                          height: isPaused ? '8px' : `${Math.random() * 40 + 16}px`,
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className="p-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    >
                      {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={handleStopRecording}
                      className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <div className="w-6 h-6 bg-white rounded" />
                    </button>
                    <button
                      onClick={handleCancelAudio}
                      className="p-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Audio Review Mode */}
          {inputMode === 'audio' && (audioUrl || uploadedAudio) && (
            <div className="py-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex items-center gap-3 p-4 bg-gray-100 rounded-lg">
                  {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
                  
                  <button
                    onClick={togglePlayback}
                    className="p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  
                  <div className="text-left">
                    <p className="font-medium text-gray-900">
                      {uploadedAudio ? uploadedAudio.name : 'Voice Recording'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {uploadedAudio 
                        ? `${(uploadedAudio.size / 1024 / 1024).toFixed(2)} MB`
                        : formatDuration(duration)
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload progress */}
              {isSubmitting && uploadProgress > 0 && (
                <div className="mb-6">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleCancelAudio}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleStartRecording}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                  Re-record
                </button>
                <Button
                  onClick={handleAudioSubmit}
                  isLoading={isSubmitting}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Voice Message
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-primary-900 mb-2">Tips for a great question</h3>
              <ul className="space-y-1">
                {questionTips.map((tip, index) => (
                  <li key={index} className="text-sm text-primary-800 flex items-start gap-2">
                    <span className="text-primary-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-primary-700 mt-3">
                <strong>Voice messages:</strong> Speak naturally in any language — our AI will transcribe and understand your question!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AskQuestion;
