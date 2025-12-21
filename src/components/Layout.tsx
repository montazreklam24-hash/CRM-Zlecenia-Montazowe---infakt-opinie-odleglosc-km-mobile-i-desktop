import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useDeviceType } from '../hooks/useDeviceType';

interface LayoutProps {
  onLogout?: () => void;
  user?: { name?: string; email?: string };
}

const Layout: React.FC<LayoutProps> = ({ onLogout, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { isMobile } = useDeviceType();
  const urlParams = new URLSearchParams(window.location.search);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleViewToggle = (view: 'desktop' | 'mobile') => {
    if (view === 'mobile') {
      window.location.href = window.location.pathname + '?mobile=1';
    } else {
      window.location.href = window.location.pathname + '?desktop=1';
    }
  };

  const currentView = urlParams.get('mobile') === '1' ? 'mobile' : 'desktop';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar - Pomarańczowy */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-orange-600 to-orange-700 z-50 flex items-center justify-between px-4 md:px-6 shadow-lg">
        {/* Left: Logo + Menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-white hover:bg-orange-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          {/* Logo M24 */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md">
              <span className="text-orange-600 font-bold text-lg">M24</span>
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-white font-bold text-sm leading-tight">Montaż Reklam 24</span>
              <span className="text-orange-100 text-xs">CRM 5.0 PC + MOBILE</span>
            </div>
          </div>
        </div>
        
        {/* Right: View Toggles + User */}
        <div className="flex items-center gap-3">
          {/* PC/Mobile Toggle */}
          <div className="hidden md:flex bg-orange-500 rounded-lg p-1">
            <button
              onClick={() => handleViewToggle('desktop')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentView === 'desktop'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-white hover:bg-orange-400'
              }`}
            >
              PC
            </button>
            <button
              onClick={() => handleViewToggle('mobile')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentView === 'mobile'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-white hover:bg-orange-400'
              }`}
            >
              Mobile
            </button>
          </div>

          {/* Trello Classic Button */}
          <button
            onClick={() => window.open('https://trello.com', '_blank')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Trello Classic
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <span className="hidden md:inline">
                ZALOGOWANO JAKO {user?.name || 'Administrator'} {user?.name || 'Admin'}
              </span>
              <span className="md:hidden">Użytkownik</span>
              {showUserMenu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.name || 'Administrator'}</p>
                  <p className="text-xs text-gray-500">{user?.email || 'admin@montazreklam24.pl'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white z-40 transform transition-transform duration-300 ease-in-out shadow-lg ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar 
          onLogout={onLogout} 
          showLogo={false} 
          className="h-full border-none shadow-none w-full" 
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-24 p-4 md:p-8 min-h-screen transition-all duration-300 w-full">
        <div className="max-w-7xl mx-auto">
           <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
