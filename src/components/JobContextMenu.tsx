import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Job, JobColumnId, PaymentStatus } from '../types';
import { Trash2, Archive, X, Check, ExternalLink, Copy } from 'lucide-react';
import { PAYMENT_STATUS_LIST } from '../constants/paymentStatus';

interface JobContextMenuProps {
  job: Job;
  x: number; // współrzędna X kliknięcia - UŻYWANA do pozycjonowania
  y: number; // współrzędna Y kliknięcia - UŻYWANA do pozycjonowania
  onClose: () => void;
  onPaymentStatusChange?: (jobId: string, status: PaymentStatus) => void;
  onMoveToColumn?: (jobId: string, columnId: JobColumnId) => void;
  onArchive?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
  onDuplicate?: (jobId: string) => void;
  onOpenJob?: (job: Job) => void;
  isAdmin?: boolean;
}

// Kolumny/dni
const COLUMNS: { id: JobColumnId; label: string; shortLabel: string; icon: string }[] = [
  { id: 'PREPARE', label: 'Do przygotowania', shortLabel: 'Przyg.', icon: '­čôő' },
  { id: 'MON', label: 'Poniedziałek', shortLabel: 'Pon', icon: '­čö┤' },
  { id: 'TUE', label: 'Wtorek', shortLabel: 'Wt', icon: '­ččó' },
  { id: 'WED', label: 'Środa', shortLabel: 'Śr', icon: '­ččú' },
  { id: 'THU', label: 'Czwartek', shortLabel: 'Czw', icon: '­ččí' },
  { id: 'FRI', label: 'Piątek', shortLabel: 'Pt', icon: '­čöÁ' },
  { id: 'COMPLETED', label: 'Wykonane', shortLabel: 'OK', icon: 'Ôťů' },
];

/**
 * JobContextMenu - małe menu kontekstowe pozycjonowane przy kliknięciu (PPM lub przycisk Ôő«)
 * 
 * POPRAWIONE: Teraz naprawdę używa współrzędnych x, y do pozycjonowania,
 * zamiast renderować pełnoekranowy modal na środku ekranu.
 * 
 * Menu jest pozycjonowane względem viewport i automatycznie dostosowuje
 * pozycję jeśli wychodzi poza ekran.
 */
const JobContextMenu: React.FC<JobContextMenuProps> = ({
  job,
  x,
  y,
  onClose,
  onPaymentStatusChange,
  onMoveToColumn,
  onArchive,
  onDelete,
  onDuplicate,
  onOpenJob,
  isAdmin = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ x, y });

  // Oblicz pozycję menu tak, żeby nie wychodziło poza viewport
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = x;
    let newY = y;
    
    // Sprawdź czy menu wychodzi poza prawą krawędź
    if (x + rect.width > viewportWidth - 10) {
      newX = viewportWidth - rect.width - 10;
    }
    
    // Sprawdź czy menu wychodzi poza dolną krawędź
    if (y + rect.height > viewportHeight - 10) {
      newY = viewportHeight - rect.height - 10;
    }
    
    // Nie pozwól na ujemne wartości
    newX = Math.max(10, newX);
    newY = Math.max(10, newY);
    
    setMenuPosition({ x: newX, y: newY });
  }, [x, y]);

  // Zamknij na Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Zamknij przy kliknięciu poza menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Dodaj listener z małym opóźnieniem, żeby nie zamknęło się od razu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handlePaymentChange = (status: PaymentStatus) => {
    onPaymentStatusChange?.(job.id, status);
    onClose();
  };

  const handleMove = (columnId: JobColumnId) => {
    onMoveToColumn?.(job.id, columnId);
    onClose();
  };

  const currentColumn = job.columnId || 'PREPARE';
  const currentPayment = job.paymentStatus || PaymentStatus.NONE;

  return createPortal(
    <>
      {/* Przezroczyste tło - kliknięcie zamyka menu */}
      <div 
        className="fixed inset-0 z-[99997]"
        onClick={onClose}
      />
      
      {/* Menu pozycjonowane przy kliknięciu */}
      <div
        ref={menuRef}
        className="fixed z-[99998] bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ 
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
          width: '280px',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          animation: 'contextMenuFadeIn 0.1s ease-out',
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Nagłówek */}
        <div className="px-3 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] opacity-70">{job.friendlyId}</div>
            <div className="text-xs font-bold truncate">
              {job.data?.jobTitle || 'Zlecenie'}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Otwórz zlecenie */}
        {onOpenJob && (
          <div className="p-2 border-b border-gray-100">
            <button 
              onClick={() => { onOpenJob(job); onClose(); }}
              className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Otwórz szczegóły
            </button>
          </div>
        )}

        {/* Status płatności */}
        {isAdmin && (
          <div className="p-2 border-b border-gray-100">
            <div className="text-[9px] uppercase text-slate-400 font-bold mb-1.5 px-1">Status płatności</div>
            <div className="flex flex-wrap gap-1">
              {PAYMENT_STATUS_LIST.map((cfg) => {
                const isActive = currentPayment === cfg.value;
                return (
                  <button
                    key={cfg.value}
                    onClick={() => handlePaymentChange(cfg.value)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                      isActive ? 'ring-2 ring-offset-1 ring-slate-600 scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ 
                      background: cfg.color, 
                      color: '#fff' 
                    }}
                  >
                    {cfg.label}
                    {isActive && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Przenieś do kolumny */}
        <div className="p-2 border-b border-gray-100">
          <div className="text-[9px] uppercase text-slate-400 font-bold mb-1.5 px-1">Przenieś do</div>
          <div className="grid grid-cols-4 gap-1">
            {COLUMNS.map((col) => {
              const isActive = currentColumn === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => handleMove(col.id)}
                  disabled={isActive}
                  className={`px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all flex flex-col items-center gap-0.5 ${
                    isActive 
                      ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-sm leading-none">{col.icon}</span>
                  <span className="text-[8px] leading-tight">{col.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Akcje */}
        {isAdmin && (
          <div className="p-2 flex gap-1.5">
            {onDuplicate && (
              <button 
                onClick={() => { onDuplicate(job.id); onClose(); }}
                className="flex-1 py-2 px-2 rounded-lg text-xs font-medium bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors flex items-center justify-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplikuj
              </button>
            )}
            <button 
              onClick={() => { onArchive?.(job.id); onClose(); }}
              className="flex-1 py-2 px-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center gap-1"
            >
              <Archive className="w-3.5 h-3.5" />
              Archiwum
            </button>
            <button 
              onClick={() => { onDelete?.(job.id); onClose(); }}
              className="flex-1 py-2 px-2 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Usuń
            </button>
          </div>
        )}

        {/* Dla nie-admina tylko przycisk zamknij */}
        {!isAdmin && (
          <div className="p-2">
            <button 
              onClick={onClose}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Zamknij
            </button>
          </div>
        )}
      </div>

      {/* Animacja */}
      <style>{`
        @keyframes contextMenuFadeIn {
          from { 
            opacity: 0; 
            transform: scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: scale(1); 
          }
        }
      `}</style>
    </>,
    document.body
  );
};

export default JobContextMenu;

