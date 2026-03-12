import { Navigate } from 'react-router-dom';

// OAuth callback is no longer used. Redirect to login.
export function AuthCallback() {
  return <Navigate to="/" replace />;
}

export default AuthCallback;
