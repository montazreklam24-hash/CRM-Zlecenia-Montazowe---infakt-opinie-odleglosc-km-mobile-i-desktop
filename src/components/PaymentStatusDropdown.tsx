import React, { useRef } from 'react';
import { PaymentStatus } from '../types';
import { ChevronDown } from 'lucide-react';

interface PaymentStatusDropdownProps {
  currentStatus: PaymentStatus;
  onClick?: (rect: DOMRect) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  // Legacy prop (optional now)
  onStatusChange?: (status: PaymentStatus) => void;
}

// Konfiguracja statusów płatności
export const PAYMENT_OPTIONS: { value: PaymentStatus; label: string; color: string; bgColor: string }[] = [
  { value: PaymentStatus.NONE, label: 'BRAK', color: '#64748b', bgColor: '#f1f5f9' },
  { value: PaymentStatus.PROFORMA, label: 'PROFORMA', color: '#ffffff', bgColor: '#f97316' },
  { value: PaymentStatus.PARTIAL, label: 'ZALICZKA', color: '#ffffff', bgColor: '#a855f7' },
  { value: PaymentStatus.PAID, label: 'OPŁACONE', color: '#ffffff', bgColor: '#22c55e' },
  { value: PaymentStatus.CASH, label: 'BARTER', color: '#000000', bgColor: '#eab308' },
  { value: PaymentStatus.OVERDUE, label: 'DO ZAPŁATY', color: '#ffffff', bgColor: '#ef4444' },
];

export const getPaymentStatusConfig = (status: PaymentStatus) => {
  return PAYMENT_OPTIONS.find(opt => opt.value === status) || PAYMENT_OPTIONS[0];
};

const PaymentStatusDropdown: React.FC<PaymentStatusDropdownProps> = ({ 
  currentStatus, 
  onClick,
  disabled = false,
  size = 'small',
  showLabel = true
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const currentConfig = getPaymentStatusConfig(currentStatus);
  
  // Size classes
  const sizeClasses = {
    small: 'text-[9px] h-[18px] min-h-[18px]',
    medium: 'text-[10px] h-[22px] min-h-[22px]',
    large: 'text-xs h-[26px] min-h-[26px]'
  };
  
  if (currentStatus === PaymentStatus.NONE && !showLabel) {
    return null;
  }
  
  return (
    <button
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!disabled && onClick && buttonRef.current) {
          onClick(buttonRef.current.getBoundingClientRect());
        }
      }}
      disabled={disabled}
      className={`w-full ${sizeClasses[size]} font-bold flex items-center justify-center gap-0.5 transition-all ${disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-90'}`}
      style={{ 
        background: currentConfig.bgColor, 
        color: currentConfig.color,
        letterSpacing: '0.5px'
      }}
      title={disabled ? currentConfig.label : 'Kliknij aby zmienić status płatności'}
    >
      {showLabel && currentConfig.label}
      {!disabled && <ChevronDown className="w-2.5 h-2.5" style={{ marginLeft: '2px' }} />}
    </button>
  );
};

export default PaymentStatusDropdown;
