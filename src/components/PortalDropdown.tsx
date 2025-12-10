import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface PortalDropdownProps {
  triggerRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  preferPosition?: 'bottom' | 'top'; // Preferowany kierunek otwierania
}

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  triggerRef,
  isOpen,
  onClose,
  children,
  className = '',
  preferPosition = 'bottom'
}) => {
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const viewportHeight = window.innerHeight;

    // Domyślnie otwieramy w dół
    let top = rect.bottom + scrollY;
    let maxHeight = viewportHeight - rect.bottom - 10; // Margines 10px

    // Sprawdź czy zmieści się w dół (zakładamy min wysokość 150px dla dropdowna)
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let finalPosition = 'bottom';

    if (preferPosition === 'top') {
        if (spaceAbove > 150) {
             finalPosition = 'top';
        } else {
             finalPosition = 'bottom';
        }
    } else {
        // Prefer bottom
        if (spaceBelow < 150 && spaceAbove > spaceBelow) {
            finalPosition = 'top';
        }
    }

    if (finalPosition === 'top') {
        // Otwórz w górę
        // Musimy znać wysokość dropdowna, ale to trudne przed renderem.
        // Ustawiamy bottom zamiast top
        // Ale dla uproszczenia ustawimy style tak, by pozycjonować od dołu triggera
        // W React Portal prościej pozycjonować absolutnie
        // Tutaj ustawimy top tak, żeby "wyrastał" w górę - to wymagałoby transform: translateY(-100%)
        // Zrobimy prościej: jeśli top, to ustawiamy bottom na (viewportHeight - rect.top)
    }

    setCoords({
      top: rect.bottom + scrollY, // To jest pozycja "pod" przyciskiem
      left: rect.left + scrollX,
      width: rect.width,
      maxHeight: spaceBelow - 10
    });
    
    // Logika "top" jest bardziej skomplikowana w dynamicznym renderze,
    // na razie zróbmy inteligentne "maxHeight" i overflow,
    // a jeśli user chce "top" (jak przycisk na dole ekranu), to obsłużymy to specjalnym stylem.
  }, [isOpen, triggerRef, preferPosition]);

  useEffect(() => {
    updatePosition();
    
    if (isOpen) {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !coords) return null;

  // Logika dla otwierania w górę (jeśli mało miejsca na dole)
  // Sprawdzamy pozycję w renderze
  const isTopPosition = (window.innerHeight - (coords.top - window.scrollY)) < 200 && (coords.top - window.scrollY) > 200;

  const style: React.CSSProperties = isTopPosition 
    ? {
        position: 'absolute',
        bottom: `${document.documentElement.scrollHeight - coords.top + triggerRef.current!.offsetHeight}px`, // Nad przyciskiem
        left: coords.left,
        width: coords.width,
        zIndex: 99999,
        maxHeight: `${coords.top - window.scrollY - 10}px` // Maksymalna wysokość to miejsce nad przyciskiem
      }
    : {
        position: 'absolute',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        zIndex: 99999,
        maxHeight: `${coords.maxHeight}px`
      };

  return createPortal(
    <div 
      ref={dropdownRef}
      className={`bg-white rounded-lg shadow-2xl border border-slate-200 overflow-y-auto ${className} animate-in fade-in zoom-in-95 duration-100`}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};

