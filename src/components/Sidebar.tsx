import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Receipt, Users, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  onLogout?: () => void;
  className?: string;
  showLogo?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, className = 'hidden md:flex', showLogo = true }) => {
  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Pulpit', to: '/' },
    { icon: <Map size={20} />, label: 'Mapa', to: '/map' },
    { icon: <Receipt size={20} />, label: 'Faktury', to: '/invoices' },
    { icon: <Users size={20} />, label: 'Klienci', to: '/clients' },
    // { icon: <Settings size={20} />, label: 'Ustawienia', to: '/settings' },
  ];

  return (
    <aside className={`bg-white border-r border-gray-200 shadow-sm flex flex-col ${className}`}>
      {/* Logo */}
      {showLogo && (
        <div className="p-6 border-b border-gray-100 flex items-center justify-center">
          <h1 className="text-xl font-bold text-blue-600 tracking-tight">
            MONTAŻ<span className="text-gray-800">24</span>
          </h1>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-medium shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              {item.icon}
            </div>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-4 border-t border-gray-100 mt-auto">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut size={20} />
          <span>Wyloguj</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

