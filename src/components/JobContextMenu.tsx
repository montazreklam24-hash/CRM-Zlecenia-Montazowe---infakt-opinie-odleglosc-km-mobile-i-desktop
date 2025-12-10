import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Job, JobColumnId, PaymentStatus } from '../types';
import { Trash2, Archive, X, Check } from 'lucide-react';

interface JobContextMenuProps {
  job: Job;
  x: number; // nie używane - zachowujemy dla kompatybilności
  y: number; // nie używane - zachowujemy dla kompatybilności
  onClose: () => void;
  onPaymentStatusChange?: (jobId: string, status: PaymentStatus) => void;
  onMoveToColumn?: (jobId: string, columnId: JobColumnId) => void;
  onArchive?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
  isAdmin?: boolean;
}

// Statusy płatności
const PAYMENT_STATUSES: { value: PaymentStatus; label: string; bgColor: string; textColor: string }[] = [
  { value: PaymentStatus.NONE, label: 'Brak', bgColor: '#94a3b8', textColor: '#fff' },
  { value: PaymentStatus.PROFORMA, label: 'Proforma', bgColor: '#f97316', textColor: '#fff' },
  { value: PaymentStatus.PARTIAL, label: 'Zaliczka', bgColor: '#a855f7', textColor: '#fff' },
  { value: PaymentStatus.PAID, label: 'Opłacone', bgColor: '#22c55e', textColor: '#fff' },
  { value: PaymentStatus.CASH, label: 'Barter', bgColor: '#eab308', textColor: '#fff' },
  { value: PaymentStatus.OVERDUE, label: 'Do zapłaty', bgColor: '#ef4444', textColor: '#fff' },
];

// Kolumny/dni
const COLUMNS: { id: JobColumnId; label: string; shortLabel: string; icon: string; color: string }[] = [
  { id: 'PREPARE', label: 'Do przygotowania', shortLabel: 'Przyg.', icon: '📋', color: '#64748b' },
  { id: 'MON', label: 'Poniedziałek', shortLabel: 'Pon', icon: '🔴', color: '#dc2626' },
  { id: 'TUE', label: 'Wtorek', shortLabel: 'Wt', icon: '🟢', color: '#16a34a' },
  { id: 'WED', label: 'Środa', shortLabel: 'Śr', icon: '🟣', color: '#9333ea' },
  { id: 'THU', label: 'Czwartek', shortLabel: 'Czw', icon: '🟡', color: '#ca8a04' },
  { id: 'FRI', label: 'Piątek', shortLabel: 'Pt', icon: '🔵', color: '#2563eb' },
  { id: 'SAT', label: 'Sobota', shortLabel: 'Sob', icon: '⚪', color: '#6b7280' },
  { id: 'SUN', label: 'Niedziela', shortLabel: 'Nd', icon: '⚫', color: '#1f2937' },
  { id: 'COMPLETED', label: 'Wykonane', shortLabel: 'OK', icon: '✅', color: '#059669' },
];

const JobContextMenu: React.FC<JobContextMenuProps> = ({
  job,
  onClose,
  onPaymentStatusChange,
  onMoveToColumn,
  onArchive,
  onDelete,
  isAdmin = false
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Zamknij na Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
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
    // Tło - kliknięcie zamyka modal
    <div 
      className="fixed inset-0 z-[99998] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ backdropFilter: 'blur(2px)' }}
    >
      {/* Modal na środku */}
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-[320px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ 
          animation: 'modalFadeIn 0.15s ease-out',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Nagłówek */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs opacity-70">{job.friendlyId}</div>
            <div className="text-sm font-bold truncate">
              {job.data?.jobTitle || 'Zlecenie'}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="ml-2 p-1.5 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status płatności */}
        {isAdmin && (
          <div className="p-3 border-b border-gray-100">
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-2">Status płatności</div>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_STATUSES.map((status) => {
                const isActive = currentPayment === status.value;
                return (
                  <button
                    key={status.value}
                    onClick={() => handlePaymentChange(status.value)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                      isActive ? 'ring-2 ring-offset-1 ring-slate-600 scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ 
                      background: status.bgColor, 
                      color: status.textColor 
                    }}
                  >
                    {status.label}
                    {isActive && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Przenieś do kolumny */}
        <div className="p-3 border-b border-gray-100">
          <div className="text-[10px] uppercase text-slate-400 font-bold mb-2">Przenieś do</div>
          <div className="grid grid-cols-3 gap-1.5">
            {COLUMNS.map((col) => {
              const isActive = currentColumn === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => handleMove(col.id)}
                  disabled={isActive}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5 ${
                    isActive 
                      ? 'bg-green-100 text-green-700 ring-2 ring-green-400' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-base leading-none">{col.icon}</span>
                  <span className="text-[10px] leading-tight">{col.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Akcje */}
        {isAdmin && (
          <div className="p-2 flex gap-2">
            <button 
              onClick={() => { onArchive?.(job.id); onClose(); }}
              className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Archive className="w-4 h-4" />
              Archiwizuj
            </button>
            <button 
              onClick={() => { onDelete?.(job.id); onClose(); }}
              className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Usuń
            </button>
          </div>
        )}

        {/* Dla nie-admina tylko przycisk zamknij */}
        {!isAdmin && (
          <div className="p-2">
            <button 
              onClick={onClose}
              className="w-full py-2.5 px-3 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Zamknij
            </button>
          </div>
        )}
      </div>

      {/* Animacja */}
      <style>{`
        @keyframes modalFadeIn {
          from { 
            opacity: 0; 
            transform: scale(0.95) translateY(-10px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default JobContextMenu;
