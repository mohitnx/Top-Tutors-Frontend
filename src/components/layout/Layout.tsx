import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '../../types';
import ClaudeSidebar from './ClaudeSidebar';

interface LayoutProps {
  showSidebar?: boolean;
}

// Layout with dark sidebar, role-aware content background
export function Layout({ showSidebar = true }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  // Students get dark bg (Claude-style chat), everyone else gets modern dark bg
  const isStudent = user?.role === Role.STUDENT;
  const bgClass = isStudent ? 'bg-[#212121]' : 'bg-[#1a1b1e]';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {showSidebar && (
        <ClaudeSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      )}

      <main
        className={`min-h-screen transition-all duration-300 ${
          showSidebar
            ? isSidebarCollapsed
              ? 'lg:ml-14'
              : 'lg:ml-56'
            : ''
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}

// Auth Layout - minimal, no sidebar
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      <main className="min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

// Public Layout - for landing page
export function PublicLayout() {
  return (
    <div className="min-h-screen">
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
