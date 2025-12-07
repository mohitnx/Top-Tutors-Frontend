import { Subject, ConversationStatus, Urgency } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-primary-600 text-white',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-sky-100 text-sky-800',
  };

  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Subject-specific colors
const subjectColors: Record<Subject, string> = {
  [Subject.MATHEMATICS]: 'bg-teal-500 text-white',
  [Subject.PHYSICS]: 'bg-violet-500 text-white',
  [Subject.CHEMISTRY]: 'bg-rose-500 text-white',
  [Subject.BIOLOGY]: 'bg-green-500 text-white',
  [Subject.ENGLISH]: 'bg-orange-500 text-white',
  [Subject.HISTORY]: 'bg-amber-600 text-white',
  [Subject.GEOGRAPHY]: 'bg-yellow-500 text-white',
  [Subject.COMPUTER_SCIENCE]: 'bg-blue-500 text-white',
  [Subject.ECONOMICS]: 'bg-slate-500 text-white',
  [Subject.ACCOUNTING]: 'bg-gray-500 text-white',
  [Subject.GENERAL]: 'bg-gray-400 text-white',
};

const subjectLabels: Record<Subject, string> = {
  [Subject.MATHEMATICS]: 'Math',
  [Subject.PHYSICS]: 'Physics',
  [Subject.CHEMISTRY]: 'Chemistry',
  [Subject.BIOLOGY]: 'Biology',
  [Subject.ENGLISH]: 'English',
  [Subject.HISTORY]: 'History',
  [Subject.GEOGRAPHY]: 'Geography',
  [Subject.COMPUTER_SCIENCE]: 'CS',
  [Subject.ECONOMICS]: 'Economics',
  [Subject.ACCOUNTING]: 'Accounting',
  [Subject.GENERAL]: 'General',
};

export function SubjectBadge({ subject, className = '' }: { subject: Subject; className?: string }) {
  return (
    <span className={`badge ${subjectColors[subject]} ${className}`}>
      {subjectLabels[subject]}
    </span>
  );
}

// Status colors
const statusColors: Record<ConversationStatus, string> = {
  [ConversationStatus.PENDING]: 'bg-amber-100 text-amber-800',
  [ConversationStatus.ASSIGNED]: 'bg-sky-100 text-sky-800',
  [ConversationStatus.ACTIVE]: 'bg-emerald-100 text-emerald-800',
  [ConversationStatus.RESOLVED]: 'bg-gray-100 text-gray-600',
  [ConversationStatus.CLOSED]: 'bg-gray-200 text-gray-500',
};

const statusLabels: Record<ConversationStatus, string> = {
  [ConversationStatus.PENDING]: 'Pending',
  [ConversationStatus.ASSIGNED]: 'Assigned',
  [ConversationStatus.ACTIVE]: 'Active',
  [ConversationStatus.RESOLVED]: 'Resolved',
  [ConversationStatus.CLOSED]: 'Closed',
};

export function StatusBadge({ status, className = '' }: { status: ConversationStatus; className?: string }) {
  return (
    <span className={`badge ${statusColors[status]} ${className}`}>
      {statusLabels[status]}
    </span>
  );
}

// Urgency indicator
const urgencyColors: Record<Urgency, string> = {
  [Urgency.LOW]: 'bg-gray-100 text-gray-600',
  [Urgency.NORMAL]: 'bg-primary-100 text-primary-700',
  [Urgency.HIGH]: 'bg-orange-100 text-orange-700',
  [Urgency.URGENT]: 'bg-red-100 text-red-700',
};

const urgencyLabels: Record<Urgency, string> = {
  [Urgency.LOW]: 'Low',
  [Urgency.NORMAL]: 'Normal',
  [Urgency.HIGH]: 'High',
  [Urgency.URGENT]: 'Urgent',
};

export function UrgencyBadge({ urgency, className = '' }: { urgency: Urgency; className?: string }) {
  return (
    <span className={`badge ${urgencyColors[urgency]} ${className}`}>
      {urgencyLabels[urgency]}
    </span>
  );
}

export default Badge;
