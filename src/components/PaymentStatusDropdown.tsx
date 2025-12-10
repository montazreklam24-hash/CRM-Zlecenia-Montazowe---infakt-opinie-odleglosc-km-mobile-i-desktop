import React, { useState, useRef, useEffect } from 'react';
import { PaymentStatus } from '../types';
import { ChevronDown, Check } from 'lucide-react';

interface PaymentStatusDropdownProps {
  currentStatus: PaymentStatus;
  onStatusChange?: (status: PaymentStatus) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
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
  onStatusChange,
  disabled = false,
  size = 'small',
  showLabel = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 130 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentConfig = getPaymentStatusConfig(currentStatus);
  
  // Size classes
  const sizeClasses = {
    small: 'text-[9px] h-[18px] min-h-[18px]',
    medium: 'text-[10px] h-[22px] min-h-[22px]',
    large: 'text-xs h-[26px] min-h-[26px]'
  };

  const handleOpen = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = PAYMENT_OPTIONS.length * 36 + 8; // przybliżona wysokość
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    let top: number;
    if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
      // Pokaż poniżej
      top = rect.bottom + 4;
    } else {
      // Pokaż powyżej
      top = rect.top - dropdownHeight - 4;
    }
    
    setDropdownPos({
      top,
      left: rect.left,
      width: Math.max(rect.width, 130)
    });
    setIsOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    const handleScroll = () => {
      setIsOpen(false);
    };
    
    // Małe opóźnienie żeby uniknąć zamknięcia od tego samego kliknięcia
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', handleScroll, true);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);
  
  if (currentStatus === PaymentStatus.NONE && !showLabel) {
    return null;
  }
  
  const handleSelect = (status: PaymentStatus) => {
    onStatusChange?.(status);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) {
            if (isOpen) {
              setIsOpen(false);
            } else {
              handleOpen();
            }
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

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed z-[99999]"
          style={{ 
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
            style={{ 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}
          >
            {PAYMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: option.bgColor }}
                >
                  {currentStatus === option.value && (
                    <Check className="w-2.5 h-2.5" style={{ color: option.color }} />
                  )}
                </div>
                <span 
                  className="text-xs font-semibold"
                  style={{ color: option.value === PaymentStatus.NONE ? '#64748b' : option.bgColor }}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentStatusDropdown;
