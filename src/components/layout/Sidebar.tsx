import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  HelpCircle, 
  Users, 
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard/student',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: [Role.STUDENT],
  },
  {
    label: 'Dashboard',
    path: '/dashboard/tutor',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: [Role.TUTOR],
  },
  {
    label: 'Dashboard',
    path: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: [Role.ADMIN],
  },
  {
    label: 'Ask a Question',
    path: '/ask',
    icon: <HelpCircle className="w-5 h-5" />,
    roles: [Role.STUDENT],
  },
  {
    label: 'Messages',
    path: '/conversations',
    icon: <MessageSquare className="w-5 h-5" />,
    roles: [Role.STUDENT, Role.TUTOR],
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: <Users className="w-5 h-5" />,
    roles: [Role.ADMIN],
  },
  {
    label: 'Conversations',
    path: '/admin/conversations',
    icon: <MessageSquare className="w-5 h-5" />,
    roles: [Role.ADMIN],
  },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-gray-900">Menu</span>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Settings link at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Settings className="w-5 h-5" />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
