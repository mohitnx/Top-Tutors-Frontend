import { ReactNode } from 'react';
import { Inbox, MessageSquare, Users, FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

export function NoConversations({ action }: { action?: ReactNode }) {
  return (
    <EmptyState
      icon={<MessageSquare className="w-6 h-6" />}
      title="No conversations yet"
      description="Start a conversation by asking a question to get help from our tutors."
      action={action}
    />
  );
}

export function NoMessages() {
  return (
    <EmptyState
      icon={<Inbox className="w-6 h-6" />}
      title="No messages"
      description="This conversation doesn't have any messages yet."
    />
  );
}

export function NoUsers() {
  return (
    <EmptyState
      icon={<Users className="w-6 h-6" />}
      title="No users found"
      description="There are no users matching your criteria."
    />
  );
}

export function NoResults() {
  return (
    <EmptyState
      icon={<FileQuestion className="w-6 h-6" />}
      title="No results"
      description="We couldn't find what you're looking for. Try adjusting your search."
    />
  );
}

export default EmptyState;

