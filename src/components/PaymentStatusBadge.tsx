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
      bg: 'bg-orange-50', 
      text: 'text-orange-700', 
      border: 'border-orange-200',
      icon: '📄', 
      label: 'Proforma',
      gradient: 'from-orange-400 to-orange-500'
    },
    [PaymentStatus.INVOICE]: { 
      bg: 'bg-blue-50', 
      text: 'text-blue-700', 
      border: 'border-blue-200',
      icon: '📋', 
      label: 'Faktura',
      gradient: 'from-blue-400 to-blue-500'
    },
    [PaymentStatus.PARTIAL]: { 
      bg: 'bg-purple-50', 
      text: 'text-purple-700', 
      border: 'border-purple-200',
      icon: '💸', 
      label: 'Zaliczka',
      gradient: 'from-purple-400 to-purple-500'
    },
    [PaymentStatus.PAID]: { 
      bg: 'bg-green-50', 
      text: 'text-green-700', 
      border: 'border-green-200',
      icon: '✅', 
      label: 'Opłacone',
      gradient: 'from-green-400 to-green-500'
    },
    [PaymentStatus.CASH]: { 
      bg: 'bg-yellow-50', 
      text: 'text-yellow-700', 
      border: 'border-yellow-200',
      icon: '💵', 
      label: 'Gotówka',
      gradient: 'from-yellow-400 to-yellow-500'
    },
    [PaymentStatus.OVERDUE]: { 
      bg: 'bg-red-50', 
      text: 'text-red-700', 
      border: 'border-red-200',
      icon: '⚠️', 
      label: 'Przeterminowane',
      gradient: 'from-red-400 to-red-500'
    }
  };

  const cfg = config[status] || config[PaymentStatus.NONE];

  // Nie pokazuj nic dla NONE
  if (status === PaymentStatus.NONE) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  return (
    <div className={`
      inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide
      ${cfg.bg} ${cfg.text} border ${cfg.border}
      ${sizeClasses[size]}
    `}>
      <span>{cfg.icon}</span>
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

// Wersja jako pasek na górze karty Kanban
export const PaymentStatusBar: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const colors: Record<PaymentStatus, string> = {
    [PaymentStatus.NONE]: '',
    [PaymentStatus.PROFORMA]: 'bg-gradient-to-r from-orange-400 to-orange-500',
    [PaymentStatus.INVOICE]: 'bg-gradient-to-r from-blue-400 to-blue-500',
    [PaymentStatus.PARTIAL]: 'bg-gradient-to-r from-purple-400 to-purple-500',
    [PaymentStatus.PAID]: 'bg-gradient-to-r from-green-400 to-green-500',
    [PaymentStatus.CASH]: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
    [PaymentStatus.OVERDUE]: 'bg-gradient-to-r from-red-400 to-red-500'
  };

  if (status === PaymentStatus.NONE) {
    return null;
  }

  return (
    <div className={`absolute top-0 left-0 right-0 h-1 ${colors[status]} rounded-t-xl`} />
  );
};

// Ikona statusu (bez tekstu) - do małych kart
export const PaymentStatusIcon: React.FC<{ status: PaymentStatus; className?: string }> = ({ 
  status, 
  className = '' 
}) => {
  const icons: Record<PaymentStatus, string> = {
    [PaymentStatus.NONE]: '',
    [PaymentStatus.PROFORMA]: '📄',
    [PaymentStatus.INVOICE]: '📋',
    [PaymentStatus.PARTIAL]: '💸',
    [PaymentStatus.PAID]: '✅',
    [PaymentStatus.CASH]: '💵',
    [PaymentStatus.OVERDUE]: '⚠️'
  };

  if (status === PaymentStatus.NONE) {
    return null;
  }

  return <span className={className}>{icons[status]}</span>;
};

export default PaymentStatusBadge;

