import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus,
  MessageSquare,
  LayoutDashboard,
  Users,
  Settings,
  User,
  ChevronDown,
  ChevronUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Role, Conversation } from '../../types';
import { messagesApi } from '../../api';
import Avatar from '../ui/Avatar';

interface ClaudeSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ClaudeSidebar({ isCollapsed = false, onToggleCollapse }: ClaudeSidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);

  // Fetch recent conversations for students
  useEffect(() => {
    const fetchRecentConversations = async () => {
      if (!user || user.role !== Role.STUDENT) return;
      
      try {
        const response = await messagesApi.getConversations(1, 5);
        setRecentConversations(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch recent conversations:', error);
      }
    };

    fetchRecentConversations();
  }, [user, location.pathname]); // Refetch when navigating

  // Get role-specific dashboard path
  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case Role.ADMIN: return '/admin';
      case Role.TUTOR: return '/dashboard/tutor';
      default: return '/dashboard/student';
    }
  };

  // Get role-specific nav items
  const getNavItems = () => {
    if (!user) return [];
    
    const items = [];
    
    // Dashboard for tutors and admins only (students use the "New question" button)
    if (user.role === Role.TUTOR) {
      items.push({
        label: 'Dashboard',
        path: getDashboardPath(),
        icon: LayoutDashboard,
      });
    }

    // Messages for students and tutors
    if (user.role === Role.STUDENT || user.role === Role.TUTOR) {
      items.push({
        label: 'Messages',
        path: '/conversations',
        icon: MessageSquare,
      });
    }

    if (user.role === Role.ADMIN) {
      items.push(
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { label: 'Users', path: '/admin/users', icon: Users },
        { label: 'Conversations', path: '/admin/conversations', icon: MessageSquare },
      );
    }

    return items;
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await logout();
  };

  // Get display title for conversation
  const getConversationTitle = (conv: Conversation) => {
    if (conv.topic) return conv.topic;
    const firstMessage = conv.messages?.[0];
    if (firstMessage?.content) {
      return firstMessage.content.length > 30 
        ? firstMessage.content.substring(0, 30) + '...'
        : firstMessage.content;
    }
    return conv.subject.replace('_', ' ');
  };

  const handleConversationClick = (convId: string) => {
    setIsMobileOpen(false);
    navigate(`/conversations/${convId}`);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-black" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-white text-sm tracking-tight">TopTutors</span>
          )}
        </div>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors lg:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat Button (for students) */}
      {user?.role === Role.STUDENT && (
        <div className="p-2">
          <NavLink
            to="/dashboard/student"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-2 w-full px-2.5 py-2 text-white bg-amber-500/20 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-all group"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            {!isCollapsed && <span className="text-sm font-medium text-amber-100">New question</span>}
          </NavLink>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="p-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path !== getDashboardPath() && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-gray-700/70 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/40'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Recent Conversations (for students only) - scrollable without scrollbar */}
      {!isCollapsed && user?.role === Role.STUDENT && recentConversations.length > 0 && (
        <div className="flex-1 min-h-0 border-t border-gray-700/50">
          <div className="p-2">
            <p className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Recent</p>
          </div>
          <div 
            className="px-2 space-y-0.5 overflow-y-auto scrollbar-hide"
            style={{ maxHeight: 'calc(100% - 40px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {recentConversations.map((conv) => {
              const isActive = location.pathname === `/conversations/${conv.id}`;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv.id)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors truncate ${
                    isActive
                      ? 'bg-gray-700/50 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/40'
                  }`}
                  title={getConversationTitle(conv)}
                >
                  {getConversationTitle(conv)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Spacer for non-students */}
      {(isCollapsed || user?.role !== Role.STUDENT || recentConversations.length === 0) && (
        <div className="flex-1" />
      )}

      {/* Settings - above user menu */}
      <div className="p-2 border-t border-gray-700/50">
        <NavLink
          to="/profile"
          onClick={() => setIsMobileOpen(false)}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all ${
            location.pathname === '/profile'
              ? 'bg-gray-700/70 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/40'
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </NavLink>
      </div>

      {/* User Menu */}
      <div className="p-2 border-t border-gray-700/50">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-gray-700/40 transition-colors"
          >
            <Avatar name={user?.name || ''} size="sm" className="w-7 h-7 text-xs" />
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm text-white truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.role === Role.STUDENT ? 'Student' : 
                     user?.role === Role.TUTOR ? 'Tutor' : 'Admin'}
                  </p>
                </div>
                {showUserMenu ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                )}
              </>
            )}
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className={`absolute ${isCollapsed ? 'left-full ml-2' : 'left-0 right-0'} bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50`}>
              <NavLink
                to="/profile"
                onClick={() => { setShowUserMenu(false); setIsMobileOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </NavLink>
              <button
                onClick={() => { handleLogout(); setShowUserMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700/50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-1.5 bg-gray-800 text-white rounded-lg shadow-lg"
        aria-label="Open menu"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex fixed left-0 top-0 h-screen bg-[#1c1c1c] border-r border-gray-800/50 flex-col transition-all duration-300 z-30 ${
          isCollapsed ? 'w-14' : 'w-56'
        }`}
      >
        <SidebarContent />
        {/* Toggle Arrow - Inside sidebar at bottom */}
        <button
          onClick={onToggleCollapse}
          className="absolute bottom-20 right-0 translate-x-1/2 p-1 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-full transition-colors z-50"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen bg-[#1c1c1c] border-r border-gray-800/50 flex-col z-50 w-64 transform transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Hide scrollbar style */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}

export default ClaudeSidebar;
