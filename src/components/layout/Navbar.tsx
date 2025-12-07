import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  MessageSquare, 
  LayoutDashboard,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '../../types';
import Avatar from '../ui/Avatar';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (!user) return '/';
    switch (user.role) {
      case Role.ADMIN:
        return '/admin';
      case Role.TUTOR:
        return '/dashboard/tutor';
      case Role.STUDENT:
      default:
        return '/dashboard/student';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <nav className="container-wide">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span>Top<span className="text-primary-600">Tutors</span></span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {isAuthenticated ? (
              <>
                <Link 
                  to={getDashboardLink()} 
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Dashboard
                </Link>
                <Link 
                  to="/conversations" 
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Messages
                </Link>
                
                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <Avatar name={user?.name || null} size="sm" />
                    <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                      {user?.name || 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-dropdown animate-slide-down">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user?.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user?.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <User className="w-4 h-4" />
                          Profile
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Log in
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  Sign up free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 animate-slide-down">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 px-2 py-3 mb-2 bg-gray-50 rounded">
                  <Avatar name={user?.name || null} size="md" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>
                <Link
                  to={getDashboardLink()}
                  className="flex items-center gap-2 px-2 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link
                  to="/conversations"
                  className="flex items-center gap-2 px-2 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <MessageSquare className="w-4 h-4" />
                  Messages
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-2 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  to="/login"
                  className="px-2 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign up free
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
