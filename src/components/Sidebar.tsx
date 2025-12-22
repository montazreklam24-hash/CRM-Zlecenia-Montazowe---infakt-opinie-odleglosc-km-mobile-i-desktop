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
  // Mapowanie polskich nazw sekcji na klucze
  const getSectionKey = (title: string): string => {
    const mapping: Record<string, string> = {
      'Główne': 'main',
      'Raporty': 'reports',
      'Archiwum': 'archive'
    };
    return mapping[title] || title.toLowerCase().replace(/\s+/g, '-');
  };

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
    <aside 
      className={`border-r shadow-sm flex flex-col ${className}`}
      style={{ 
        background: 'var(--bg-surface)', 
        borderColor: 'var(--border-light)' 
      }}
    >
      {/* Logo */}
      {showLogo && (
        <div className="p-6 border-b flex items-center justify-center" style={{ borderColor: 'var(--border-light)' }}>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent-primary)' }}>
            MONTAŻ<span style={{ color: 'var(--text-primary)' }}>24</span>
          </h1>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {sections.map((section, sectionIndex) => {
          const sectionKey = getSectionKey(section.title);
          const isExpanded = expandedSections[sectionKey] ?? false;

          return (
            <div key={sectionIndex} className="mb-2">
              {/* Section Header (Clickable) */}
              <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors group hover:opacity-80"
                style={{ color: 'var(--text-primary)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    {section.icon}
                  </div>
                  <span>{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                )}
              </button>

              {/* Section Items (Collapsible) */}
              {isExpanded && (
                <div className="mt-1 ml-2 space-y-1 border-l-2 pl-2" style={{ borderColor: 'var(--border-light)' }}>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                          isActive ? 'shadow-sm font-medium' : 'hover:opacity-80'
                        }`
                      }
                      style={({ isActive }) => ({
                        background: isActive ? 'var(--accent-primary)' : 'transparent',
                        color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)'
                      })}
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
      <div className="p-4 border-t mt-auto" style={{ borderColor: 'var(--border-light)' }}>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors hover:opacity-80"
          style={{ color: 'var(--accent-primary)' }}
        >
          <LogOut size={20} />
          <span>Wyloguj</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
