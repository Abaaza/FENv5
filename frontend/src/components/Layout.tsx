import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  DollarSign,
  FolderOpen,
  Users,
  Settings,
  User,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  Activity,
  FlaskConical,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../stores/auth.store';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';

export default function Layout() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Price Matching', href: '/price-matching', icon: FileSpreadsheet },
    { name: 'Price List', href: '/price-list', icon: DollarSign },
    { name: 'Projects', href: '/projects', icon: FolderOpen },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Activity', href: '/activity', icon: Activity },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-900 text-white transition-all duration-300 lg:relative lg:z-auto',
          sidebarOpen ? 'w-64' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed && !sidebarOpen ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          <h2 className={cn('text-xl font-bold', sidebarCollapsed && !sidebarOpen && 'lg:hidden')}>
            The Fencing People
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:block"
          >
            <ChevronLeft className={cn('h-6 w-6 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className={cn(sidebarCollapsed && !sidebarOpen && 'lg:hidden')}>
                  {item.name}
                </span>
              </Link>
            );
          })}
          
          {user?.role === 'admin' && (
            <>
              <Link
                to="/admin"
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === '/admin'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                <span className={cn(sidebarCollapsed && !sidebarOpen && 'lg:hidden')}>
                  Admin Settings
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* User menu */}
        <div className="border-t border-gray-800 p-4">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <User className="h-5 w-5 flex-shrink-0" />
            <div className={cn('flex-1', sidebarCollapsed && !sidebarOpen && 'lg:hidden')}>
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={cn(sidebarCollapsed && !sidebarOpen && 'lg:hidden')}>
              Logout
            </span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b bg-white dark:bg-gray-800 px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold capitalize">
            {location.pathname.slice(1).replace('-', ' ') || 'Dashboard'}
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}