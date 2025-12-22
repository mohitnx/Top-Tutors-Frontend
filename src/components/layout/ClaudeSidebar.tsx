import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Plus,
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
  X,
  Pin,
  Trash2,
  MoreHorizontal,
  Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Role, AIChatSession } from '../../types';
import { geminiChatApi } from '../../api';
import Avatar from '../ui/Avatar';

interface ClaudeSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ClaudeSidebar({ isCollapsed = false, onToggleCollapse }: ClaudeSidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // AI Chat sessions (primary for students)
  const [aiSessions, setAiSessions] = useState<AIChatSession[]>([]);
  const [isLoadingAiSessions, setIsLoadingAiSessions] = useState(true);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null);

  // Current session from URL
  const currentSessionId = searchParams.get('session');

  // Fetch AI chat sessions
  const fetchAiSessions = useCallback(async () => {
    if (!user || user.role !== Role.STUDENT) return;
    
    try {
      setIsLoadingAiSessions(true);
      const response = await geminiChatApi.getSessions({ limit: 10 });
      setAiSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch AI sessions:', error);
    } finally {
      setIsLoadingAiSessions(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAiSessions();
  }, [fetchAiSessions, location.pathname, location.search]);

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
    
    if (user.role === Role.TUTOR) {
      items.push({
        label: 'Dashboard',
        path: getDashboardPath(),
        icon: LayoutDashboard,
      });
    }

    if (user.role === Role.ADMIN) {
      items.push(
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { label: 'Users', path: '/admin/users', icon: Users },
      );
    }

    return items;
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await logout();
  };

  // Session title
  const getSessionTitle = (session: AIChatSession) => {
    if (session.title) return session.title;
    if (session.lastMessage?.content) {
      return session.lastMessage.content.length > 30 
        ? session.lastMessage.content.substring(0, 30) + '...'
        : session.lastMessage.content;
    }
    return 'New chat';
  };

  // Handle session click
  const handleSessionClick = (sessionId: string) => {
    setIsMobileOpen(false);
    navigate(`/dashboard/student?session=${sessionId}`);
  };

  // Handle new chat
  const handleNewChat = () => {
    setIsMobileOpen(false);
    navigate('/dashboard/student');
  };

  // Context menu actions
  const handlePinSession = async (sessionId: string) => {
    try {
      const session = aiSessions.find(s => s.id === sessionId);
      await geminiChatApi.updateSession(sessionId, { isPinned: !session?.isPinned });
      await fetchAiSessions();
    } catch (error) {
      console.error('Failed to pin session:', error);
    }
    setContextMenu(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this chat?')) return;
    try {
      await geminiChatApi.deleteSession(sessionId);
      setAiSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        navigate('/dashboard/student');
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
    setContextMenu(null);
  };

  // Filter sessions by search
  const filteredSessions = searchQuery
    ? aiSessions.filter(s => 
        getSessionTitle(s).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : aiSessions;

  // Sort sessions: pinned first, then by lastMessageAt
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  // Format time ago
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-4 h-4 text-white" />
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
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-white bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 rounded-xl hover:from-violet-600/30 hover:to-fuchsia-600/30 transition-all group"
          >
            <Plus className="w-4 h-4 text-violet-400" />
            {!isCollapsed && <span className="text-sm font-medium">New Chat</span>}
          </button>
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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* AI Chat Sessions (for students) */}
      {!isCollapsed && user?.role === Role.STUDENT && (
        <div className="flex-1 min-h-0 border-t border-gray-800/50 flex flex-col">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-hide">
            {isLoadingAiSessions ? (
              <div className="text-center py-4">
                <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : sortedSessions.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No chats yet</p>
            ) : (
              sortedSessions.map((session) => {
                const isActive = currentSessionId === session.id;
                return (
                  <div
                    key={session.id}
                    className="group relative"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ sessionId: session.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <button
                      onClick={() => handleSessionClick(session.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all ${
                        isActive
                          ? 'bg-violet-500/10 border border-violet-500/20'
                          : 'hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {session.isPinned && (
                          <Pin className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {getSessionTitle(session)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {formatTimeAgo(session.lastMessageAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                    
                    {/* More button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ sessionId: session.id, x: e.clientX, y: e.clientY });
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* Spacer for non-students */}
      {(isCollapsed || user?.role !== Role.STUDENT) && (
        <div className="flex-1" />
      )}

      {/* Settings */}
      <div className="p-2 border-t border-gray-800/50">
        <NavLink
          to="/profile"
          onClick={() => setIsMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
            location.pathname === '/profile'
              ? 'bg-violet-500/10 text-violet-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </NavLink>
      </div>

      {/* User Menu */}
      <div className="p-2 border-t border-gray-800/50">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-gray-800/50 transition-colors"
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

          {showUserMenu && (
            <div className={`absolute ${isCollapsed ? 'left-full ml-2' : 'left-0 right-0'} bottom-full mb-1 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl py-1 z-50`}>
              <NavLink
                to="/profile"
                onClick={() => { setShowUserMenu(false); setIsMobileOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </NavLink>
              <button
                onClick={() => { handleLogout(); setShowUserMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handlePinSession(contextMenu.sessionId)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <Pin className="w-3.5 h-3.5" />
              <span>{aiSessions.find(s => s.id === contextMenu.sessionId)?.isPinned ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              onClick={() => handleDeleteSession(contextMenu.sessionId)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-1.5 bg-[#1a1a1a] text-white rounded-xl shadow-lg border border-gray-800"
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
        className={`hidden lg:flex fixed left-0 top-0 h-screen bg-[#0f0f0f] border-r border-gray-800/50 flex-col transition-all duration-300 z-30 ${
          isCollapsed ? 'w-14' : 'w-60'
        }`}
      >
        <SidebarContent />
        {/* Toggle Arrow */}
        <button
          onClick={onToggleCollapse}
          className="absolute bottom-20 right-0 translate-x-1/2 p-1 bg-[#1a1a1a] border border-gray-800 text-gray-400 hover:text-white rounded-full transition-colors z-50"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen bg-[#0f0f0f] border-r border-gray-800/50 flex-col z-50 w-64 transform transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Scrollbar hide style */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}

export default ClaudeSidebar;
