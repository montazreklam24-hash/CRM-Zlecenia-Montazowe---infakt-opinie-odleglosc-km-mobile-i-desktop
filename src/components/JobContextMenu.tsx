import React, { useEffect, useRef } from 'react';
import { Job, JobColumnId, PaymentStatus } from '../types';
import { Trash2, Archive, Calendar, CreditCard, ArrowRight } from 'lucide-react';

interface JobContextMenuProps {
  job: Job;
  x: number;
  y: number;
  onClose: () => void;
  onPaymentStatusChange?: (jobId: string, status: PaymentStatus) => void;
  onMoveToColumn?: (jobId: string, columnId: JobColumnId) => void;
  onArchive?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
  isAdmin?: boolean;
}

// Statusy płatności
const PAYMENT_STATUSES: { value: PaymentStatus; label: string; color: string; icon: string }[] = [
  { value: PaymentStatus.NONE, label: 'Brak', color: '#64748b', icon: '⚪' },
  { value: PaymentStatus.PROFORMA, label: 'Proforma', color: '#f97316', icon: '🟠' },
  { value: PaymentStatus.PARTIAL, label: 'Zaliczka', color: '#a855f7', icon: '🟣' },
  { value: PaymentStatus.PAID, label: 'Opłacone', color: '#22c55e', icon: '🟢' },
  { value: PaymentStatus.CASH, label: 'Barter', color: '#eab308', icon: '🟡' },
  { value: PaymentStatus.OVERDUE, label: 'Do zapłaty', color: '#ef4444', icon: '🔴' },
];

// Kolumny/dni
const COLUMNS: { id: JobColumnId; label: string; icon: string }[] = [
  { id: 'PREPARE', label: 'Do przygotowania', icon: '📋' },
  { id: 'MON', label: 'Poniedziałek', icon: '🔴' },
  { id: 'TUE', label: 'Wtorek', icon: '🟢' },
  { id: 'WED', label: 'Środa', icon: '🟣' },
  { id: 'THU', label: 'Czwartek', icon: '🟡' },
  { id: 'FRI', label: 'Piątek', icon: '🔵' },
  { id: 'SAT', label: 'Sobota', icon: '⚪' },
  { id: 'SUN', label: 'Niedziela', icon: '⚫' },
  { id: 'COMPLETED', label: 'Wykonane', icon: '✅' },
];

const JobContextMenu: React.FC<JobContextMenuProps> = ({
  job,
  x,
  y,
  onClose,
  onPaymentStatusChange,
  onMoveToColumn,
  onArchive,
  onDelete,
  isAdmin = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = React.useState<'payment' | 'move' | null>(null);

  // Pozycja jest już w clientX/clientY (względem viewport)
  // position: fixed używa tych samych współrzędnych
  const menuWidth = 200;
  const menuHeight = 280;
  
  // Korekta pozycji żeby menu nie wychodziło poza ekran
  let posX = x;
  let posY = y;
  
  // Jeśli wychodzi za prawą krawędź
  if (x + menuWidth > window.innerWidth) {
    posX = x - menuWidth;
  }
  
  // Jeśli wychodzi za dolną krawędź
  if (y + menuHeight > window.innerHeight) {
    posY = y - menuHeight;
  }
  
  // Minimalne marginesy od krawędzi
  posX = Math.max(10, posX);
  posY = Math.max(10, posY);

  // Zamknij na kliknięcie poza menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    const handleScroll = () => onClose();
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
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

  return (
    <div 
      ref={menuRef}
      className="fixed z-[99999] bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[200px]"
      style={{ 
        left: posX, 
        top: posY,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header z ID zlecenia */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-bold text-gray-500">{job.friendlyId}</span>
        <div className="text-sm font-semibold text-gray-800 truncate max-w-[180px]">
          {job.data.jobTitle}
        </div>
      </div>

      {/* Status płatności */}
      <div 
        className="relative"
        onMouseEnter={() => setSubmenu('payment')}
        onMouseLeave={() => setSubmenu(null)}
      >
        <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-500" />
          <span>Status płatności</span>
          <ArrowRight className="w-3 h-3 ml-auto text-gray-400" />
        </button>
        
        {/* Submenu płatności */}
        {submenu === 'payment' && (
          <div 
            className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
            style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
          >
            {PAYMENT_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => handlePaymentChange(status.value)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                  currentPayment === status.value ? 'bg-blue-50' : ''
                }`}
              >
                <span>{status.icon}</span>
                <span style={{ color: status.color, fontWeight: currentPayment === status.value ? 700 : 500 }}>
                  {status.label}
                </span>
                {currentPayment === status.value && (
                  <span className="ml-auto text-blue-500">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Przenieś do */}
      <div 
        className="relative"
        onMouseEnter={() => setSubmenu('move')}
        onMouseLeave={() => setSubmenu(null)}
      >
        <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>Przenieś do...</span>
          <ArrowRight className="w-3 h-3 ml-auto text-gray-400" />
        </button>
        
        {/* Submenu kolumn */}
        {submenu === 'move' && (
          <div 
            className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] max-h-[300px] overflow-y-auto"
            style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
          >
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                onClick={() => handleMove(col.id)}
                disabled={currentColumn === col.id}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                  currentColumn === col.id ? 'bg-gray-100 text-gray-400' : ''
                }`}
              >
                <span>{col.icon}</span>
                <span className={currentColumn === col.id ? 'text-gray-400' : ''}>
                  {col.label}
                </span>
                {currentColumn === col.id && (
                  <span className="ml-auto text-green-500">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 my-1" />

      {/* Archiwizuj */}
      {isAdmin && (
        <button 
          onClick={() => { onArchive?.(job.id); onClose(); }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
        >
          <Archive className="w-4 h-4 text-gray-500" />
          <span>Archiwizuj</span>
        </button>
      )}

      {/* Usuń */}
      {isAdmin && (
        <button 
          onClick={() => { onDelete?.(job.id); onClose(); }}
          className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Usuń zlecenie</span>
        </button>
      )}
    </div>
  );
};

export default JobContextMenu;

