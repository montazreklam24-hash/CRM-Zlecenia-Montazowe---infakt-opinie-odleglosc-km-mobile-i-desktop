import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { JobColumnId } from '../types';

interface MoveToDropdownProps {
  jobId: string;
  currentColumnId: string;
  onMoveToColumn: (jobId: string, columnId: JobColumnId) => void;
  className?: string;
}

// Kolumny do wyboru
const COLUMN_OPTIONS: { id: JobColumnId; title: string; color: string }[] = [
  { id: 'PREPARE', title: 'Do przygotowania', color: '#64748b' },
  { id: 'MON', title: 'Poniedziałek', color: '#3b82f6' },
  { id: 'TUE', title: 'Wtorek', color: '#22c55e' },
  { id: 'WED', title: 'Środa', color: '#f97316' },
  { id: 'THU', title: 'Czwartek', color: '#a855f7' },
  { id: 'FRI', title: 'Piątek', color: '#ef4444' },
  { id: 'COMPLETED', title: 'Wykonane', color: '#22c55e' },
];

const MoveToDropdown: React.FC<MoveToDropdownProps> = ({ 
  jobId, 
  currentColumnId, 
  onMoveToColumn,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Update coords on scroll/resize
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updateCoords = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        // Dropdown opens UPWARDS, so we position the BOTTOM of the dropdown at the TOP of the button
        setCoords({
          top: rect.top, // This will be the bottom limit for the dropdown
          left: rect.left,
          width: rect.width
        });
      }
    };

    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);

    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  // Close handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
        return;
      }
      const portalElement = document.getElementById(`move-dropdown-portal-${jobId}`);
      if (portalElement && portalElement.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, jobId]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isOpen) {
      setIsOpen(false);
    } else if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width
      });
      setIsOpen(true);
    }
  };

  const handleSelect = (columnId: JobColumnId) => {
    onMoveToColumn(jobId, columnId);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={className}
        style={{ borderColor: 'var(--border-light)' }}
      >
        📅 PRZENIEŚ DO...
      </button>

      {isOpen && coords && createPortal(
        <div 
          id={`move-dropdown-portal-${jobId}`}
          className="fixed z-[99999] bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 slide-in-from-bottom-2"
          style={{ 
            bottom: window.innerHeight - coords.top + 4, // 4px gap above button
            left: coords.left, 
            width: coords.width,
            maxHeight: '300px',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[9px] font-bold text-slate-400 uppercase px-2 py-1.5 bg-slate-50 border-b border-slate-100 sticky top-0">
            Przenieś do
          </div>
          {COLUMN_OPTIONS
            .filter(col => col.id !== (currentColumnId || 'PREPARE'))
            .map(col => (
              <button
                key={col.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(col.id);
                }}
                className="w-full text-left px-2 py-2.5 hover:bg-blue-50 text-[11px] font-medium text-slate-700 flex items-center gap-2 border-b border-slate-50 last:border-b-0 transition-colors"
              >
                <span 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: col.color }}
                />
                {col.title}
              </button>
            ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default MoveToDropdown;

