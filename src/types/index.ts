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



