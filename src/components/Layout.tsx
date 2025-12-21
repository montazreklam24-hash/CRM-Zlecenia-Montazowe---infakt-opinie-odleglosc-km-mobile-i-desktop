import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-xl font-bold text-blue-600 tracking-tight cursor-pointer" onClick={() => window.location.href = '/'}>
            MONTAŻ<span className="text-gray-800">24</span>
          </h1>
        </div>
        
        {/* Optional: User Profile / Actions could go here */}
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
      <main className="flex-1 pt-32 p-4 md:p-8 min-h-screen transition-all duration-300 w-full">
        <div className="max-w-7xl mx-auto">
           <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;


