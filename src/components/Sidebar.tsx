import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Receipt, Users, Settings, LogOut, ChevronDown, ChevronRight, FileText, BarChart3, Calendar, Archive } from 'lucide-react';

interface SidebarProps {
  onLogout?: () => void;
  className?: string;
  showLogo?: boolean;
}

interface NavSection {
  title: string;
  icon: React.ReactNode;
  items: {
    icon: React.ReactNode;
    label: string;
    to: string;
  }[];
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, className = 'hidden md:flex', showLogo = true }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'main': true, // Domyślnie rozwinięte
    'reports': false,
    'archive': false
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const sections: NavSection[] = [
    {
      title: 'Główne',
      icon: <LayoutDashboard size={18} />,
      items: [
        { icon: <LayoutDashboard size={18} />, label: 'Pulpit', to: '/' },
        { icon: <Map size={18} />, label: 'Mapa', to: '/map' },
        { icon: <Receipt size={18} />, label: 'Faktury', to: '/invoices' },
        { icon: <Users size={18} />, label: 'Klienci', to: '/clients' },
      ]
    },
    {
      title: 'Raporty',
      icon: <BarChart3 size={18} />,
      items: [
        { icon: <FileText size={18} />, label: 'Raport zleceń', to: '/reports/jobs' },
        { icon: <Calendar size={18} />, label: 'Raport miesięczny', to: '/reports/monthly' },
      ]
    },
    {
      title: 'Archiwum',
      icon: <Archive size={18} />,
      items: [
        { icon: <Archive size={18} />, label: 'Zlecenia zakończone', to: '/archive/completed' },
        { icon: <FileText size={18} />, label: 'Dokumenty', to: '/archive/documents' },
      ]
    }
  ];

  return (
    <aside className={`bg-white border-r border-gray-200 shadow-sm flex flex-col ${className}`}>
      {/* Logo */}
      {showLogo && (
        <div className="p-6 border-b border-gray-100 flex items-center justify-center">
          <h1 className="text-xl font-bold text-orange-600 tracking-tight">
            MONTAŻ<span className="text-gray-800">24</span>
          </h1>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {sections.map((section, sectionIndex) => {
          const sectionKey = section.title.toLowerCase().replace(/\s+/g, '-');
          const isExpanded = expandedSections[sectionKey] ?? false;

          return (
            <div key={sectionIndex} className="mb-2">
              {/* Section Header (Clickable) */}
              <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
                    {section.icon}
                  </div>
                  <span>{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
              </button>

              {/* Section Items (Collapsible) */}
              {isExpanded && (
                <div className="mt-1 ml-2 space-y-1 border-l-2 border-gray-100 pl-2">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                          isActive
                            ? 'bg-orange-50 text-orange-600 font-medium shadow-sm'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      <div className="transition-transform duration-200 group-hover:scale-110">
                        {item.icon}
                      </div>
                      <span className="text-sm">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
