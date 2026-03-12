import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export function Landing() {
  const { isAuthenticated, user, login, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();

  const redirectUrl = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard or redirect URL
  if (isAuthenticated && user) {
    const defaultPath = user.role === Role.TEACHER ? '/dashboard/teacher' :
                        user.role === Role.TUTOR ? '/dashboard/tutor' :
                        user.role === Role.ADMIN ? '/admin' :
                        user.role === Role.ADMINISTRATOR ? '/admin' : '/dashboard/student';
    const targetPath = redirectUrl || defaultPath;
    return <Navigate to={targetPath} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
    } catch {
      // Error handled in auth context
    } finally {
      setIsSubmitting(false);
    }
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
            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3.5 py-2.5 bg-[#1c1c1c] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all"
                  required
                />
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2.5 bg-[#1c1c1c] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="w-full py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting || authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Info */}
            <p className="mt-5 text-center text-gray-500 text-xs">
              Accounts are created by your administrator.
              Check your email for an invitation link.
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
