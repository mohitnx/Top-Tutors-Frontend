import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { API_BASE_URL } from '../api/client';

export function Landing() {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();

  const redirectUrl = searchParams.get('redirect');

  // If already authenticated, redirect to dashboard or redirect URL
  if (isAuthenticated && user) {
    const defaultPath = user.role === Role.TEACHER ? '/dashboard/teacher' :
                        user.role === Role.TUTOR ? '/dashboard/tutor' :
                        user.role === Role.ADMIN ? '/admin' :
                        user.role === Role.ADMINISTRATOR ? '/admin' : '/chat';
    const targetPath = redirectUrl || defaultPath;
    return <Navigate to={targetPath} replace />;
  }

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex">
      {/* Left Side - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 relative">
        {/* Logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">TopTutors</span>
        </div>

        <div className="max-w-sm mx-auto w-full">
          {/* Tagline */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-serif italic text-[#e8dcc4] leading-tight mb-2">
              Learning?
            </h1>
            <h1 className="text-4xl md:text-5xl font-serif italic text-[#a89880] leading-tight">
              Mastered.
            </h1>
            <p className="mt-4 text-base text-gray-400 font-light">
              AI-powered tutoring that adapts to you
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-[#2a2a2a] rounded-xl p-6 border border-gray-800/50 shadow-xl">
            <button
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 bg-white text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-3 text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            {/* Info */}
            <p className="mt-5 text-center text-gray-500 text-xs">
              Sign in with your Google account to get started.
            </p>
          </div>

          {/* Terms */}
          <p className="mt-4 text-center text-xs text-gray-500">
            By continuing, you acknowledge TopTutors'{' '}
            <Link to="/privacy" className="text-amber-400/70 hover:text-amber-400">Privacy Policy</Link>
          </p>
        </div>
      </div>

      {/* Right Side - Hero Image */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#c4956a]" />

        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-16 left-16 text-3xl font-mono text-white/15">&sum;</div>
          <div className="absolute top-32 right-24 text-2xl font-mono text-white/10">&int;</div>
          <div className="absolute bottom-32 left-24 text-xl font-mono text-white/15">&pi;</div>
          <div className="absolute top-48 left-1/2 text-lg font-mono text-white/10">{'<>'}</div>
          <div className="absolute bottom-48 right-16 text-2xl font-mono text-white/15">&lambda;</div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="relative">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-20 bg-[#8b5a2b] rounded-lg shadow-xl transform rotate-1" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-56 h-16 bg-[#6d4c41] rounded-lg shadow-lg transform -rotate-1" />

            <div className="relative flex justify-center pb-16">
              <div className="w-40 h-56 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-20 bg-[#d4a574] rounded-full shadow" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-18 h-12 bg-[#3d2914] rounded-t-full" style={{ width: '72px' }} />
                <div className="absolute top-16 left-1/2 -translate-x-1/2 w-28 h-36 bg-[#6d9b35] rounded-t-3xl shadow" />
                <div className="absolute top-24 left-0 w-5 h-20 bg-[#5a8830] rounded-full transform -rotate-12" />
                <div className="absolute top-24 right-0 w-5 h-20 bg-[#5a8830] rounded-full transform rotate-12" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-8 right-8 flex justify-between text-white/70 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
              <span className="text-sm">&#127919;</span>
            </div>
            <span className="font-medium">Personalized</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
              <span className="text-sm">&#9889;</span>
            </div>
            <span className="font-medium">Instant Help</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
              <span className="text-sm">&#127942;</span>
            </div>
            <span className="font-medium">Track Progress</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
