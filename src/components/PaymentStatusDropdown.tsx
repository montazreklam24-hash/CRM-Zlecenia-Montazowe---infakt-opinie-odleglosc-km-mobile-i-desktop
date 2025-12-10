import React, { useState, useRef, useEffect } from 'react';
import { PaymentStatus } from '../types';
import { ChevronDown } from 'lucide-react';

interface PaymentStatusDropdownProps {
  currentStatus: PaymentStatus;
  onStatusChange: (status: PaymentStatus) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

// Konfiguracja statusów płatności
const PAYMENT_OPTIONS: { value: PaymentStatus; label: string; color: string; bgColor: string }[] = [
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
  onStatusChange, 
  disabled = false,
  size = 'small',
  showLabel = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentConfig = getPaymentStatusConfig(currentStatus);
  
  // Zamknij dropdown gdy kliknięto poza
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (newStatus: PaymentStatus) => {
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
    setIsOpen(false);
  };
  
  // Size classes - zwiększone rozmiary
  const sizeClasses = {
    small: 'text-[9px] h-[18px] min-h-[18px]',
    medium: 'text-[10px] h-[22px] min-h-[22px]',
    large: 'text-xs h-[26px] min-h-[26px]'
  };
  
  // Jeśli status to NONE i nie chcemy pokazywać - pokaż pusty
  if (currentStatus === PaymentStatus.NONE && !showLabel) {
    return null;
  }
  
  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Przycisk główny - pasek statusu */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) setIsOpen(!isOpen);
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
      
      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-0.5 bg-white rounded-b-lg shadow-xl border border-slate-200 z-50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSelect(option.value);
              }}
              className={`w-full px-2 py-1.5 text-[9px] font-bold hover:opacity-80 transition-all flex items-center justify-center gap-1 ${
                option.value === currentStatus ? 'ring-1 ring-inset ring-blue-500' : ''
              }`}
              style={{ 
                background: option.bgColor, 
                color: option.color 
              }}
            >
              {option.label}
              {option.value === currentStatus && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentStatusDropdown;
