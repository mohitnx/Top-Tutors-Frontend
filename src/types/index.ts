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
  isRead: boolean;
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



