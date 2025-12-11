// ============================================
// Top Tutors - Type Definitions
// ============================================

// Enums
export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
  TUTOR = "TUTOR",
  STUDENT = "STUDENT"
}

export enum Subject {
  MATHEMATICS = "MATHEMATICS",
  PHYSICS = "PHYSICS",
  CHEMISTRY = "CHEMISTRY",
  BIOLOGY = "BIOLOGY",
  ENGLISH = "ENGLISH",
  HISTORY = "HISTORY",
  GEOGRAPHY = "GEOGRAPHY",
  COMPUTER_SCIENCE = "COMPUTER_SCIENCE",
  ECONOMICS = "ECONOMICS",
  ACCOUNTING = "ACCOUNTING",
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface TutorProfile {
  id: string;
  user: {
    name: string;
    email: string;
  };
}

export interface StudentProfile {
  id: string;
  user: {
    name: string;
    email: string;
  };
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
  student?: StudentProfile;
  tutor?: TutorProfile;
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

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
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



