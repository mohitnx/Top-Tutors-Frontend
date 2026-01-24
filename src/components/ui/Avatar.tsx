interface AvatarProps {
  name: string | null;
  src?: string; // Optional image source
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string | null): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  
  if (!name) return colors[0];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const avatarClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`;

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`${avatarClasses} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${avatarClasses} ${getColorFromName(name)}`}
      title={name || 'Unknown'}
    >
      {getInitials(name)}
    </div>
  );
}

export default Avatar;





