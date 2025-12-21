import React, { useState, useEffect, useRef } from 'react';
import { Palette, Check, Sun, Moon, Layout, Flame } from 'lucide-react';

type ThemeId = 'glass' | 'dark' | 'trello' | 'orange' | 'bitrix' | 'trello-modern';

interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: {
    bg: string;
    card: string;
    accent: string;
  };
}

const themes: Theme[] = [
  {
    id: 'glass',
    name: 'Glass Minimal',
    description: 'Przezroczysty, nowoczesny',
    icon: <Sun className="w-4 h-4" />,
    preview: {
      bg: 'bg-gradient-to-br from-slate-100 to-slate-200',
      card: 'bg-white/70',
      accent: 'bg-indigo-500'
    }
  },
  {
    id: 'dark',
    name: 'Dark Pro',
    description: 'Ciemny, profesjonalny',
    icon: <Moon className="w-4 h-4" />,
    preview: {
      bg: 'bg-[#0d1117]',
      card: 'bg-[#161b22]',
      accent: 'bg-[#58a6ff]'
    }
  },
  {
    id: 'trello',
    name: 'Trello Classic',
    description: 'Klasyczny, kolorowy',
    icon: <Layout className="w-4 h-4" />,
    preview: {
      bg: 'bg-gradient-to-b from-[#0079bf] to-[#026aa7]',
      card: 'bg-white',
      accent: 'bg-[#61bd4f]'
    }
  },
  {
    id: 'orange',
    name: 'Orange Modern',
    description: 'Pomarańczowy, nowoczesny',
    icon: <Flame className="w-4 h-4" />,
    preview: {
      bg: 'bg-gradient-to-br from-orange-500 to-orange-700',
      card: 'bg-white',
      accent: 'bg-orange-500'
    }
  },
  {
    id: 'bitrix',
    name: 'Bitrix Pro',
    description: 'Profesjonalny, biznesowy',
    icon: <Layout className="w-4 h-4" />,
    preview: {
      bg: 'bg-gradient-to-br from-blue-100 to-blue-200',
      card: 'bg-white/80',
      accent: 'bg-blue-500'
    }
  },
  {
    id: 'trello-modern',
    name: 'Trello Modern',
    description: 'Kolorowy, energiczny',
    icon: <Layout className="w-4 h-4" />,
    preview: {
      bg: 'bg-gradient-to-b from-slate-50 to-slate-100',
      card: 'bg-white',
      accent: 'bg-green-500'
    }
  }
];

const ThemeSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('glass');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Załaduj zapisany motyw
  useEffect(() => {
    const saved = localStorage.getItem('crm-theme') as ThemeId;
    if (saved && themes.find(t => t.id === saved)) {
      setCurrentTheme(saved);
      applyTheme(saved);
    }
  }, []);

  // Zamknij dropdown po kliknięciu poza
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyTheme = (themeId: ThemeId) => {
    // Usuń poprzedni motyw
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    
    // Zastosuj nowy
    document.documentElement.setAttribute('data-theme', themeId);
    document.body.setAttribute('data-theme', themeId);
    
    // Zapisz w localStorage
    localStorage.setItem('crm-theme', themeId);
  };

  const handleThemeChange = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    setIsOpen(false);
  };

  const currentThemeData = themes.find(t => t.id === currentTheme)!;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 transition-all hover:opacity-80"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-md)'
        }}
        title="Zmień motyw"
      >
        <Palette className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        <span className="text-xs sm:text-sm font-medium hidden sm:inline">{currentThemeData.name}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden animate-fade-in z-50"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {/* Header */}
          <div 
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-light)' }}
          >
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Wybierz motyw
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Zmiana wyglądu aplikacji
            </p>
          </div>

          {/* Theme list */}
          <div className="p-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-all"
                style={{
                  background: currentTheme === theme.id ? 'var(--bg-surface)' : 'transparent',
                }}
              >
                {/* Preview */}
                <div className={`w-12 h-10 rounded-md overflow-hidden flex-shrink-0 ${theme.preview.bg}`}>
                  <div className="h-full p-1 flex flex-col gap-0.5">
                    <div className={`h-2 w-6 rounded-sm ${theme.preview.card}`} />
                    <div className={`h-2 w-4 rounded-sm ${theme.preview.accent}`} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {theme.name}
                    </span>
                    {theme.icon}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {theme.description}
                  </p>
                </div>

                {/* Check */}
                {currentTheme === theme.id && (
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent-success)' }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div 
            className="px-4 py-2 border-t text-center"
            style={{ 
              borderColor: 'var(--border-light)',
              background: 'var(--bg-surface)'
            }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Motyw zostanie zapamiętany
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;

