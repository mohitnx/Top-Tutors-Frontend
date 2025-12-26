import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from '../components/ui/Loading';
import { Role } from '../types';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthFromCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    if (!accessToken || !refreshToken) {
      setError('Missing authentication tokens');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    const authenticate = async () => {
      try {
        await setAuthFromCallback(accessToken, refreshToken);
        // Get user role and redirect accordingly
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          switch (userData.role) {
            case Role.ADMIN:
              navigate('/admin', { replace: true });
              break;
            case Role.TUTOR:
              navigate('/dashboard/tutor', { replace: true });
              break;
            default:
              navigate('/dashboard/student', { replace: true });
          }
        } else {
          navigate('/dashboard/student', { replace: true });
        }
      } catch {
        setError('Authentication failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    authenticate();
  }, [searchParams, setAuthFromCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded mb-4">
            {error}
          </div>
          <p className="text-gray-500 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <LoadingScreen message="Completing sign in..." />;
}

export default AuthCallback;






