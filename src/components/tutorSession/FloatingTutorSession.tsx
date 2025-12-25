import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff,
  Monitor, MonitorOff, Minimize2, X, Send, User
} from 'lucide-react';
import Daily from '@daily-co/daily-js';
import {
  connectTutorSessionSocket,
  disconnectTutorSessionSocket,
  subscribeToSession,
  unsubscribeFromSession,
  sendChatMessage,
  onChatMessage,
  offChatMessage,
  onSessionStatusChanged,
  offSessionStatusChanged,
} from '../../services/tutorSessionSocket';
import { tutorSessionApi } from '../../api';
import { DailyRoom, TutorStudentChatMessage } from '../../types';
import toast from 'react-hot-toast';

interface FloatingTutorSessionProps {
  tutorSessionId: string;
  tutor: {
    id: string;
    name: string;
    avatar?: string;
  };
  dailyRoom: DailyRoom;
  onClose: () => void;
}

interface TutorSessionState {
  isMinimized: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  chatMessages: TutorStudentChatMessage[];
  sessionStatus: 'WAITING' | 'ACTIVE' | 'COMPLETED';
}

export function FloatingTutorSession({
  tutorSessionId,
  tutor,
  dailyRoom,
  onClose
}: FloatingTutorSessionProps) {
  const [state, setState] = useState<TutorSessionState>({
    isMinimized: false,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isScreenSharing: false,
    chatMessages: [],
    sessionStatus: 'WAITING'
  });

  const [newMessage, setNewMessage] = useState('');
  const [dailyCall, setDailyCall] = useState<any>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Initialize Daily.co call
  useEffect(() => {
    let call: any = null;

    const initializeDailyCall = async () => {
      try {
        call = Daily.createCallObject();

        await call.join({
          url: dailyRoom.url,
          token: dailyRoom.token,
          videoSource: false, // Start with video off
          audioSource: true
        });

        call.on('joined-meeting', handleJoinedMeeting);
        call.on('participant-joined', handleParticipantJoined);
        call.on('participant-left', handleParticipantLeft);

        setDailyCall(call);
      } catch (error) {
        console.error('Failed to join Daily call:', error);
        toast.error('Failed to connect to video call');
      }
    };

    initializeDailyCall();

    return () => {
      if (call) {
        call.leave();
      }
    };
  }, [dailyRoom]);

  // Connect to tutor session WebSocket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    connectTutorSessionSocket(token);
    subscribeToSession(tutorSessionId);

    // Listen for chat messages
    const handleChatMessage = (message: TutorStudentChatMessage) => {
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, message]
      }));
    };

    // Listen for session status changes
    const handleSessionStatusChanged = (data: { sessionId: string; status: string }) => {
      if (data.sessionId === tutorSessionId) {
        setState(prev => ({
          ...prev,
          sessionStatus: data.status as any
        }));

        if (data.status === 'ACTIVE') {
          toast.success('Tutor session started!');
        } else if (data.status === 'COMPLETED') {
          toast.success('Tutor session ended');
          onClose();
        }
      }
    };

    onChatMessage(handleChatMessage);
    onSessionStatusChanged(handleSessionStatusChanged);

    return () => {
      offChatMessage();
      offSessionStatusChanged();
      unsubscribeFromSession(tutorSessionId);
      disconnectTutorSessionSocket();
    };
  }, [tutorSessionId, onClose]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [state.chatMessages]);

  const handleJoinedMeeting = useCallback(() => {
    console.log('Joined Daily meeting');
    toast.success('Connected to video call');
  }, []);

  const handleParticipantJoined = useCallback((participant: any) => {
    console.log('Participant joined:', participant);
    if (participant.local) return;
    toast.success(`${tutor.name} joined the call`);
  }, [tutor.name]);

  const handleParticipantLeft = useCallback((participant: any) => {
    console.log('Participant left:', participant);
    if (participant.local) return;
    toast(`${tutor.name} left the call`);
  }, []);

  const toggleMinimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const toggleAudio = useCallback(async () => {
    if (!dailyCall) return;

    try {
      const isMuted = dailyCall.isLocalAudioMuted();
      await dailyCall.setLocalAudio(!isMuted);
      setState(prev => ({ ...prev, isAudioEnabled: !isMuted }));
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      toast.error('Failed to toggle audio');
    }
  }, [dailyCall]);

  const toggleVideo = useCallback(async () => {
    if (!dailyCall) return;

    try {
      const isOff = !dailyCall.isLocalVideoMuted();
      await dailyCall.setLocalVideo(isOff);
      setState(prev => ({ ...prev, isVideoEnabled: isOff }));
    } catch (error) {
      console.error('Failed to toggle video:', error);
      toast.error('Failed to toggle video');
    }
  }, [dailyCall]);

  const toggleScreenShare = useCallback(async () => {
    if (!dailyCall) return;

    try {
      const isSharing = dailyCall.isLocalScreenShare();

      if (isSharing) {
        await dailyCall.stopScreenShare();
      } else {
        await dailyCall.startScreenShare();
      }

      setState(prev => ({ ...prev, isScreenSharing: !isSharing }));
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
      toast.error('Failed to toggle screen sharing');
    }
  }, [dailyCall]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;

    try {
      await sendChatMessage(tutorSessionId, newMessage.trim());
      setNewMessage('');
      chatInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  }, [newMessage, tutorSessionId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const endSession = useCallback(async () => {
    try {
      await tutorSessionApi.endSession(tutorSessionId);
      onClose();
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session');
    }
  }, [tutorSessionId, onClose]);

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (state.isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
        onClick={toggleMinimize}
      >
        <User className="w-6 h-6 text-white" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-[#1a1a1a] border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
            {tutor.name?.charAt(0) || 'T'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{tutor.name}</p>
            <p className="text-xs text-emerald-400">
              {state.sessionStatus === 'ACTIVE' ? 'In Session' : 'Connecting...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimize}
            className="p-1 text-gray-400 hover:text-white rounded transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={endSession}
            className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatMessagesRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {state.chatMessages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex ${message.role === 'tutor' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                message.role === 'tutor'
                  ? 'bg-gray-700 text-white'
                  : 'bg-violet-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">
                  {message.role === 'tutor' ? tutor.name : 'You'}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            ref={chatInputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Call Controls */}
      <div className="p-3 border-t border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full transition-colors ${
              state.isAudioEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {state.isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              state.isVideoEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {state.isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full transition-colors ${
              state.isScreenSharing
                ? 'bg-violet-600 hover:bg-violet-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {state.isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
