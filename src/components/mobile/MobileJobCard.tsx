import React, { useState } from 'react';
import { Job, JobColumnId, PaymentStatus } from '../../types';
import { getJobThumbnailUrl } from '../../utils/imageUtils';
import { 
  MapPin, Phone, ChevronUp, ChevronDown, 
  MoreVertical, Trash2, Copy, Archive, Navigation
} from 'lucide-react';
import JobPlaceholder from '../JobPlaceholder';

import { getPaymentStatusConfig } from '../../constants/paymentStatus';

// Helper function for payment status color
const getPaymentStatusColor = (status: PaymentStatus): string => {
  return getPaymentStatusConfig(status).color;
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  return getPaymentStatusConfig(status).label.toUpperCase();
};

// ROWS_CONFIG for move menu
const MOBILE_COLUMNS: { id: JobColumnId; title: string; color: string }[] = [
  { id: 'PREPARE', title: 'Do przygotowania', color: '#475569' },
  { id: 'MON', title: 'Poniedziałek', color: '#f43f5e' },
  { id: 'TUE', title: 'Wtorek', color: '#10b981' },
  { id: 'WED', title: 'Środa', color: '#8b5cf6' },
  { id: 'THU', title: 'Czwartek', color: '#f59e0b' },
  { id: 'FRI', title: 'Piątek', color: '#3b82f6' },
  { id: 'COMPLETED', title: 'Ukończone', color: '#16a34a' },
];

// Helper for address formatting (no postal code)
const formatMobileAddress = (address: string | undefined): { street: string; city: string } => {
  if (!address) return { street: 'Brak adresu', city: '' };
  
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const street = parts[0];
    // Remove postal code XX-XXX from city
    let city = parts[1].replace(/\d{2}-\d{3}\s*/g, '').trim();
    if (!city && parts[2]) {
      city = parts[2].replace(/\d{2}-\d{3}\s*/g, '').trim();
    }
    return { street, city };
  }
  
  return { street: address, city: '' };
};

// Helper for phone formatting
const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');
  const match = cleaned.match(/^(\+48)?(\d{9})$/);
  if (match) {
    const prefix = match[1] ? '+48 ' : '';
    const num = match[2];
    return `${prefix}${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 9)}`;
  }
  return phone;
};

interface MobileJobCardProps {
  job: Job;
  onOpen: (job: Job) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToColumn?: (columnId: JobColumnId) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isAdmin?: boolean;
}

const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  onOpen,
  onMoveUp,
  onMoveDown,
  onMoveToColumn,
  onDelete,
  onDuplicate,
  onArchive,
  canMoveUp = true,
  canMoveDown = true,
  isAdmin = true,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const paymentColor = getPaymentStatusColor(job.paymentStatus || PaymentStatus.NONE);
  const paymentLabel = getPaymentStatusLabel(job.paymentStatus || PaymentStatus.NONE);
  const { street, city } = formatMobileAddress(job.data.address);
  const phoneFormatted = formatPhoneNumber(job.data.phoneNumber);

  // Format scheduled date
  const scheduledDateFormatted = job.data.scheduledDate ? new Date(job.data.scheduledDate).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) : null;

  const handleCardTap = () => {
    if (showMoveMenu) {
      setShowMoveMenu(false);
      return;
    }
    onOpen(job);
  };

  return (
    <div 
      className="relative bg-white rounded-2xl shadow-md overflow-hidden border border-slate-100"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Payment Status Bar */}
      <div 
        className="h-2 w-full"
        style={{ background: paymentColor }}
      />

      <div className="flex">
        {/* Left: Thumbnail */}
        <div 
          className="w-24 h-24 flex-shrink-0 bg-slate-100 relative overflow-hidden"
          onClick={handleCardTap}
        >
          {job.projectImages?.[0] ? (
            <img 
              src={getJobThumbnailUrl(job.projectImages[0])} 
              loading="lazy" 
              className="w-full h-full object-cover" 
              alt="" 
            />
          ) : (
            <JobPlaceholder job={job} size="medium" />
          )}
          {/* Job ID */}
          <div className="absolute bottom-1 left-1 text-[8px] font-bold bg-black/60 text-white px-1 py-0.5 rounded">
            {job.friendlyId}
          </div>
        </div>

        {/* Middle: Content */}
        <div className="flex-1 p-3 min-w-0" onClick={handleCardTap}>
          {/* Title */}
          <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-tight mb-1">
            {job.data.jobTitle || 'Bez nazwy'}
          </h3>

          {/* Scheduled Date */}
          {scheduledDateFormatted && (
            <div className="text-xs font-black text-black mb-1 capitalize leading-tight">
              {scheduledDateFormatted}
            </div>
          )}
          
          {/* Address - prominent */}
          <div className="text-xs text-slate-600 mb-1">
            <div className="font-semibold truncate">{street}</div>
            {city && <div className="text-slate-400 truncate">{city}</div>}
          </div>

          {/* Payment Status Label */}
          {paymentLabel && (
            <span 
              className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
              style={{ background: paymentColor }}
            >
              {paymentLabel}
            </span>
          )}
        </div>

        {/* Right: Actions Column */}
        <div className="flex flex-col justify-between py-2 pr-2 gap-1">
          {/* Up/Down arrows */}
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={!canMoveUp}
            className={`p-2 rounded-lg transition-all ${canMoveUp ? 'bg-orange-100 text-orange-600 active:scale-95' : 'bg-slate-100 text-slate-300'}`}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          
          {/* Move to column button */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowMoveMenu(!showMoveMenu);
            }}
            className="p-2 bg-slate-100 text-slate-600 rounded-lg active:scale-95"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={!canMoveDown}
            className={`p-2 rounded-lg transition-all ${canMoveDown ? 'bg-orange-100 text-orange-600 active:scale-95' : 'bg-slate-100 text-slate-300'}`}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Action Bar - Navigation & Phone */}
      <div className="flex border-t border-slate-100">
        {/* Navigate Button */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.data.address || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-50 text-orange-700 font-bold text-sm active:bg-orange-100 border-r border-slate-100"
        >
          <Navigation className="w-5 h-5" />
          NAWIGUJ
        </a>
        
        {/* Phone Button */}
        {job.data.phoneNumber ? (
          <a
            href={`tel:${job.data.phoneNumber}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-50 text-green-700 font-bold text-sm active:bg-green-100"
          >
            <Phone className="w-5 h-5" />
            {phoneFormatted}
          </a>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-400 text-sm">
            <Phone className="w-5 h-5" />
            Brak telefonu
          </div>
        )}
      </div>

      {/* Move To Column Menu */}
      {showMoveMenu && (
        <div 
          className="absolute top-12 right-12 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 min-w-[180px] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 border-b border-slate-100 mb-1">
            Przenieś do
          </div>
          {MOBILE_COLUMNS
            .filter(col => col.id !== (job.columnId || 'PREPARE'))
            .map(col => (
              <button
                key={col.id}
                onClick={() => {
                  onMoveToColumn?.(col.id);
                  setShowMoveMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-medium text-slate-700 flex items-center gap-2"
              >
                <span 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: col.color }}
                />
                {col.title}
              </button>
            ))}
          
          {isAdmin && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => { onDuplicate?.(); setShowMoveMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-medium text-orange-600 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Duplikuj
              </button>
              <button
                onClick={() => { onArchive?.(); setShowMoveMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-medium text-slate-600 flex items-center gap-2"
              >
                <Archive className="w-4 h-4" />
                Archiwizuj
              </button>
              <button
                onClick={() => { onDelete?.(); setShowMoveMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 active:bg-orange-100 text-sm font-medium text-orange-600 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Usuń
              </button>
            </>
          )}
        </div>
      )}

      {/* Backdrop to close menu */}
      {showMoveMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowMoveMenu(false)}
        />
      )}
    </div>
  );
};

export default MobileJobCard;
