import React, { useRef } from 'react';
import { JobColumnId } from '../types';

interface MoveToDropdownProps {
  jobId: string;
  currentColumnId: string;
  onClick?: (rect: DOMRect) => void;
  className?: string;
  // Legacy prop (optional now)
  onMoveToColumn?: (jobId: string, columnId: JobColumnId) => void;
}

// Kolumny do wyboru
export const COLUMN_OPTIONS: { id: JobColumnId; title: string; color: string }[] = [
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
  onClick,
  className = ''
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  return (
    <button
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onClick && buttonRef.current) {
          onClick(buttonRef.current.getBoundingClientRect());
        }
      }}
      className={className}
      style={{ borderColor: 'var(--border-light)' }}
    >
      📅 PRZENIEŚ DO...
    </button>
  );
};

export default MoveToDropdown;
