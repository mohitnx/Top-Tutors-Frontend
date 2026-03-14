import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export function GoogleCallback() {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      loginWithTokens(accessToken, refreshToken)
        .then(() => {
          toast.success('Welcome!');
          navigate('/', { replace: true });
        })
        .catch(() => {
          setError('Failed to complete sign in. Please try again.');
        });
    } else {
      setError('Invalid callback. Missing authentication tokens.');
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-white text-lg mb-2">Sign in failed</p>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-all text-sm"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default GoogleCallback;
