// ============================================
// Top Tutors - Type Definitions
// ============================================

// Enums
export enum Role {
  ADMIN = "ADMIN",
  ADMINISTRATOR = "ADMINISTRATOR",
  TEACHER = "TEACHER",
  TUTOR = "TUTOR",
  STUDENT = "STUDENT"
}

export enum Subject {
  MATHEMATICS = "MATHEMATICS",
  PHYSICS = "PHYSICS",
  CHEMISTRY = "CHEMISTRY",
  BIOLOGY = "BIOLOGY",
  ENGLISH = "ENGLISH",
  URDU = "URDU",
  ISLAMIYAT = "ISLAMIYAT",
  PAKISTAN_STUDIES = "PAKISTAN_STUDIES",
  COMPUTER_SCIENCE = "COMPUTER_SCIENCE",
  GENERAL_KNOWLEDGE = "GENERAL_KNOWLEDGE",
  ACCOUNTING = "ACCOUNTING",
  ECONOMICS = "ECONOMICS",
  BUSINESS_STUDIES = "BUSINESS_STUDIES",
  SOCIOLOGY = "SOCIOLOGY",
  PSYCHOLOGY = "PSYCHOLOGY",
  ENVIRONMENTAL_SCIENCE = "ENVIRONMENTAL_SCIENCE",
  GENERAL = "GENERAL"
}

export enum MessageType {
  TEXT = "TEXT",
  AUDIO = "AUDIO",
  IMAGE = "IMAGE",
  FILE = "FILE"
}

export enum SenderType {
  STUDENT = "STUDENT",
  TUTOR = "TUTOR",
  SYSTEM = "SYSTEM"
}

export enum ConversationStatus {
  PENDING = "PENDING",
  ASSIGNED = "ASSIGNED",
  ACTIVE = "ACTIVE",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED"
}

export enum Urgency {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT"
}

// Interfaces
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  schoolId?: string | null;
  avatar?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Student-specific (from profile)
  students?: { id: string; schoolId: string | null } | null;
  studentProfile?: {
    id: string;
    grade?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
    schoolId: string | null;
    school?: { id: string; name: string } | null;
  } | null;
  // Tutor-specific (from profile)
  tutors?: { id: string } | null;
  tutorProfile?: {
    id: string;
    bio?: string | null;
    qualification?: string | null;
    experience?: string | null;
    hourlyRate?: number | null;
    isVerified?: boolean;
    isAvailable?: boolean;
    rating?: number | null;
    subjects?: string[];
  } | null;
  // Administrator-specific (from profile)
  administeredSchool?: {
    id: string;
    name: string;
    code?: string;
  } | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Raw backend response wraps data in ApiResponse
export interface RawAuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

// Legacy profile types for conversations
export interface TutorProfileBasic {
  id: string;
  user: {
    name: string;
    email: string;
  };
}

export interface StudentProfileBasic {
  id: string;
  user: {
    name: string;
    email: string;
  };
}

// Full Student Profile
export interface StudentProfile {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  avatar?: string;
  grade?: string;
  school?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  preferredSubjects?: Subject[];
  learningGoals?: string;
  academicLevel?: string;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  // Gamification stats (computed)
  totalQuestions?: number;
  totalSessions?: number;
  currentStreak?: number;
  longestStreak?: number;
  totalHoursLearned?: number;
}

// Academic Qualification
export interface AcademicQualification {
  institution: string;
  degree: string;
  field: string;
  year?: number;
  gpa?: string;
}

// Certificate
export interface Certificate {
  id?: string;
  name: string;
  issuedBy: string;
  issuedDate?: string;
  expiryDate?: string;
  url?: string;
  verified?: boolean;
}

// Work Experience
export type ExperienceType = 'WORK' | 'RESEARCH' | 'TEACHING' | 'INTERNSHIP' | 'VOLUNTEER';

export interface WorkExperience {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  type?: ExperienceType;
}

// Availability Schedule
export interface DaySchedule {
  start: string;
  end: string;
}

export interface AvailabilitySchedule {
  monday?: DaySchedule[];
  tuesday?: DaySchedule[];
  wednesday?: DaySchedule[];
  thursday?: DaySchedule[];
  friday?: DaySchedule[];
  saturday?: DaySchedule[];
  sunday?: DaySchedule[];
}

// Teaching Style
export type TeachingStyle = 'Interactive' | 'Lecture-based' | 'Project-based' | 'Discussion-based' | 'Hands-on' | 'Mixed';

// Academic Level
export type AcademicLevel = 'Elementary' | 'Middle School' | 'High School' | 'Undergraduate' | 'Graduate' | 'Professional';

// Full Tutor Profile
export interface TutorProfile {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  qualification?: string;
  academicQualifications?: AcademicQualification[];
  experience?: number;
  hourlyRate?: number;
  subjects?: Subject[];
  areasOfExpertise?: string;
  teachingPhilosophy?: string;
  teachingStyle?: TeachingStyle;
  certificates?: Certificate[];
  workExperience?: WorkExperience[];
  researchExperience?: string;
  publications?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  languages?: string[];
  isAvailable: boolean;
  isBusy: boolean;
  availabilitySchedule?: AvailabilitySchedule;
  rating?: number;
  totalReviews: number;
  totalStudentsTaught: number;
  totalSessionsCompleted: number;
  totalHoursTaught: number;
  isVerified: boolean;
  verifiedAt?: string;
  profileCompleted: boolean;
  bankAccountNumber?: string;
  bankName?: string;
  bankRoutingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// Call event types for system messages
export enum CallEvent {
  INITIATED = 'INITIATED',
  ANSWERED = 'ANSWERED',
  REJECTED = 'REJECTED',
  ENDED = 'ENDED',
  MISSED = 'MISSED',
}

// Attachment type for messages
export interface Attachment {
  id?: string;
  url: string;
  name: string;
  type: string; // MIME type: image/png, application/pdf, etc.
  size: number;
}

// Reaction type
export type ReactionType = 'LIKE' | 'DISLIKE';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: SenderType;
  content: string | null;
  messageType: MessageType;
  audioUrl?: string;
  audioDuration?: number;
  transcription?: string;
  attachments?: Attachment[];
  isRead: boolean;
  createdAt: string;
  // Call system message fields
  isSystemMessage?: boolean;
  callEvent?: CallEvent;
  // Reaction fields
  likeCount?: number;
  dislikeCount?: number;
  userReaction?: ReactionType | null;
}

// Call log for history
export interface CallLog {
  id: string;
  conversationId: string;
  callType: CallType;
  status: CallEvent;
  direction: 'OUTGOING' | 'INCOMING';
  duration: number | null;
  endReason: string | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  otherParty: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  createdAt: string;
}

export interface Conversation {
  id: string;
  studentId: string;
  tutorId: string | null;
  subject: Subject;
  topic: string | null;
  keywords: string[];
  urgency: Urgency;
  status: ConversationStatus;
  student?: StudentProfileBasic;
  tutor?: TutorProfileBasic;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
}

export interface ApiError {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
}

// WebSocket Events
export interface TypingEvent {
  conversationId: string;
  isTyping: boolean;
}

export interface UserTypingEvent {
  userId: string;
  isTyping: boolean;
}

export interface NewAssignmentEvent {
  conversationId: string;
  subject: Subject;
  urgency: Urgency;
  studentName: string;
}

export interface StatusChangeEvent {
  conversationId: string;
  status: ConversationStatus;
}

// New pending conversation event - sent to available tutors
export interface NewPendingConversationEvent {
  conversation: Conversation;
  wave?: number; // -1 means view-only (tutor is busy)
}

// Processing status event - for students during question submission
export type ProcessingStatusType = 
  | 'RECEIVING'
  | 'TRANSCRIBING'
  | 'CLASSIFYING'
  | 'CREATING_CONVERSATION'
  | 'NOTIFYING_TUTORS'
  | 'WAITING_FOR_TUTOR'
  | 'TUTOR_ASSIGNED'
  | 'ALL_TUTORS_BUSY';

export interface ProcessingStatusEvent {
  status: ProcessingStatusType;
  message: string;
  progress: number; // 0-100
}

// Tutor assigned event - for students
export interface TutorAssignedEvent {
  conversationId: string;
  tutor: {
    id: string;
    name: string;
    avatar?: string;
  };
}

// All tutors busy event - for students
export interface BusyTutor {
  id: string;
  name: string;
  busyUntil?: string;
  estimatedWait?: number;
}

export interface AllTutorsBusyEvent {
  message: string;
  busyTutors: BusyTutor[];
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface AcceptInvitationForm {
  token: string;
  password: string;
}

export interface InvitationInfo {
  valid: boolean;
  email: string;
  name: string;
  role: string;
}

export interface SendMessageForm {
  content: string;
  messageType: MessageType;
  conversationId?: string;
}

// ============================================
// Audio/Video Call Types
// ============================================

export enum CallType {
  AUDIO = "AUDIO",
  VIDEO = "VIDEO"
}

export enum CallStatus {
  IDLE = "IDLE",
  INITIATING = "INITIATING",
  RINGING = "RINGING",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  ENDED = "ENDED",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
  BUSY = "BUSY",
  NO_ANSWER = "NO_ANSWER"
}

export interface CallParticipant {
  id: string;
  name: string;
  isMuted: boolean;
  isDeafened: boolean;
}

export interface CallState {
  status: CallStatus;
  conversationId: string | null;
  callType: CallType | null;
  callerId: string | null;
  callerName: string | null;
  participants: CallParticipant[];
  startTime: Date | null;
  isMuted: boolean;
  isDeafened: boolean;
}

// WebSocket Call Events
export interface CallInitiateEvent {
  conversationId: string;
  callType: CallType;
}

export interface IncomingCallEvent {
  conversationId: string;
  callerId: string;
  callerName: string;
  callType: CallType;
}

export interface CallAcceptedEvent {
  conversationId: string;
  accepterId: string;
  accepterName: string;
}

export interface CallRejectedEvent {
  conversationId: string;
  rejecterId: string;
  reason?: string;
}

export interface CallEndedEvent {
  conversationId: string;
  endedBy: string;
  reason?: "ended" | "rejected" | "no_answer" | "failed";
  duration?: number;
}

export interface WebRTCOfferEvent {
  conversationId: string;
  offer: RTCSessionDescriptionInit;
  fromUserId: string;
}

export interface WebRTCAnswerEvent {
  conversationId: string;
  answer: RTCSessionDescriptionInit;
  fromUserId: string;
}

export interface WebRTCIceCandidateEvent {
  conversationId: string;
  candidate: RTCIceCandidateInit;
  fromUserId: string;
}

export interface InviteToCallEvent {
  conversationId: string;
  tutorId: string;
}

export interface ParticipantJoinedEvent {
  conversationId: string;
  participant: CallParticipant;
}

export interface ParticipantLeftEvent {
  conversationId: string;
  participantId: string;
}

export interface ParticipantMutedEvent {
  conversationId: string;
  participantId: string;
  isMuted: boolean;
}

// ============================================
// Waiting Queue System Types
// ============================================

// Waiting student notification - sent to busy tutors when student waits 2+ minutes
export interface WaitingStudentNotification {
  type: 'WAITING_STUDENT';
  conversation: {
    id: string;
    subject: string;
    topic: string;
    urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    status: 'PENDING';
    createdAt: string;
    student: {
      id: string;
      name: string;
      avatar?: string;
    };
    lastMessage?: string;
  };
  waitingQueue: {
    id: string;
    waitingSince: string;
    waitingMinutes: number;
  };
  requiresAvailabilityResponse: boolean;
}

// Tutor availability response types
export type AvailabilityResponseType = 'MINUTES_5' | 'MINUTES_10' | 'NOT_ANYTIME_SOON' | 'CUSTOM';

export interface RespondAvailabilityRequest {
  conversationId: string;
  responseType: AvailabilityResponseType;
  customMinutes?: number;
}

export interface RespondAvailabilityResponse {
  success: boolean;
  freeAt?: string;
  minutesUntilFree?: number;
  message?: string;
  error?: string;
}

// Availability reminder - when tutor's stated time arrives
export interface AvailabilityReminder {
  type: 'AVAILABILITY_REMINDER';
  conversationId: string;
  waitingQueueId: string;
  message: string;
  conversation: {
    id: string;
    subject: string;
    topic: string;
    student: {
      id: string;
      name: string;
      avatar?: string;
    };
  };
  canAcceptNow: boolean;
}

// Session taken - when another tutor takes the session
export interface SessionTakenEvent {
  conversationId: string;
  message: string;
}

// Conversation taken - broadcast to all tutors of that subject
export interface ConversationTakenEvent {
  conversationId: string;
}

// Tutor availability update - sent to waiting student
export interface TutorAvailabilityUpdate {
  shortestWaitMinutes: number;
  message: string;
  tutorResponses: Array<{
    tutorName: string;
    minutesUntilFree: number;
  }>;
}

// Tutor accepted - when a tutor accepts the conversation
export interface TutorAcceptedEvent {
  conversationId: string;
  tutorId: string;
  tutorName: string;
}

// Waiting queue status request
export interface GetWaitingQueueStatusRequest {
  conversationId: string;
}

// Waiting queue status response
export interface WaitingQueueStatusResponse {
  inQueue: boolean;
  status?: 'WAITING' | 'TUTORS_NOTIFIED' | 'AVAILABILITY_COLLECTED' | 'MATCHED';
  waitStartedAt?: string;
  shortestWaitMinutes?: number;
  tutorResponses?: Array<{
    tutorId: string;
    tutorName: string;
    responseType: string;
    freeAt: string;
    minutesUntilFree: number;
  }>;
  error?: string;
}

// ============================================
// Session Cancel/Close Types (Student Side)
// ============================================

// Reason types for cancelling a waiting session
export type SessionCancelReason = 
  | 'TUTOR_NOT_UP_TO_MARK'
  | 'NO_TUTOR_ASSIGNED'
  | 'OTHER';

// Cancel waiting session request
export interface CancelWaitingSessionRequest {
  conversationId: string;
  reason?: SessionCancelReason;
  reasonDetails?: string; // For 'OTHER' reason - optional text
}

// Cancel waiting session response
export interface CancelWaitingSessionResponse {
  success: boolean;
  message: string;
  conversationId: string;
  status: 'CANCELLED' | 'CLOSED';
}

// ============================================
// Session Close/Resolve Types
// ============================================

// Close conversation request (socket emit)
export interface CloseConversationRequest {
  conversationId: string;
  status: 'RESOLVED' | 'CLOSED';
}

// Close conversation response (socket callback)
export interface CloseConversationSocketResponse {
  success: boolean;
  status?: 'RESOLVED' | 'CLOSED';
  error?: string;
}

// Conversation closed event - sent to BOTH parties
export interface ConversationClosedEvent {
  conversationId: string;
  status: 'RESOLVED' | 'CLOSED';
  closedBy: {
    id: string;
    role: 'STUDENT' | 'TUTOR';
    name?: string;
  };
  conversation: {
    id: string;
    subject: string;
    topic: string;
    status: string;
  };
  closedAt: string; // ISO timestamp
}

// ============================================
// AI Chat (Gemini) Types
// ============================================

// AI Chat Mode
export type AIChatMode = 'SINGLE' | 'COUNCIL';

// AI Chat Session
export interface AIChatSession {
  id: string;
  title: string | null;
  summary: string | null;
  subject: Subject | null;
  mode: AIChatMode;
  isPinned: boolean;
  isArchived: boolean;
  lastMessageAt: string;
  createdAt: string;
  tutorRequestStatus: TutorRequestStatus | null;
  linkedConversationId: string | null;
  messageCount?: number;
  lastMessage?: {
    content: string;
    role: 'USER' | 'ASSISTANT';
    createdAt: string;
  };
}

// Tutor Request Status
export type TutorRequestStatus =
  | 'NONE'
  | 'REQUESTED'
  | 'MATCHED'
  | 'TUTOR_CONNECTED'
  | 'CANCELLED';

// Council Member Response
export interface CouncilMemberResponse {
  memberId: 'conceptual' | 'practical' | 'clarity';
  memberName: string;
  memberLabel: string;
  content: string;
}

// AI Message
export interface AIMessage {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT';
  content: string | null;
  attachments: AIAttachment[] | null;
  audioUrl: string | null;
  transcription: string | null;
  isStreaming: boolean;
  isComplete: boolean;
  hasError: boolean;
  errorMessage: string | null;
  feedback: 'GOOD' | 'BAD' | null;
  councilResponses: CouncilMemberResponse[] | null;
  createdAt: string;
}

// AI Attachment
export interface AIAttachment {
  url: string;
  name: string;
  type: 'image' | 'document' | string;
  size: number;
  mimeType?: string;
}

// Stream Chunk Types
export type StreamChunkType = 'start' | 'chunk' | 'heartbeat' | 'end' | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  messageId: string;
  sessionId: string;
  content?: string;
  fullContent?: string;
  message?: string;
  waitingMs?: number;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// Council Mode Events
export interface CouncilStatusEvent {
  type: 'councilAnalysisStart';
  sessionId: string;
  messageId: string;
  experts: Array<{
    id: 'conceptual' | 'practical' | 'clarity';
    name: string;
    label: string;
    status: 'analyzing' | 'done';
  }>;
}

export interface CouncilMemberCompleteEvent {
  memberId: 'conceptual' | 'practical' | 'clarity';
  memberName: string;
  memberLabel: string;
  content: string;
  index: number;
  total: number;
}

export interface CouncilSynthesisStartEvent {
  sessionId: string;
  messageId: string;
}

// Tutor Request
export interface TutorRequestResponse {
  success: boolean;
  status: TutorRequestStatus;
  linkedConversationId?: string;
}

export interface TutorStatusResponse {
  status: TutorRequestStatus;
  tutorInfo?: {
    id: string;
    name: string;
    avatar?: string;
  };
  conversationId?: string;
  estimatedWait?: string;
}

// Tutor Status Update Events
export interface TutorStatusUpdateEvent {
  sessionId: string;
  status: TutorRequestStatus;
  message: string;
}

export interface TutorConnectedEvent {
  sessionId: string;
  tutorInfo: {
    id: string;
    name: string;
    avatar?: string;
  };
  conversationId: string;
  message: string;
}

export interface TutorWaitUpdateEvent {
  sessionId: string;
  estimatedWait: string;
  message: string;
}

// AI Chat Urgency
export type AIUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

// ============================================
// Tutor Session Types (Live Collaboration)
// ============================================

// Session Status
export type TutorSessionStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

// Daily.co Room
export interface DailyRoom {
  url: string;
  token: string;
}

// Pending Help Request (Tutor sees)
export interface PendingHelpRequest {
  id: string;
  topic: string;
  subject: Subject;
  summary: string;
  messageCount: number;
  student: {
    id: string;
    name: string;
    avatar?: string;
  };
  urgency: AIUrgency;
  keywords?: string[];
  createdAt: string;
}

// Tutor Session Summary
export interface TutorSessionSummary {
  sessionId: string;
  aiSessionId: string;
  summary: string;
  topic: string;
  subject: Subject;
  keywords: string[];
  messageCount: number;
  student: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  liveSharingEnabled: boolean;
}

// Tutor Session (Full)
export interface TutorSession {
  id: string;
  aiSessionId: string;
  status: TutorSessionStatus;
  topic: string;
  subject: Subject;
  summary: string;
  keywords: string[];
  messageCount: number;
  liveSharingEnabled: boolean;
  dailyRoomUrl?: string;
  whiteboardRoomId?: string;
  student: {
    id: string;
    name: string;
    avatar?: string;
  };
  tutor?: {
    id: string;
    name: string;
    avatar?: string;
  };
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  createdAt: string;
}

// Accept Session Response
export interface AcceptSessionResponse {
  session: TutorSession;
  summary: TutorSessionSummary;
  chatHistory: TutorSessionChatMessage[];
  dailyRoom?: DailyRoom; // Optional - may not be available immediately
}

// Tutor Session Chat Message (from AI conversation)
export interface TutorSessionChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  attachments?: AIAttachment[];
  createdAt: string;
}

// Chat History Response
export interface ChatHistoryResponse {
  messages: TutorSessionChatMessage[];
  liveSharingEnabled: boolean;
  lastUpdated: string;
}

// Consent Status Response
export interface ConsentStatusResponse {
  liveSharingEnabled: boolean;
  tutorConnected: boolean;
  tutorName?: string;
}

// Whiteboard Data
export interface WhiteboardData {
  elements: unknown[];
  appState?: unknown;
}

// ============================================
// Tutor Session WebSocket Events
// ============================================

// Tutor Accepted Event (Student receives)
export interface TutorSessionAcceptedEvent {
  tutorSessionId: string;
  tutor: {
    id: string;
    name: string;
    avatar?: string;
  };
  dailyRoomUrl: string;
}

// New AI Message Event (Tutor receives if live sharing)
export interface NewAIMessageEvent {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

// Consent Changed Event
export interface ConsentChangedEvent {
  sessionId: string;
  liveSharingEnabled: boolean;
}

// Session Status Changed Event
export interface SessionStatusChangedEvent {
  sessionId: string;
  status: TutorSessionStatus;
}

// Participant Event
export interface TutorSessionParticipantEvent {
  sessionId: string;
  userId: string;
  role: 'student' | 'tutor';
  name?: string;
}

// Chat Message Event (Tutor-Student Chat)
export interface TutorStudentChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  role: 'student' | 'tutor';
  createdAt: string;
}

// Whiteboard Update Event
export interface WhiteboardUpdateEvent {
  sessionId: string;
  elements: unknown[];
  appState?: unknown;
  senderId: string;
}

// Whiteboard Cursor Event
export interface WhiteboardCursorEvent {
  sessionId: string;
  userId: string;
  x: number;
  y: number;
}

// User Typing Event (Tutor Session)
export interface TutorSessionTypingEvent {
  sessionId: string;
  userId: string;
  role: 'student' | 'tutor';
  isTyping: boolean;
}

// Call Signal Event
export type CallSignalType = 'mute' | 'unmute' | 'videoOn' | 'videoOff' | 'screenShare' | 'stopScreenShare';

export interface TutorSessionCallSignal {
  sessionId: string;
  userId: string;
  signal: CallSignalType;
}

// New Help Request Event (Tutor notification)
export interface NewHelpRequestEvent {
  tutorSessionId: string;
  topic: string;
  subject: Subject;
  summary: string;
  studentName: string;
  messageCount: number;
  urgency: AIUrgency;
}

// ============================================
// Daily Learning Package Types
// ============================================

// Teacher Profile
export interface Teacher {
  id: string;
  userId: string;
  schoolId: string;
  users: {
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
  };
  school?: {
    id: string;
    name: string;
  };
  teacher_sections?: TeacherSection[];
  createdAt: string;
  updatedAt?: string;
}

// Teacher-Section assignment (many-to-many with subject)
export interface TeacherSection {
  teacherId: string;
  sectionId: string;
  subject: string;
  teachers?: Teacher;
  class_sections?: ClassSection;
}

// Student-Section assignment
export interface StudentSection {
  studentId: string;
  sectionId: string;
  students: {
    id: string;
    userId: string;
    schoolId: string;
    users: { name: string | null; email: string };
  };
}

// Class Section
export interface ClassSection {
  id: string;
  name: string;
  schoolId: string;
  grade: string | null;
  school?: { id: string; name: string };
  teacher_sections?: TeacherSection[];
  student_sections?: StudentSection[];
  _count?: { student_sections: number; teacher_sections: number };
  createdAt: string;
  updatedAt: string;
}

// Create Section
export interface CreateSectionData {
  name: string;
  grade?: string;
  schoolId?: string; // Required for ADMIN, auto-filled for ADMINISTRATOR
}

export interface UpdateSectionData {
  name?: string;
  grade?: string;
}

// Daily Package Upload (teacher/administrator view)
export interface DailyPackageUpload {
  id: string;
  sectionId: string;
  teacherId: string;
  subject: string;
  status: DailyPackageStatus;
  errorMsg: string | null;
  class_sections?: { id: string; name: string; grade: string | null };
  daily_packages?: DailyPackageItem[];
  uploadedByUser?: { id: string; name: string | null; role: string };
  _count?: { upload_images: number; extracted_questions: number };
  createdAt: string;
  updatedAt: string;
}

// Individual daily_package record within an upload
export interface DailyPackageItem {
  id: string;
  packageDate: string;
  pdfUrl: string | null;
  audioUrl: string | null;
  summaryText: string | null;
  quizJson: QuizQuestion[] | null;
  status: DailyPackageStatus;
}

export type DailyPackageStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Upload detail (includes extracted questions and images)
export interface DailyPackageUploadDetail extends DailyPackageUpload {
  upload_images: UploadImage[];
  extracted_questions: ExtractedQuestion[];
}

export interface UploadImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ExtractedQuestion {
  id: string;
  questionText: string;
  frequency: number;
  rankType: 'MOST_ASKED' | 'BEST_ASKED' | null;
  rankPosition: number | null;
  shortAnswer: string | null;
}

// Quiz Question
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

// Student Package (daily)
export interface StudentDailyPackage {
  id: string;
  sectionId: string;
  subject: string;
  packageDate: string;
  status: DailyPackageStatus;
  pdfUrl: string | null;
  audioUrl: string | null;
  summaryText: string | null;
  quizJson: QuizQuestion[] | null;
  class_sections: { id: string; name: string; grade: string | null };
  teachers: {
    users: { name: string | null };
  };
}

// Student Package (weekly) - flat array
export interface StudentWeeklyPackage {
  weekStart: string;
  weekEnd: string;
  packages: StudentDailyPackage[];
}

// ============================================
// Student Projects Types
// ============================================

export interface ProjectResponse {
  id: string;
  title: string;
  description: string | null;
  aiSystemPrompt: string | null;
  aiTemperature: number;
  isArchived: boolean;
  resourceCount?: number;
  chatSessionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectResourceResponse {
  id: string;
  projectId: string;
  type: 'PDF' | 'IMAGE';
  title: string;
  url: string | null;
  fileSize: number | null;
  mimeType: string | null;
  hasExtractedContent: boolean;
  createdAt: string;
}

export interface ProjectChatSessionResponse {
  id: string;
  projectId: string;
  title: string | null;
  lastMessageAt: string;
  createdAt: string;
  messageCount?: number;
  lastMessage?: {
    content: string | null;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    createdAt: string;
  };
}

export interface ProjectMessageResponse {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string | null;
  attachments: AIAttachment[] | null;
  isStreaming: boolean;
  isComplete: boolean;
  hasError: boolean;
  errorMessage: string | null;
  feedback: 'GOOD' | 'BAD' | null;
  createdAt: string;
}

export interface ProjectStreamChunk {
  type: 'start' | 'chunk' | 'heartbeat' | 'end' | 'error';
  messageId: string;
  sessionId: string;
  projectId: string;
  content?: string;
  fullContent?: string;
  message?: string;
  waitingMs?: number;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  aiSystemPrompt?: string;
  aiTemperature?: number;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  aiSystemPrompt?: string;
  aiTemperature?: number;
  isArchived?: boolean;
}

export interface SendProjectMessageRequest {
  content?: string;
  sessionId?: string;
}

export interface GenerateQuizRequest {
  questionCount?: number;
  quizType?: 'MCQ' | 'SHORT_ANSWER' | 'TRUE_FALSE' | 'MIXED';
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

