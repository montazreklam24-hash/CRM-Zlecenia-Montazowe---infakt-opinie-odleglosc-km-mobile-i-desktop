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
      {/* Top Navigation Bar - CZARNY */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black z-50 flex items-center justify-between px-4 md:px-6 shadow-lg border-b border-gray-800">
        {/* Left: Logo + Menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            {/* Logo jako tekst z pomarańczowym akcentem */}
            <div className="flex items-center gap-2">
              <div className="text-white font-bold text-lg">
                <span className="text-orange-500">montaż</span>
                <span className="text-white"> reklam </span>
                <span className="text-orange-500 text-xl">24</span>
              </div>
              <span className="hidden md:inline text-xs text-gray-400 font-semibold bg-gray-800 px-2 py-1 rounded">
                CRM Beta
              </span>
            </div>
          </div>
        </div>
        
        {/* Right: View Toggles + User */}
        <div className="flex items-center gap-3">
          {/* PC/Mobile Toggle */}
          <div className="hidden md:flex bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button
              onClick={() => handleViewToggle('desktop')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentView === 'desktop'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              PC
            </button>
            <button
              onClick={() => handleViewToggle('mobile')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentView === 'mobile'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              Mobile
            </button>
          </div>

          {/* Trello Classic Button */}
          <button
            onClick={() => window.open('https://trello.com', '_blank')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Trello Classic
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors border border-gray-700"
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
                  className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
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
