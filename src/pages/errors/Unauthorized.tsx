import { Link } from 'react-router-dom';
import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';

export function Unauthorized() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-8 max-w-md">
          You don't have permission to access this page. 
          Please contact an administrator if you believe this is an error.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button leftIcon={<Home className="w-4 h-4" />}>
              Go Home
            </Button>
          </Link>
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Unauthorized;




