import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { JobColumnId } from '../types';
import { Check, Calendar } from 'lucide-react';

interface MoveToDropdownProps {
  jobId: string;
  currentColumnId: string;
  onMoveToColumn?: (jobId: string, columnId: JobColumnId) => void;
  className?: string;
}

// Kolumny do wyboru
export const COLUMN_OPTIONS: { id: JobColumnId; title: string; color: string; icon?: string }[] = [
  { id: 'PREPARE', title: 'Do przygotowania', color: '#64748b', icon: '📋' },
  { id: 'MON', title: 'Poniedziałek', color: '#f43f5e', icon: '🔴' },
  { id: 'TUE', title: 'Wtorek', color: '#22c55e', icon: '🟢' },
  { id: 'WED', title: 'Środa', color: '#8b5cf6', icon: '🟣' },
  { id: 'THU', title: 'Czwartek', color: '#f59e0b', icon: '🟡' },
  { id: 'FRI', title: 'Piątek', color: '#3b82f6', icon: '🔵' },
  { id: 'COMPLETED', title: 'Wykonane', color: '#16a34a', icon: '✅' },
];

const MoveToDropdown: React.FC<MoveToDropdownProps> = ({ 
  jobId, 
  currentColumnId, 
  onMoveToColumn,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = COLUMN_OPTIONS.length * 40 + 16; // approx height
      
      // Check if dropdown would go below viewport
      let top = rect.bottom + 4;
      if (top + dropdownHeight > viewportHeight - 20) {
        // Show above the button instead
        top = rect.top - dropdownHeight - 4;
      }
      
      setPosition({
        top,
        left: rect.left,
        width: Math.max(rect.width, 160)
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClick = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    // Use setTimeout to avoid immediate close from the button click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEscape);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (columnId: JobColumnId) => {
    if (columnId !== currentColumnId) {
      onMoveToColumn?.(jobId, columnId);
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className={className || "w-full py-1.5 text-[9px] font-bold text-slate-500 hover:bg-slate-100 transition-all flex items-center justify-center gap-1 border-t"}
        style={{ borderColor: 'var(--border-light)' }}
      >
        <Calendar className="w-3 h-3" />
        PRZENIEŚ DO...
      </button>

      {isOpen && createPortal(
        <div
          className="fixed z-[99999]"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden py-1"
            style={{ 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              animation: 'fadeInMove 0.15s ease-out'
            }}
          >
            {COLUMN_OPTIONS.map((col) => {
              const isCurrentColumn = col.id === currentColumnId;
              return (
                <button
                  key={col.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(col.id);
                  }}
                  disabled={isCurrentColumn}
                  className={`w-full px-3 py-2 flex items-center gap-2 transition-colors text-left ${
                    isCurrentColumn 
                      ? 'bg-gray-100 cursor-default' 
                      : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <span className="text-sm flex-shrink-0">{col.icon}</span>
                  <span 
                    className={`text-xs font-semibold flex-1 ${isCurrentColumn ? 'text-gray-400' : ''}`}
                    style={{ color: isCurrentColumn ? undefined : col.color }}
                  >
                    {col.title}
                  </span>
                  {isCurrentColumn && (
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Styles */}
      <style>{`
        @keyframes fadeInMove {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default MoveToDropdown;
