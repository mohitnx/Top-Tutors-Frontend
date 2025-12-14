import { Navigate } from 'react-router-dom';

// Login is now handled by the Landing page
// This component just redirects to landing
export function Login() {
  return <Navigate to="/" replace />;
}

export default Login;
