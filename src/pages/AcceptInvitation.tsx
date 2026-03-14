import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api';
import { InvitationInfo, Role } from '../types';
import toast from 'react-hot-toast';

export function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { isAuthenticated, user, acceptInvitation, isLoading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verify invitation token on mount
  useEffect(() => {
    if (!token) {
      setVerifyError('No invitation token provided');
      setIsVerifying(false);
      return;
    }

    authApi.verifyInvitation(token)
      .then((info) => {
        setInvitation(info);
      })
      .catch((error) => {
        const err = error as { response?: { status?: number; data?: { message?: string } } };
        if (err.response?.status === 404) {
          setVerifyError('This invitation link is invalid or has already been used.');
        } else if (err.response?.status === 400) {
          setVerifyError('This invitation link has expired. Please contact your administrator for a new one.');
        } else {
          setVerifyError('Failed to verify invitation. Please try again.');
        }
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password)) {
      toast.error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return;
    }

    if (!token) return;

    setIsSubmitting(true);
    try {
      await acceptInvitation(token, password);
      // Auth context will redirect via the Navigate check above on re-render
    } catch {
      // Error handled in auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already authenticated, redirect to dashboard
  if (isAuthenticated && user) {
    const defaultPath = user.role === Role.TEACHER ? '/dashboard/teacher' :
                        user.role === Role.TUTOR ? '/dashboard/tutor' :
                        user.role === Role.ADMIN ? '/admin' :
                        user.role === Role.ADMINISTRATOR ? '/admin' : '/chat';
    return <Navigate to={defaultPath} replace />;
  }

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-gray-400">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (verifyError) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Invalid Invitation</h2>
          <p className="text-gray-400 text-sm mb-6">{verifyError}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-all text-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">TopTutors</span>
        </div>

        {/* Success badge */}
        <div className="flex items-center gap-2 justify-center mb-6">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 text-sm font-medium">Invitation verified</span>
        </div>

        {/* Card */}
        <div className="bg-[#2a2a2a] rounded-xl p-6 border border-gray-800/50 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-1">Set Your Password</h2>
          <p className="text-gray-400 text-sm mb-5">
            Welcome, <span className="text-white font-medium">{invitation?.name}</span>!
            Set a password to activate your account.
          </p>

          {/* Pre-filled info */}
          <div className="space-y-2 mb-5">
            <div className="px-3.5 py-2.5 bg-[#1c1c1c] border border-gray-700/50 rounded-lg">
              <span className="text-xs text-gray-500">Email</span>
              <p className="text-sm text-gray-300">{invitation?.email}</p>
            </div>
            <div className="px-3.5 py-2.5 bg-[#1c1c1c] border border-gray-700/50 rounded-lg">
              <span className="text-xs text-gray-500">Role</span>
              <p className="text-sm text-gray-300 capitalize">{invitation?.role?.toLowerCase()}</p>
            </div>
          </div>

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
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

            <div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3.5 py-2.5 bg-[#1c1c1c] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all"
                required
                minLength={8}
              />
            </div>

            <p className="text-xs text-gray-500">
              Min 8 characters with uppercase, lowercase, number, and special character (!@#$%^&amp;* etc.)
            </p>

            <button
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting || authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Activate Account
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AcceptInvitation;
