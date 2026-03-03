import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2 
      className={`animate-spin text-violet-400 ${sizeClasses[size]} ${className}`} 
    />
  );
}

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-violet-500/20">
          <Spinner size="md" className="text-white" />
        </div>
        <p className="text-sm text-gray-300">{message}</p>
        <p className="text-xs text-gray-500 mt-1">This usually takes a moment after a refresh.</p>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="text-center">
        <Spinner size="md" className="mx-auto mb-2" />
        {message && <p className="text-sm text-gray-200">{message}</p>}
      </div>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="p-4 border-b border-gray-200 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    </div>
  );
}

export function MessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[70%] ${isOwn ? 'bg-gray-100' : 'bg-gray-200'} rounded p-3 animate-pulse`}>
        <div className="h-3 bg-gray-300 rounded w-32 mb-1"></div>
        <div className="h-3 bg-gray-300 rounded w-48"></div>
      </div>
    </div>
  );
}

export default Spinner;
