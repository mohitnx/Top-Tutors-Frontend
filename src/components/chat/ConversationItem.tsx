import { Link } from 'react-router-dom';
import { Conversation, Role } from '../../types';
import { SubjectBadge, StatusBadge, UrgencyBadge } from '../ui/Badge';
import Avatar from '../ui/Avatar';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserRole: Role;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function getLastMessagePreview(conversation: Conversation): string {
  if (!conversation.messages || conversation.messages.length === 0) {
    return 'No messages yet';
  }
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return lastMessage.content || '';
}

export function ConversationItem({ conversation, currentUserRole }: ConversationItemProps) {
  const otherParty = currentUserRole === Role.STUDENT 
    ? conversation.tutor?.user 
    : conversation.student?.user;

  const otherName = otherParty?.name || 'Unknown';
  const lastMessage = getLastMessagePreview(conversation);
  const lastMessageDate = conversation.messages?.[conversation.messages.length - 1]?.createdAt || conversation.updatedAt;
  
  // Check if there are unread messages
  const hasUnread = conversation.messages?.some(
    m => !m.isRead && m.senderType !== (currentUserRole === Role.STUDENT ? 'STUDENT' : 'TUTOR')
  );

  return (
    <Link
      to={`/conversations/${conversation.id}`}
      className="block p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar name={otherName} size="md" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-sm truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
              {otherName}
            </h3>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatDate(lastMessageDate)}
            </span>
          </div>
          
          <p className={`text-sm truncate mb-2 ${hasUnread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
            {lastMessage}
          </p>
          
          <div className="flex items-center gap-2 flex-wrap">
            <SubjectBadge subject={conversation.subject} />
            <StatusBadge status={conversation.status} />
            {conversation.urgency !== 'NORMAL' && (
              <UrgencyBadge urgency={conversation.urgency} />
            )}
          </div>
          
          {conversation.topic && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {conversation.topic}
            </p>
          )}
        </div>

        {hasUnread && (
          <span className="w-2.5 h-2.5 bg-primary-600 rounded-full flex-shrink-0 mt-1" />
        )}
      </div>
    </Link>
  );
}

export default ConversationItem;
