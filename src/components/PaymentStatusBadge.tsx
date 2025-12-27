import React from 'react';
import { PaymentStatus } from '../types';
import { PAYMENT_STATUS_CONFIG, PAYMENT_STATUS_LIST, getPaymentStatusConfig } from '../constants/paymentStatus';

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
  const cfg = getPaymentStatusConfig(status);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  // Dla NONE pokaż "Brak"
  if (status === PaymentStatus.NONE) {
    return (
      <div className={`
        inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide
        bg-slate-100 text-slate-500 border border-slate-200
        ${sizeClasses[size]}
      `}>
        <span>Brak</span>
      </div>
    );
  }

  return (
    <div className={`
      inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide
      ${cfg.bgClass} ${cfg.textClass} border ${cfg.borderClass}
      ${sizeClasses[size]}
    `}>
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
  const cfg = getPaymentStatusConfig(status);

  return (
    <div 
      className={`bg-gradient-to-r ${cfg.gradient} flex items-center justify-center cursor-pointer hover:brightness-110 transition-all`}
      style={{ 
        height: showLabel ? '25px' : '4px',
        minHeight: showLabel ? '25px' : '4px'
      }}
      onClick={onClick}
      title="Kliknij aby zmienić status płatności"
    >
      {showLabel && (
        <span 
          className={`font-bold uppercase tracking-wide ${status === PaymentStatus.NONE ? 'text-slate-600' : 'text-white'}`}
          style={{ fontSize: '10px', letterSpacing: '0.5px' }}
        >
          {cfg.label.toUpperCase()}
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
          {PAYMENT_STATUS_LIST.map((cfg) => (
            <button
              key={cfg.value}
              onClick={(e) => { e.stopPropagation(); onSelect(cfg.value); onClose(); }}
              className={`px-2 py-1.5 rounded text-[10px] font-bold transition-all ${
                currentStatus === cfg.value ? 'ring-2 ring-offset-1 ring-slate-600 scale-105' : 'opacity-80 hover:opacity-100'
              }`}
              style={{ 
                background: cfg.color, 
                color: '#fff' 
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default PaymentStatusBadge;












