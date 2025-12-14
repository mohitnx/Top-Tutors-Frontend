import { Navigate } from 'react-router-dom';

// Registration is now handled by the Landing page
// This component just redirects to landing
export function Register() {
  return <Navigate to="/" replace />;
}

export default Register;
