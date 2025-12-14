import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ClaudeSidebar from './ClaudeSidebar';

interface LayoutProps {
  showSidebar?: boolean;
}

// Claude-style Layout with dark sidebar
export function Layout({ showSidebar = true }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#212121]">
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
