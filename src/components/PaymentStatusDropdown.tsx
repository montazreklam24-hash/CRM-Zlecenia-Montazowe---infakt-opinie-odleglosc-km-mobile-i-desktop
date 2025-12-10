import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const currentConfig = getPaymentStatusConfig(currentStatus);
  
  // Update coords on scroll/resize to keep dropdown attached
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updateCoords = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom,
          left: rect.left,
          width: rect.width
        });
      }
    };

    updateCoords(); // Initial update

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
      // Ignore clicks on the button itself (toggle handles them)
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
        return;
      }
      // Close on any other click (including inside portal - items handle their own actions)
      // Actually, we want to allow clicks inside portal to propagate to item handlers
      // But since portal is in body, e.target will be in portal.
      // We can check if click is inside the portal content.
      const portalElement = document.getElementById(`payment-dropdown-portal-${currentStatus}`);
      if (portalElement && portalElement.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, currentStatus]);
  
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    
    if (isOpen) {
      setIsOpen(false);
    } else if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
      setIsOpen(true);
    }
  };

  const handleSelect = (newStatus: PaymentStatus) => {
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
    setIsOpen(false);
  };
  
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
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
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

      {isOpen && coords && createPortal(
        <div 
          id={`payment-dropdown-portal-${currentStatus}`}
          className="fixed z-[99999] bg-white rounded-b-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            top: coords.top + 1, // +1px gap
            left: coords.left, 
            width: coords.width,
            minWidth: '100px' // Ensure it's not too narrow
          }}
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
              className={`w-full px-2 py-2 text-[9px] font-bold hover:opacity-80 transition-all flex items-center justify-center gap-1 border-b border-slate-50 last:border-0 ${
                option.value === currentStatus ? 'ring-1 ring-inset ring-blue-500 z-10' : ''
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
        </div>,
        document.body
      )}
    </>
  );
};

export default PaymentStatusDropdown;
