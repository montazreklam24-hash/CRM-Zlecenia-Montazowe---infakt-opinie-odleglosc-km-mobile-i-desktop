import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeSwitcher from './ThemeSwitcher';
import { Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useDeviceType } from '../hooks/useDeviceType';
import { User, UserRole } from '../types';

interface LayoutProps {
  onLogout?: () => void;
  user?: User;
}

const ROLE_NAMES: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.WORKER]: 'Montażysta',
  [UserRole.PRINTER]: 'Drukarz'
};

const Layout: React.FC<LayoutProps> = ({ onLogout, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { isMobile } = useDeviceType();
  const urlParams = new URLSearchParams(window.location.search);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userRoleName = user?.role ? ROLE_NAMES[user.role] : 'Użytkownik';


  const handleViewToggle = (view: 'desktop' | 'mobile') => {
    if (view === 'mobile') {
      window.location.href = window.location.pathname + '?mobile=1';
    } else {
      window.location.href = window.location.pathname + '?desktop=1';
    }
  };

  const currentView = urlParams.get('mobile') === '1' ? 'mobile' : 'desktop';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 theme-header z-50 flex items-center justify-between px-4 md:px-6 shadow-lg">
        {/* Left: Logo + Menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] hover:bg-[var(--bg-surface)]"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            {/* Logo jako tekst */}
            <div className="flex items-center gap-2">
              <div className="font-bold text-lg">
                <span style={{ color: 'var(--accent-primary)' }}>montaż</span>
                <span style={{ color: 'var(--text-primary)' }}> reklam </span>
                <span style={{ color: 'var(--accent-primary)' }} className="text-xl">24</span>
              </div>
              <span className="hidden md:inline text-xs font-semibold px-2 py-1 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                CRM Beta
              </span>
            </div>
          </div>
        </div>
        
        {/* Right: View Toggles + User */}
        <div className="flex items-center gap-3">
          {/* PC/Mobile Toggle */}
          <div className="hidden md:flex rounded-lg p-1 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-medium)' }}>
            <button
              onClick={() => handleViewToggle('desktop')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentView === 'desktop'
                  ? 'shadow-sm'
                  : 'hover:opacity-80'
              }`}
              style={{
                background: currentView === 'desktop' ? 'var(--accent-primary)' : 'transparent',
                color: currentView === 'desktop' ? 'var(--text-inverse)' : 'var(--text-secondary)'
              }}
            >
              PC
            </button>
            <button
              onClick={() => handleViewToggle('mobile')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentView === 'mobile'
                  ? 'shadow-sm'
                  : 'hover:opacity-80'
              }`}
              style={{
                background: currentView === 'mobile' ? 'var(--accent-primary)' : 'transparent',
                color: currentView === 'mobile' ? 'var(--text-inverse)' : 'var(--text-secondary)'
              }}
            >
              Mobile
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="hidden md:flex">
            <ThemeSwitcher />
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border"
              style={{ 
                background: 'var(--bg-surface)', 
                color: 'var(--text-primary)',
                borderColor: 'var(--border-medium)'
              }}
            >
              <span className="hidden md:inline">
                {userRoleName}
              </span>
              <span className="md:hidden">{userRoleName}</span>
              {showUserMenu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div 
                className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl border py-2 z-50"
                style={{ 
                  background: 'var(--bg-card)', 
                  borderColor: 'var(--border-medium)'
                }}
              >
                <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Użytkownik'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.email || ''}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--accent-danger)' }}
                >
                  Wyloguj
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar Overlay (Backdrop) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel (Drawer) */}
      <div 
        className={`fixed top-16 left-0 bottom-0 w-64 z-40 transform transition-transform duration-300 ease-in-out shadow-lg ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--bg-surface)' }}
      >
        <Sidebar 
          onLogout={onLogout} 
          showLogo={false} 
          className="h-full border-none shadow-none w-full" 
        />
      </div>

      {/* Main Content - Obniżony o 50px więcej */}
      <main className="flex-1 pt-44 p-4 md:p-8 min-h-screen transition-all duration-300 w-full">
        <div className="max-w-7xl mx-auto">
           <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
