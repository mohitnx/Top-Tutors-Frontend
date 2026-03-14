import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Plus,
  Send,
  FileText,
  Image as ImageIcon,
  Trash2,
  Settings,
  GraduationCap,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Paperclip,
  X,
  Brain,
  Globe,
  Users,
  MessageSquare,
  Download,
  Play,
  Pause,
  StopCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import {
  ProjectResponse,
  ProjectResourceResponse,
  ProjectChatSessionResponse,
  ProjectMessageResponse,
  UpdateProjectRequest,
  GenerateQuizRequest,
  SessionResourceResponse,
} from '../../types';
import { projectsApi } from '../../api/projects';
import { useProjectChat } from '../../hooks/useProjectChat';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { Modal, ConfirmModal } from '../../components/ui/Modal';

// ============================================
// Helpers
// ============================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ============================================
// Main Component
// ============================================

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Core state
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [resources, setResources] = useState<ProjectResourceResponse[]>([]);
  const [sessions, setSessions] = useState<ProjectChatSessionResponse[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProjectMessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // UI state
  const [messageInput, setMessageInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showResourcePanel, setShowResourcePanel] = useState(true);
  const [showSessionPanel] = useState(true);
  const [previewData, setPreviewData] = useState<{ url: string; mimeType: string; title: string } | null>(null);
  const [sessionResources, setSessionResources] = useState<SessionResourceResponse[]>([]);
  const [isUploadingSessionResource, setIsUploadingSessionResource] = useState(false);
  const sessionResourceFileInputRef = useRef<HTMLInputElement>(null);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<UpdateProjectRequest>({});

  // Quiz form
  const [quizForm, setQuizForm] = useState<GenerateQuizRequest>({
    questionCount: 5,
    quizType: 'MIXED',
    difficulty: 'MEDIUM',
  });
  const [quizOutputFormat, setQuizOutputFormat] = useState<'chat' | 'pdf'>('chat');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Audio state
  const [isAudioMode, setIsAudioMode] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const {
    isRecording, isPaused, duration, audioUrl,
    startRecording, stopRecording, pauseRecording, resumeRecording,
    resetRecording, getAudioFile,
  } = useAudioRecorder(300);

  // Chat mode state
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [councilModeEnabled, setCouncilModeEnabled] = useState(false);

  // Chat hook
  const {
    isStreaming,
    isWaitingForStream,
    streamingContent,
    streamingMessageId,
    streamStatus,
    councilAnalyzing,
    councilExperts,
    councilMembers,
    isCrossReviewing,
    isSynthesizing,
    sendMessage,
    sendMessageWithAttachments,
    addFeedback,
  } = useProjectChat({
    projectId: projectId || null,
    sessionId: activeSessionId,
    onStreamEnd: (chunk) => {
      // Persist the final AI message so it doesn't vanish
      const finalContent = chunk.fullContent ?? '';
      const aiMessage: ProjectMessageResponse = {
        id: chunk.messageId,
        sessionId: chunk.sessionId,
        role: 'ASSISTANT',
        content: finalContent,
        attachments: null,
        isStreaming: false,
        isComplete: true,
        hasError: false,
        errorMessage: null,
        feedback: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        // Replace temp/streaming version if exists, otherwise append
        const exists = prev.find((m) => m.id === chunk.messageId);
        if (exists) {
          return prev.map((m) => m.id === chunk.messageId ? { ...m, content: finalContent, isStreaming: false, isComplete: true } : m);
        }
        return [...prev, aiMessage];
      });
    },
  });

  // Mode toggle handlers (mutually exclusive)
  const handleDeepThinkToggle = () => {
    setDeepThinkEnabled((prev) => { if (!prev) { setDeepResearchEnabled(false); setCouncilModeEnabled(false); } return !prev; });
  };
  const handleDeepResearchToggle = () => {
    setDeepResearchEnabled((prev) => { if (!prev) { setDeepThinkEnabled(false); setCouncilModeEnabled(false); } return !prev; });
  };
  const handleCouncilModeToggle = () => {
    setCouncilModeEnabled((prev) => { if (!prev) { setDeepThinkEnabled(false); setDeepResearchEnabled(false); } return !prev; });
  };

  // ============================================
  // Data Fetching
  // ============================================

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const [projectData, sessionsData] = await Promise.all([
        projectsApi.getProject(projectId),
        projectsApi.getChatSessions(projectId),
      ]);
      setProject(projectData.project);
      setResources(projectData.resources);
      setSessions(sessionsData);

      // Auto-select first session
      if (sessionsData.length > 0 && !activeSessionId) {
        setActiveSessionId(sessionsData[0].id);
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        toast.error('Project not found');
        navigate('/projects');
      } else {
        toast.error('Failed to load project');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Fetch messages and session resources when session changes
  useEffect(() => {
    if (!projectId || !activeSessionId) {
      setMessages([]);
      setSessionResources([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const [data, sesResources] = await Promise.all([
          projectsApi.getChatSession(projectId, activeSessionId),
          projectsApi.getSessionResources(projectId, activeSessionId).catch(() => [] as SessionResourceResponse[]),
        ]);
        setMessages(data.messages);
        // Endpoint returns both project + session resources; keep only session-level
        setSessionResources(sesResources.filter((r) => r.sessionId));
      } catch {
        toast.error('Failed to load messages');
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [projectId, activeSessionId]);

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ============================================
  // Resource Upload
  // ============================================

  const handleResourceUpload = async (files: FileList | null) => {
    if (!files || !projectId) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Only images, PDFs, and documents (.txt, .doc, .docx) are allowed`);
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 20MB)`);
        continue;
      }

      if (resources.length >= 20) {
        toast.error('Maximum 20 files per project');
        break;
      }

      try {
        setIsUploadingResource(true);
        setUploadProgress(0);
        const title = file.name.replace(/\.[^/.]+$/, '');
        const resource = await projectsApi.uploadResource(projectId, file, title, (progress) => {
          setUploadProgress(progress);
        });
        setResources((prev) => [...prev, resource]);
        toast.success(`${file.name} uploaded`);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || `Failed to upload ${file.name}`);
      } finally {
        setIsUploadingResource(false);
        setUploadProgress(0);
      }
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!projectId) return;
    try {
      await projectsApi.deleteResource(projectId, resourceId);
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
      toast.success('File removed');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const handlePreviewResource = async (resource: ProjectResourceResponse) => {
    if (!projectId) return;
    try {
      const preview = await projectsApi.getResourcePreview(projectId, resource.id);
      setPreviewData(preview);
    } catch {
      toast.error('Failed to load preview');
    }
  };

  // ============================================
  // Session Resource Upload
  // ============================================

  const handleSessionResourceUpload = async (files: FileList | null) => {
    if (!files || !projectId || !activeSessionId) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Only images, PDFs, and documents (.txt, .doc, .docx) are allowed`);
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 20MB)`);
        continue;
      }

      try {
        setIsUploadingSessionResource(true);
        const title = file.name.replace(/\.[^/.]+$/, '');
        const resource = await projectsApi.uploadSessionResource(
          projectId, activeSessionId, file, title
        );
        setSessionResources((prev) => [...prev, resource]);
        toast.success(`${file.name} uploaded to session`);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || `Failed to upload ${file.name}`);
      } finally {
        setIsUploadingSessionResource(false);
      }
    }
  };

  const handleDeleteSessionResource = async (resourceId: string) => {
    if (!projectId || !activeSessionId) return;
    try {
      await projectsApi.deleteSessionResource(projectId, activeSessionId, resourceId);
      setSessionResources((prev) => prev.filter((r) => r.id !== resourceId));
      toast.success('Session file removed');
    } catch {
      toast.error('Failed to delete session file');
    }
  };

  const handlePreviewSessionResource = async (resource: SessionResourceResponse) => {
    if (!projectId || !activeSessionId) return;
    try {
      const preview = await projectsApi.getSessionResourcePreview(
        projectId, activeSessionId, resource.id
      );
      setPreviewData(preview);
    } catch {
      toast.error('Failed to load preview');
    }
  };

  // ============================================
  // Chat Sessions
  // ============================================

  const handleNewSession = async () => {
    if (!projectId) return;
    try {
      const session = await projectsApi.createChatSession(projectId);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
    } catch {
      toast.error('Failed to create chat session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!projectId) return;
    try {
      await projectsApi.deleteChatSession(projectId, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success('Chat session deleted');
    } catch {
      toast.error('Failed to delete session');
    }
  };

  // ============================================
  // Sending Messages
  // ============================================

  const handleSendMessage = async () => {
    const content = messageInput.trim();
    if (!content && attachedFiles.length === 0) return;
    if (isStreaming || isWaitingForStream) return;

    const currentInput = content;
    const currentFiles = [...attachedFiles];
    setMessageInput('');
    setAttachedFiles([]);

    // Optimistic user message
    const optimisticMsg: ProjectMessageResponse = {
      id: `temp-${Date.now()}`,
      sessionId: activeSessionId || '',
      role: 'USER',
      content: currentInput || null,
      attachments: null,
      isStreaming: false,
      isComplete: true,
      hasError: false,
      errorMessage: null,
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const modeOptions = {
      deepThink: deepThinkEnabled || undefined,
      deepResearch: deepResearchEnabled || undefined,
      councilMode: councilModeEnabled || undefined,
    };

    try {
      let response;
      if (currentFiles.length > 0) {
        response = await sendMessageWithAttachments(
          currentFiles,
          currentInput || undefined,
          activeSessionId || undefined,
          modeOptions
        );
      } else {
        response = await sendMessage(currentInput, activeSessionId || undefined, modeOptions);
      }

      // If this created a new session, update state
      if (!activeSessionId && response.sessionId) {
        setActiveSessionId(response.sessionId);
        // Refresh sessions list
        const sessionsData = await projectsApi.getChatSessions(projectId!);
        setSessions(sessionsData);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setMessageInput(currentInput);
      setAttachedFiles(currentFiles);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ============================================
  // Audio
  // ============================================

  const formatAudioDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  const handleAudioSend = async () => {
    const audioFile = getAudioFile();
    if (!audioFile || !projectId) return;

    resetRecording();
    setIsAudioMode(false);

    const optimisticMsg: ProjectMessageResponse = {
      id: `temp-audio-${Date.now()}`,
      sessionId: activeSessionId || '',
      role: 'USER',
      content: 'Voice message',
      attachments: null,
      isStreaming: false,
      isComplete: true,
      hasError: false,
      errorMessage: null,
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const modeOptions = {
      deepThink: deepThinkEnabled || undefined,
      deepResearch: deepResearchEnabled || undefined,
      councilMode: councilModeEnabled || undefined,
    };

    try {
      const response = await sendMessageWithAttachments(
        [audioFile],
        undefined,
        activeSessionId || undefined,
        modeOptions
      );
      if (!activeSessionId && response.sessionId) {
        setActiveSessionId(response.sessionId);
        const sessionsData = await projectsApi.getChatSessions(projectId);
        setSessions(sessionsData);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send voice message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    }
  };

  const handleCancelAudio = () => {
    resetRecording();
    setIsAudioMode(false);
  };

  const toggleAudioPlayback = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlayingAudio(!isPlayingAudio);
  };

  // ============================================
  // Feedback
  // ============================================

  const handleFeedback = async (messageId: string, feedback: 'GOOD' | 'BAD') => {
    const success = await addFeedback(messageId, feedback);
    if (success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
        )
      );
    }
  };

  // ============================================
  // Settings
  // ============================================

  const handleSaveSettings = async () => {
    if (!projectId) return;
    try {
      const updated = await projectsApi.updateProject(projectId, settingsForm);
      setProject(updated);
      setShowSettingsModal(false);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    try {
      await projectsApi.deleteProject(projectId);
      toast.success('Project deleted');
      navigate('/projects');
    } catch {
      toast.error('Failed to delete project');
    }
    setShowDeleteConfirm(false);
  };

  // ============================================
  // Quiz Generation
  // ============================================

  const handleGenerateQuiz = async () => {
    if (!projectId) return;
    if (resources.length === 0 && sessionResources.length === 0) {
      toast.error('Upload study materials before generating a quiz');
      return;
    }

    const quizData = {
      ...quizForm,
      sessionId: quizForm.sessionId || undefined,
    };

    try {
      setIsGeneratingQuiz(true);

      if (quizOutputFormat === 'pdf') {
        const blob = await projectsApi.generateQuizPdf(projectId, quizData);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz-${project?.title || 'project'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowQuizModal(false);
        toast.success('Quiz PDF downloaded');
      } else {
        const response = await projectsApi.generateQuiz(projectId, quizData);
        setShowQuizModal(false);
        setActiveSessionId(response.sessionId);

        // Refresh sessions
        const sessionsData = await projectsApi.getChatSessions(projectId);
        setSessions(sessionsData);

        toast.success('Quiz generation started');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to generate quiz');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // ============================================
  // Drag & Drop
  // ============================================

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleResourceUpload(e.dataTransfer.files);
  };

  // ============================================
  // Loading State
  // ============================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  // Open settings with current values
  const openSettings = () => {
    setSettingsForm({
      title: project.title,
      description: project.description || '',
      aiSystemPrompt: project.aiSystemPrompt || '',
      aiTemperature: project.aiTemperature,
    });
    setShowSettingsModal(true);
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50 bg-[#0f0f0f] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-white font-semibold text-base truncate max-w-xs">
            {project.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle panels on mobile */}
          <button
            onClick={() => setShowResourcePanel(!showResourcePanel)}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
            title="Toggle resources"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            disabled={resources.length === 0 && sessionResources.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 rounded-xl hover:from-amber-500/30 hover:to-orange-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => setShowQuizModal(true)}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">Quiz Me</span>
          </button>
          <button
            onClick={openSettings}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel - Resources */}
        <div
          className={`${
            showResourcePanel ? 'w-64' : 'w-0'
          } hidden lg:flex flex-col border-r border-gray-800/50 bg-[#111] transition-all overflow-hidden flex-shrink-0`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-3 border-b border-gray-800/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Study Materials</span>
              <button
                onClick={() => resourceFileInputRef.current?.click()}
                disabled={isUploadingResource || resources.length >= 20}
                className="p-1.5 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-40"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={resourceFileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
              multiple
              onChange={(e) => handleResourceUpload(e.target.files)}
              className="hidden"
            />
            {isUploadingResource && (
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-violet-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-violet-500/10 border-2 border-dashed border-violet-500/50 rounded-xl m-2">
              <p className="text-violet-400 text-sm font-medium">Drop files here to upload</p>
            </div>
          )}

          {/* Resources List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Project-level resources */}
            <div className="mb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 px-2">Project</span>
            </div>
            {resources.length === 0 ? (
              <div className="text-center py-4 px-3">
                <FileText className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500">No project files</p>
                <button
                  onClick={() => resourceFileInputRef.current?.click()}
                  className="text-[10px] text-violet-400 hover:text-violet-300 mt-1"
                >
                  Upload files
                </button>
              </div>
            ) : (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="group flex items-start gap-2 p-2 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => handlePreviewResource(resource)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {resource.type === 'PDF' ? (
                      <FileText className="w-4 h-4 text-red-400" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate hover:text-violet-300 transition-colors">{resource.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-600">
                        {formatFileSize(resource.fileSize)}
                      </span>
                      {resource.hasExtractedContent ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                          Processed
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                          Unprocessed
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteResource(resource.id); }}
                    className="flex-shrink-0 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            {/* Session-level resources */}
            {activeSessionId && (
              <>
                <div className="mt-3 mb-2 pt-2 border-t border-gray-800/50">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Session</span>
                    <button
                      onClick={() => sessionResourceFileInputRef.current?.click()}
                      disabled={isUploadingSessionResource}
                      className="p-1 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded transition-colors disabled:opacity-40"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    ref={sessionResourceFileInputRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={(e) => handleSessionResourceUpload(e.target.files)}
                    className="hidden"
                  />
                  {isUploadingSessionResource && (
                    <div className="w-full bg-gray-800 rounded-full h-1 mt-1 mx-2">
                      <div className="bg-violet-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                </div>
                {sessionResources.length === 0 ? (
                  <div className="text-center py-3 px-3">
                    <p className="text-[10px] text-gray-500">No session files</p>
                  </div>
                ) : (
                  sessionResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="group flex items-start gap-2 p-2 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
                      onClick={() => handlePreviewSessionResource(resource)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {resource.type === 'PDF' ? (
                          <FileText className="w-4 h-4 text-red-400" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate hover:text-violet-300 transition-colors">{resource.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-600">
                            {formatFileSize(resource.fileSize)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                            Session
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSessionResource(resource.id); }}
                        className="flex-shrink-0 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Middle Panel - Chat Sessions */}
        <div
          className={`${
            showSessionPanel ? 'w-52' : 'w-0'
          } hidden lg:flex flex-col border-r border-gray-800/50 bg-[#111] transition-all overflow-hidden flex-shrink-0`}
        >
          <div className="p-3 border-b border-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Sessions</span>
              <button
                onClick={handleNewSession}
                className="p-1.5 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No sessions yet</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="group relative">
                  <button
                    onClick={() => {
                      if (session.source === 'llm-chat') {
                        navigate(`/chat?session=${session.id}`);
                      } else {
                        setActiveSessionId(session.id);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all ${
                      activeSessionId === session.id
                        ? 'bg-violet-500/10 border border-violet-500/20'
                        : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-gray-300 truncate flex-1">
                        {session.title || 'New Chat'}
                      </p>
                      {session.source === 'llm-chat' && (
                        <span title="From LLM Chat"><MessageSquare className="w-3 h-3 text-amber-400 flex-shrink-0" /></span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-600">
                        {session.messageCount || 0} msgs
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {formatTimeAgo(session.lastMessageAt)}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-gray-800/50">
            <button
              onClick={handleNewSession}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 && !isStreaming && !isWaitingForStream ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Start a conversation
                </h3>
                <p className="text-sm text-gray-400 max-w-md">
                  {resources.length > 0
                    ? 'Ask questions about your uploaded study materials. The AI has context from all your files.'
                    : 'Upload study materials first, then ask questions. The AI will use your files as context.'}
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreamingThis={streamingMessageId === msg.id}
                    streamContent={streamingMessageId === msg.id ? streamingContent : undefined}
                    onFeedback={handleFeedback}
                  />
                ))}

                {/* Council Progress UI */}
                {councilAnalyzing && (
                  <div className="bg-[#1a1a1a] border border-gray-800/50 rounded-xl px-4 py-3 space-y-2">
                    {(councilExperts || []).map((expert) => {
                      const completed = councilMembers.find((m) => m.memberId === expert.id);
                      return (
                        <div key={expert.id} className="flex items-start gap-2">
                          <span className="text-[10px] font-medium text-violet-400 w-16 flex-shrink-0 pt-0.5">{expert.label}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-300">{expert.name}</span>
                              {completed ? (
                                <span className="text-[10px] text-green-400">Done ({completed.confidence}% confident)</span>
                              ) : (
                                <span className="text-[10px] text-yellow-400 animate-pulse">Analyzing...</span>
                              )}
                            </div>
                            {completed && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{completed.content.substring(0, 120)}...</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {isCrossReviewing && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-800/50">
                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                        <span className="text-xs text-gray-400">Experts are reviewing each other's work...</span>
                      </div>
                    )}
                    {isSynthesizing && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-800/50">
                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                        <span className="text-xs text-gray-400">Synthesizing all perspectives...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Streaming AI Message (new, not in messages array yet) */}
                {(isStreaming || isWaitingForStream) &&
                  !messages.find((m) => m.id === streamingMessageId) && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 mt-1">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 bg-[#1a1a1a] border border-gray-800/50 rounded-xl px-4 py-3 max-w-[80%]">
                        {streamingContent ? (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{streamingContent}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs text-gray-500">{streamStatus || 'Thinking...'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Preview */}
          {attachedFiles.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-800/50 flex gap-2 flex-wrap">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded-lg text-xs text-gray-300"
                >
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-gray-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Message Input */}
          <div className="p-4 border-t border-gray-800/50">
            {/* Audio Recording Panel */}
            {isAudioMode && isRecording && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-red-400 font-medium">
                      {isPaused ? 'Paused' : 'Recording...'}
                    </span>
                    <span className="text-sm text-gray-400 font-mono">
                      {formatAudioDuration(duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPaused ? (
                      <button
                        onClick={resumeRecording}
                        className="p-1.5 text-green-400 hover:text-green-300 bg-green-500/10 rounded-lg transition-colors"
                        title="Resume"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={pauseRecording}
                        className="p-1.5 text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={stopRecording}
                      className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors"
                      title="Stop recording"
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelAudio}
                      className="p-1.5 text-gray-400 hover:text-white bg-gray-700/50 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Waveform placeholder */}
                <div className="mt-2 flex items-center gap-0.5 h-6">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full ${isPaused ? 'bg-gray-600' : 'bg-red-400/60'}`}
                      style={{
                        height: `${Math.random() * 20 + 4}px`,
                        transition: 'height 0.3s',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Audio Playback/Review Panel */}
            {isAudioMode && audioUrl && !isRecording && (
              <div className="mb-3 p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="hidden"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleAudioPlayback}
                      className="p-2 bg-violet-500/20 hover:bg-violet-500/30 rounded-full text-violet-400 transition-colors"
                    >
                      {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className="text-sm text-gray-300">
                      Voice message ({formatAudioDuration(duration)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { resetRecording(); startRecording(); }}
                      className="px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-gray-700/50 rounded-lg transition-colors"
                    >
                      Re-record
                    </button>
                    <button
                      onClick={handleCancelAudio}
                      className="p-1.5 text-gray-400 hover:text-white bg-gray-700/50 rounded-lg transition-colors"
                      title="Discard"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleAudioSend}
                      disabled={isStreaming || isWaitingForStream}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mode toggles */}
            <div className="flex items-center gap-1 mb-2">
              <div className="relative">
                <button
                  onClick={handleDeepThinkToggle}
                  disabled={isStreaming || isWaitingForStream}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                    deepThinkEnabled
                      ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
                      : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
                  }`}
                  title="Deep Think - Extended reasoning"
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Think</span>
                </button>
                {deepThinkEnabled && !isStreaming && !isWaitingForStream && (
                  <button onClick={() => setDeepThinkEnabled(false)} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500/30 text-blue-300 hover:bg-blue-500/50 flex items-center justify-center">
                    <X className="w-2 h-2" />
                  </button>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={handleDeepResearchToggle}
                  disabled={isStreaming || isWaitingForStream}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                    deepResearchEnabled
                      ? 'text-green-400 bg-green-500/15 border border-green-500/30'
                      : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10 border border-transparent'
                  }`}
                  title="Deep Research - Web research"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Research</span>
                </button>
                {deepResearchEnabled && !isStreaming && !isWaitingForStream && (
                  <button onClick={() => setDeepResearchEnabled(false)} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500/30 text-green-300 hover:bg-green-500/50 flex items-center justify-center">
                    <X className="w-2 h-2" />
                  </button>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={handleCouncilModeToggle}
                  disabled={isStreaming || isWaitingForStream}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                    councilModeEnabled
                      ? 'text-violet-400 bg-violet-500/15 border border-violet-500/30'
                      : 'text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 border border-transparent'
                  }`}
                  title="Council Mode - Multi-expert analysis"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Council</span>
                </button>
                {councilModeEnabled && !isStreaming && !isWaitingForStream && (
                  <button onClick={() => setCouncilModeEnabled(false)} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500/30 text-violet-300 hover:bg-violet-500/50 flex items-center justify-center">
                    <X className="w-2 h-2" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-end gap-2 bg-[#1a1a1a] border border-gray-700/50 rounded-xl px-3 py-2 focus-within:border-violet-500/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
             
              <textarea
                ref={textareaRef}
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none min-h-[36px] max-h-[120px] py-1.5"
                rows={1}
                disabled={isStreaming || isWaitingForStream || isAudioMode}
              />
             
              <button
                onClick={handleSendMessage}
                disabled={
                  isStreaming ||
                  isWaitingForStream ||
                  isAudioMode ||
                  (!messageInput.trim() && attachedFiles.length === 0)
                }
                className="p-1.5 text-violet-400 hover:text-violet-300 disabled:text-gray-600 transition-colors flex-shrink-0 mb-0.5"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Project Settings"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Project Title</label>
            <input
              type="text"
              value={settingsForm.title || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
              className="input w-full"
              maxLength={200}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={settingsForm.description || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
              className="input w-full resize-none"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="border-t border-gray-700/50 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-gray-300">AI Configuration</span>
            </div>

            <div className="mb-4">
              <label className="label">AI Instructions</label>
              <textarea
                value={settingsForm.aiSystemPrompt || ''}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, aiSystemPrompt: e.target.value })
                }
                placeholder="Tell the AI how you want it to help you..."
                className="input w-full resize-none"
                rows={3}
                maxLength={5000}
              />
            </div>

            <div>
              <label className="label">AI Creativity</label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Focused</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settingsForm.aiTemperature ?? 0.5}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      aiTemperature: parseFloat(e.target.value),
                    })
                  }
                  className="flex-1 accent-violet-500"
                />
                <span className="text-xs text-gray-500">Creative</span>
                <span className="text-xs text-gray-400 w-8 text-right">
                  {settingsForm.aiTemperature ?? 0.5}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
            <button
              onClick={() => {
                setShowSettingsModal(false);
                setShowDeleteConfirm(true);
              }}
              className="btn-danger text-sm"
            >
              Delete Project
            </button>
            <div className="flex gap-3">
              <button onClick={() => setShowSettingsModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveSettings} className="btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quiz Modal */}
      <Modal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        title="Generate Quiz"
      >
        <div className="space-y-5">
          {resources.length === 0 && sessionResources.length === 0 ? (
            <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-300">
                Upload study materials before generating a quiz.
              </p>
            </div>
          ) : (
            <>
              {/* Scope toggle */}
              {activeSessionId && (
                <div>
                  <label className="label">Quiz Scope</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQuizForm({ ...quizForm, sessionId: undefined })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        !quizForm.sessionId
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                      }`}
                    >
                      Entire Project
                    </button>
                    <button
                      onClick={() => setQuizForm({ ...quizForm, sessionId: activeSessionId })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        quizForm.sessionId
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                      }`}
                    >
                      This Session
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {quizForm.sessionId
                      ? 'Quiz based on this session\'s conversation and resources only.'
                      : 'Quiz based on all project materials and conversations.'}
                  </p>
                </div>
              )}

              {/* Question Count */}
              <div>
                <label className="label">Number of Questions</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">1</span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={quizForm.questionCount}
                    onChange={(e) =>
                      setQuizForm({ ...quizForm, questionCount: parseInt(e.target.value) })
                    }
                    className="flex-1 accent-violet-500"
                  />
                  <span className="text-xs text-gray-500">20</span>
                  <span className="text-sm text-white w-6 text-right font-medium">
                    {quizForm.questionCount}
                  </span>
                </div>
              </div>

              {/* Quiz Type */}
              <div>
                <label className="label">Quiz Type</label>
                <div className="space-y-2">
                  {([
                    { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
                    { value: 'SHORT_ANSWER', label: 'Short Answer' },
                    { value: 'TRUE_FALSE', label: 'True / False' },
                    { value: 'MIXED', label: 'Mixed (recommended)' },
                  ] as const).map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white"
                    >
                      <input
                        type="radio"
                        name="quizType"
                        checked={quizForm.quizType === value}
                        onChange={() => setQuizForm({ ...quizForm, quizType: value })}
                        className="accent-violet-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="label">Difficulty</label>
                <div className="flex gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setQuizForm({ ...quizForm, difficulty: level })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        quizForm.difficulty === level
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                          : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                      }`}
                    >
                      {level.charAt(0) + level.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Format */}
              <div>
                <label className="label">Output Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setQuizOutputFormat('chat')}
                    className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      quizOutputFormat !== 'pdf'
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                        : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    In Chat
                  </button>
                  <button
                    onClick={() => setQuizOutputFormat('pdf')}
                    className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      quizOutputFormat === 'pdf'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Quiz will be based on {quizForm.sessionId ? 'this session\'s' : `your ${resources.length} uploaded`} study material{resources.length !== 1 && !quizForm.sessionId ? 's' : ''}.
              </p>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowQuizModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleGenerateQuiz}
              disabled={isGeneratingQuiz || (resources.length === 0 && sessionResources.length === 0)}
              className="btn-primary"
            >
              {isGeneratingQuiz ? 'Generating...' : quizOutputFormat === 'pdf' ? 'Download PDF' : 'Generate Quiz'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="Delete this project? All study materials and conversations will be permanently removed. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* Resource Preview Modal */}
      {previewData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewData(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-[#1a1a1a] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-medium text-white truncate">{previewData.title}</h3>
              <button
                onClick={() => setPreviewData(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
              {previewData.mimeType.startsWith('image/') ? (
                <img
                  src={previewData.url}
                  alt={previewData.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewData.url}
                  title={previewData.title}
                  className="w-full h-[75vh] rounded-lg border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Message Bubble Component
// ============================================

interface MessageBubbleProps {
  message: ProjectMessageResponse;
  isStreamingThis?: boolean;
  streamContent?: string;
  onFeedback: (messageId: string, feedback: 'GOOD' | 'BAD') => void;
}

function MessageBubble({ message, isStreamingThis, streamContent, onFeedback }: MessageBubbleProps) {
  const isUser = message.role === 'USER';
  const displayContent = isStreamingThis && streamContent ? streamContent : message.content;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'ml-auto' : ''}`}>
        <div
          className={`rounded-xl px-4 py-3 ${
            isUser
              ? 'bg-violet-600/20 border border-violet-500/30 text-white'
              : 'bg-[#1a1a1a] border border-gray-800/50 text-gray-200'
          }`}
        >
          {message.hasError ? (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{message.errorMessage || 'Failed to generate response'}</span>
            </div>
          ) : displayContent ? (
            isUser ? (
              <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{displayContent}</ReactMarkdown>
              </div>
            )
          ) : isStreamingThis ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : null}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded text-xs text-gray-400"
                >
                  <Paperclip className="w-3 h-3" />
                  {att.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feedback for AI messages */}
        {!isUser && message.isComplete && !message.hasError && !isStreamingThis && (
          <div className="flex items-center gap-1 mt-1 ml-1">
            <button
              onClick={() => onFeedback(message.id, 'GOOD')}
              className={`p-1 rounded transition-colors ${
                message.feedback === 'GOOD'
                  ? 'text-emerald-400'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onFeedback(message.id, 'BAD')}
              className={`p-1 rounded transition-colors ${
                message.feedback === 'BAD'
                  ? 'text-red-400'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
