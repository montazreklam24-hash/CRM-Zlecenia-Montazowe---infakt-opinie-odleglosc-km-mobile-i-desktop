import React from 'react';
import { PaymentStatus } from '../types';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  amount?: number;
  paidAmount?: number;
  size?: 'sm' | 'md' | 'lg';
  showAmount?: boolean;
}

const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({ 
  status, 
  amount = 0,
  paidAmount = 0,
  size = 'sm',
  showAmount = false
}) => {
  const config: Record<PaymentStatus, { 
    bg: string; 
    text: string; 
    border: string;
    icon: string; 
    label: string;
    gradient?: string;
  }> = {
    [PaymentStatus.NONE]: { 
      bg: 'bg-slate-50', 
      text: 'text-slate-500', 
      border: 'border-slate-200',
      icon: '', 
      label: '' 
    },
    [PaymentStatus.PROFORMA]: { 
      bg: 'bg-blue-50', 
      text: 'text-blue-700', 
      border: 'border-blue-200',
      icon: '', 
      label: 'Proforma',
      gradient: 'from-blue-600 to-blue-700'
    },
    [PaymentStatus.PARTIAL]: { 
      bg: 'bg-purple-50', 
      text: 'text-purple-700', 
      border: 'border-purple-200',
      icon: '', 
      label: 'Zaliczka',
      gradient: 'from-purple-400 to-purple-500'
    },
    [PaymentStatus.PAID]: { 
      bg: 'bg-green-50', 
      text: 'text-green-700', 
      border: 'border-green-200',
      icon: '', 
      label: 'Opłacone',
      gradient: 'from-green-400 to-green-500'
    },
    [PaymentStatus.CASH]: { 
      bg: 'bg-yellow-50', 
      text: 'text-yellow-700', 
      border: 'border-yellow-200',
      icon: '', 
      label: 'Barter',
      gradient: 'from-yellow-400 to-yellow-500'
    },
    [PaymentStatus.OVERDUE]: { 
      bg: 'bg-red-50', 
      text: 'text-red-700', 
      border: 'border-red-200',
      icon: '', 
      label: 'Przeterminowane',
      gradient: 'from-red-400 to-red-500'
    }
  };

  const cfg = config[status] || config[PaymentStatus.NONE];

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  // Dla NONE pokaż "Nie wybrano"
  if (status === PaymentStatus.NONE) {
    return (
      <div className={`
        inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide
        bg-slate-100 text-slate-500 border border-slate-200
        ${sizeClasses[size]}
      `}>
        <span>Nie wybrano</span>
      </div>
    );
  }

  return (
    <div className={`
      inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide
      ${cfg.bg} ${cfg.text} border ${cfg.border}
      ${sizeClasses[size]}
    `}>
      {cfg.icon && <span>{cfg.icon}</span>}
      <span>{cfg.label}</span>
      {showAmount && amount > 0 && (
        <span className="font-normal opacity-75 ml-1">
          {paidAmount > 0 && paidAmount < amount 
            ? `${paidAmount.toFixed(0)}/${amount.toFixed(0)}` 
            : `${amount.toFixed(0)} zł`
          }
        </span>
      )}
    </div>
  );
};

// Wersja jako WYRA┼╣NY pasek na górze karty Kanban (jak w starej wersji)
// Pasek zajmuje ~8% wysokości i pokazuje etykietę statusu
export const PaymentStatusBar: React.FC<{ 
  status: PaymentStatus; 
  onClick?: (e: React.MouseEvent) => void;
  showLabel?: boolean;
}> = ({ status, onClick, showLabel = true }) => {
  const config: Record<PaymentStatus, { bg: string; label: string }> = {
    [PaymentStatus.NONE]: { bg: 'bg-gradient-to-r from-slate-300 to-slate-400', label: 'NIE WYBRANO' },
    [PaymentStatus.PROFORMA]: { bg: 'bg-gradient-to-r from-blue-600 to-blue-700', label: 'PROFORMA' },
    [PaymentStatus.PARTIAL]: { bg: 'bg-gradient-to-r from-purple-400 to-purple-500', label: 'ZALICZKA' },
    [PaymentStatus.PAID]: { bg: 'bg-gradient-to-r from-green-400 to-green-500', label: 'OPŁACONE' },
    [PaymentStatus.CASH]: { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500', label: 'GOT├ôWKA' },
    [PaymentStatus.OVERDUE]: { bg: 'bg-gradient-to-r from-red-400 to-red-500', label: 'DO ZAPŁATY' }
  };

  const cfg = config[status] || config[PaymentStatus.NONE];

  return (
    <div 
      className={`${cfg.bg} flex items-center justify-center cursor-pointer hover:brightness-110 transition-all`}
      style={{ 
        height: showLabel ? '16px' : '4px',
        minHeight: showLabel ? '14px' : '4px'
      }}
      onClick={onClick}
      title="Kliknij aby zmienić status płatności"
    >
      {showLabel && (
        <span 
          className={`font-bold uppercase tracking-wide ${status === PaymentStatus.NONE ? 'text-slate-600' : 'text-white'}`}
          style={{ fontSize: '8px', letterSpacing: '0.5px' }}
        >
          {cfg.label}
        </span>
      )}
    </div>
  );
};

// Ikona statusu (bez tekstu) - do małych kart
export const PaymentStatusIcon: React.FC<{ status: PaymentStatus; className?: string }> = ({ 
  status, 
  className = '' 
}) => {
  const icons: Record<PaymentStatus, string> = {
    [PaymentStatus.NONE]: '',
    [PaymentStatus.PROFORMA]: '',
    [PaymentStatus.PARTIAL]: '',
    [PaymentStatus.PAID]: '',
    [PaymentStatus.CASH]: '',
    [PaymentStatus.OVERDUE]: ''
  };

  if (status === PaymentStatus.NONE) {
    return null;
  }

  return icons[status] ? <span className={className}>{icons[status]}</span> : null;
};

// Mini-popup do szybkiej zmiany statusu płatności (wyświetla się przy kafelku)
export const PaymentStatusMiniMenu: React.FC<{
  currentStatus: PaymentStatus;
  onSelect: (status: PaymentStatus) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}> = ({ currentStatus, onSelect, onClose, position = 'bottom' }) => {
  const statuses: { value: PaymentStatus; label: string; bg: string }[] = [
    { value: PaymentStatus.NONE, label: 'Brak', bg: 'bg-slate-400' },
    { value: PaymentStatus.PROFORMA, label: 'Proforma', bg: 'bg-blue-600' },
    { value: PaymentStatus.PARTIAL, label: 'Zaliczka', bg: 'bg-purple-500' },
    { value: PaymentStatus.PAID, label: 'Opłacone', bg: 'bg-green-500' },
    { value: PaymentStatus.CASH, label: 'Gotówka', bg: 'bg-yellow-500' },
    { value: PaymentStatus.OVERDUE, label: 'Do zapłaty', bg: 'bg-red-500' },
  ];

  return (
    <>
      {/* Backdrop - kliknięcie zamyka */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      {/* Menu */}
      <div 
        className={`absolute ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 bg-white rounded-lg shadow-xl border border-slate-200 p-1 min-w-[140px]`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          zIndex: 1000
        }}
      >
        <div className="text-[9px] font-bold text-slate-400 uppercase px-2 py-1">Status płatności</div>
        <div className="grid grid-cols-2 gap-1">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={(e) => { e.stopPropagation(); onSelect(s.value); onClose(); }}
              className={`px-2 py-1.5 rounded text-[10px] font-bold text-white transition-all ${s.bg} ${
                currentStatus === s.value ? 'ring-2 ring-offset-1 ring-slate-600 scale-105' : 'opacity-80 hover:opacity-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default PaymentStatusBadge;












