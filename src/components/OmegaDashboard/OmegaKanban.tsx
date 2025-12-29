import React, { useState } from 'react';
import { 
  Job, JobStatus, JobColumnId, PaymentStatus 
} from '../../types';
import { 
  Plus, MapPin, CheckCircle2, Trash2, Box, 
  Copy, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  Archive, ImageIcon 
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useDeviceType } from '../../hooks/useDeviceType';
import { getJobThumbnailUrl } from '../../utils/imageUtils';
import PaymentStatusBadge, { PaymentStatusBar, PaymentStatusMiniMenu } from '../PaymentStatusBadge';
import JobPlaceholder from '../JobPlaceholder';

// --- CONSTANTS & HELPERS ---

const BASE_COORDS = { lat: 52.237049, lng: 21.017532 }; // Centrum Warszawy jako fallback

const MOVE_COLUMNS: { id: JobColumnId; label: string; shortLabel: string; icon: string }[] = [
  { id: 'PREPARE', label: 'Przygotowanie', shortLabel: 'PRZYG', icon: '📦' },
  { id: 'MON', label: 'Poniedziałek', shortLabel: 'PON', icon: '📅' },
  { id: 'TUE', label: 'Wtorek', shortLabel: 'WT', icon: '📅' },
  { id: 'WED', label: 'Środa', shortLabel: 'ŚR', icon: '📅' },
  { id: 'THU', label: 'Czwartek', shortLabel: 'CZW', icon: '📅' },
  { id: 'FRI', label: 'Piątek', shortLabel: 'PT', icon: '📅' },
  { id: 'SAT', label: 'Sobota', shortLabel: 'SB', icon: '📅' },
  { id: 'SUN', label: 'Niedziela', shortLabel: 'ND', icon: '📅' },
  { id: 'COMPLETED', label: 'Wykonane', shortLabel: 'WYK', icon: '✅' },
];

const getPaymentStatusColor = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID: return 'text-green-600';
    case PaymentStatus.PROFORMA: return 'text-orange-500';
    case PaymentStatus.CASH: return 'text-blue-600';
    default: return 'text-slate-400';
  }
};

const getPaymentStatusLabel = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID: return 'Opłacone';
    case PaymentStatus.PROFORMA: return 'Proforma';
    case PaymentStatus.CASH: return 'Gotówka';
    default: return 'Nieopłacone';
  }
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; // Distance in km
  return d;
};

const formatPhoneNumber = (phone: string) => {
  const cleaned = ('' + phone).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{3})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return phone;
};

const parseAddressForNav = (address?: string) => {
  if (!address) return { street: 'Brak adresu', city: '' };
  const parts = address.split(',');
  const street = parts[0]?.trim() || 'Brak adresu';
  const city = parts[1]?.trim() || '';
  return { street, city };
};

// --- COMPONENTS ---

interface DraggableJobCardProps {
  job: Job;
  isAdmin: boolean;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  onDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  onDuplicate: (id: string, e?: React.MouseEvent) => Promise<void>;
  onArchive?: (id: string, e?: React.MouseEvent) => Promise<void>;
  onPaymentStatusChange?: (id: string, status: PaymentStatus) => Promise<void>;
  onMoveToColumn?: (id: string, columnId: JobColumnId) => Promise<void>;
  onMoveLeft?: (id: string) => void;
  onMoveRight?: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onContextMenu?: (e: React.MouseEvent, job: Job) => void;
  matchesFilter?: boolean;
}

const DraggableJobCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive, 
  onPaymentStatusChange, onMoveToColumn, onMoveLeft, onMoveRight, 
  onMoveUp, onMoveDown, canMoveLeft, canMoveRight, canMoveUp, canMoveDown,
  onContextMenu, matchesFilter 
}) => {
  // Use unique ID for dragging to avoid issues with duplicates
  const uniqueDragId = `${job.id}-${job.createdAt}`;
  
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: uniqueDragId,
    data: { jobId: job.id }
  });
  
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `card-${uniqueDragId}`,
    data: { type: 'card', jobId: job.id }
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const showDropIndicator = isDropOver && !isDragging;
  const isTouchDevice = useDeviceType().isTouchDevice;
  const [showClickHint, setShowClickHint] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const distance = job.data.coordinates 
    ? calculateDistance(BASE_COORDS.lat, BASE_COORDS.lng, job.data.coordinates.lat, job.data.coordinates.lng)
    : null;
  const addressParts = parseAddressForNav(job.data.address);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : (matchesFilter ? 1 : 0.3),
    zIndex: isDragging ? 9999 : 'auto',
    filter: matchesFilter ? 'none' : 'grayscale(60%) blur(0.5px)',
    transition: 'all 0.3s ease-in-out',
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    if (isTouchDevice) {
      setShowClickHint(true);
      setTimeout(() => setShowClickHint(false), 1500);
      return;
    }
    setShowClickHint(true);
    setTimeout(() => setShowClickHint(false), 1500);
  };

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    setShowClickHint(false);
    onSelectJob(job);
  };

  const currentColumnId = job.columnId || 'PREPARE';
  const createdDate = job.createdAt ? new Date(job.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : null;
  const scheduledDateFormatted = job.data.scheduledDate ? new Date(job.data.scheduledDate).toLocaleDateString('pl-PL', { weekday: 'long' }) : null;

  return (
    <>
      {showDropIndicator && (
        <div 
          className="min-w-[160px] w-full h-full min-h-[280px] rounded-lg border-dashed animate-pulse flex items-center justify-center"
          style={{ borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)', borderWidth: '3px' }}
        >
          <span className="text-xs text-blue-500 font-bold">↓ TUTAJ ↓</span>
        </div>
      )}
      <div 
        className={`relative group h-full transition-all duration-300 ${!matchesFilter ? 'opacity-40 grayscale-[60%]' : 'opacity-100'}`}
      >
        {(canMoveLeft || canMoveLeft === false) && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveLeft) onMoveLeft?.(job.id); }}
            disabled={!canMoveLeft}
            className={`absolute top-1/2 -left-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-50 hover:!opacity-100 ${
              canMoveLeft 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-125 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {(canMoveRight || canMoveRight === false) && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveRight) onMoveRight?.(job.id); }}
            disabled={!canMoveRight}
            className={`absolute top-1/2 -right-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-50 hover:!opacity-100 ${
              canMoveRight 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-125 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {canMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(job.id); }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-125 transition-all opacity-0 group-hover:opacity-50 hover:!opacity-100"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}

        {canMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(job.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-125 transition-all opacity-0 group-hover:opacity-50 hover:!opacity-100"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        <div 
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onClick={handleCardClick}
          onDoubleClick={handleCardDoubleClick}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu?.(e, job);
          }}
          className={`theme-card min-w-[160px] w-full min-h-[280px] h-full cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group relative flex flex-col overflow-visible touch-none ${showDropIndicator ? 'ring-2 ring-blue-400' : ''}`}
        >
          {showClickHint && (
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-3 py-2 text-xs font-medium whitespace-nowrap animate-fade-in pointer-events-none"
              style={{ 
                background: 'rgba(0,0,0,0.85)', 
                color: 'white', 
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              👆 Kliknij dwukrotnie aby otworzyć
            </div>
          )}
          <div className="relative">
            <PaymentStatusBar
              status={job.paymentStatus || PaymentStatus.NONE}
              onClick={(e) => { e.stopPropagation(); setShowPaymentMenu(!showPaymentMenu); }}
              showLabel={true}
            />
            {showPaymentMenu && (
              <PaymentStatusMiniMenu
                currentStatus={job.paymentStatus || PaymentStatus.NONE}
                onSelect={(status) => onPaymentStatusChange?.(job.id, status)}
                onClose={() => setShowPaymentMenu(false)}
                position="bottom"
              />
            )}
          </div>
          <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            {job.projectImages?.[0] ? (
              <img src={getJobThumbnailUrl(job.projectImages[0])} className="w-full h-full object-cover pointer-events-none" alt="preview" loading="lazy" />
            ) : (
              <JobPlaceholder job={job} size="medium" />
            )}
            <div 
              className="absolute bottom-2 right-2 text-[9px] font-medium px-1.5 py-0.5 backdrop-blur-sm" 
              style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius-sm)' }}
            >
              {job.friendlyId}
            </div>
          </div>
          <div className="p-3 flex flex-col flex-1">
            <h4 className="font-bold text-xs leading-tight mb-1 line-clamp-3" style={{ color: 'var(--text-primary)' }}>
              {job.data.jobTitle}
            </h4>
            {job.data.scheduledDate && (
              <div className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium mb-1 flex items-center gap-1 w-fit">
                📅 {new Date(job.data.scheduledDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                {job.data.timeSlotStart && (
                  <span className="text-blue-500">
                    {job.data.timeSlotStart}{job.data.timeSlotEnd && `-${job.data.timeSlotEnd}`}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5 mb-2 mt-auto">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.data.address || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-start gap-2 pl-2 pr-1 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs border border-blue-200 w-full"
                style={{ minHeight: '40px' }}
              >
                <MapPin className="w-4 h-4 flex-shrink-0 text-blue-600" />
                <div className="flex flex-col min-w-0 leading-tight text-left">
                  <span className="font-bold truncate text-[11px]">{addressParts.street}</span>
                  <span className="text-[9px] text-blue-600/80 truncate font-medium">
                    {addressParts.city}{distance !== null && ` • ${distance.toFixed(1)} km`}
                  </span>
                </div>
              </a>
              {job.data.phoneNumber && (
                <a 
                  href={`tel:${job.data.phoneNumber}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-start gap-2 pl-3 pr-2 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs font-bold w-full border border-green-200"
                  style={{ minHeight: '36px' }}
                >
                  <span className="text-[9px] flex-shrink-0">📞</span>
                  <span className="truncate">{formatPhoneNumber(job.data.phoneNumber)}</span>
                </a>
              )}
            </div>
            {scheduledDateFormatted && (
              <div className="mt-2 text-sm font-black text-black leading-tight capitalize">
                {scheduledDateFormatted}
              </div>
            )}
            <div className="flex justify-between items-center pt-2 mt-auto" style={{ borderTop: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                {createdDate && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{createdDate}</span>}
                {job.totalGross && job.totalGross > 0 ? (() => {
                  const isVisible = isAdmin || job.paymentStatus === PaymentStatus.CASH || job.paymentStatus === PaymentStatus.PARTIAL;
                  if (!isVisible) return <span className="text-[10px] text-slate-300 font-medium">*** zł</span>;
                  
                  return (
                    <div className="flex flex-col items-end leading-none">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                          {job.totalGross.toFixed(0)} zł
                        </span>
                        {job.priceSource === 'ai' ? (
                          <span title="Wycena szacunkowa z maila" className="text-[10px]">✉️</span>
                        ) : (
                          <span title="Wycena potwierdzona dokumentem" className="text-[10px]">📄</span>
                        )}
                      </div>
                      {isAdmin && job.totalNet && job.totalNet > 0 && (
                        <span className="text-[8px] text-slate-400 font-medium">
                          ({job.totalNet.toFixed(0)} netto)
                        </span>
                      )}
                    </div>
                  );
                })() : null}
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onDuplicate(job.id, e); }} className="p-1 hover:bg-slate-100 rounded" style={{ color: 'var(--accent-primary)' }}><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); onArchive?.(job.id, e); }} className="p-1 hover:bg-slate-100 rounded" style={{ color: 'var(--text-secondary)' }}><Archive className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} className="p-1 hover:text-blue-500 hover:bg-slate-100 rounded" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Przenieś do</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} />
              </div>
              {showMoveMenu && (
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {MOVE_COLUMNS.map((col) => {
                    const isActive = currentColumnId === col.id;
                    return (
                      <button
                        key={col.id}
                        onClick={(e) => { e.stopPropagation(); if (!isActive) onMoveToColumn?.(job.id, col.id); setShowMoveMenu(false); }}
                        disabled={isActive}
                        className={`px-1 py-1 rounded text-[8px] font-bold transition-all flex flex-col items-center ${isActive ? 'bg-green-100 text-green-700 ring-1 ring-green-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                      >
                        <span className="text-[10px]">{col.icon}</span>
                        <span>{col.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const DroppableRow: React.FC<{ id: JobColumnId; children: React.ReactNode; activeId?: string | null }> = ({ id, children, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`p-5 transition-all overflow-visible ${isOver && activeId ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`} style={{ background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)', backdropFilter: 'var(--blur)' }}>
      <div className="grid gap-8 min-h-[180px] items-stretch overflow-visible px-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gridAutoRows: 'minmax(280px, auto)' }}>
        {children}
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<{ id: JobColumnId; children: React.ReactNode; activeId?: string | null }> = ({ id, children, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`p-3 min-h-[400px] flex-1 transition-all flex flex-col overflow-visible ${isOver && activeId ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`} style={{ background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)', backdropFilter: 'var(--blur)' }}>
      {children}
    </div>
  );
};

const SmallKanbanCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown, 
  onMoveLeft, onMoveRight, canMoveLeft, canMoveRight,
  onContextMenu, onPaymentStatusChange, onMoveToColumn, matchesFilter
}) => {
  const uniqueDragId = `${job.id}-${job.createdAt}`;
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: uniqueDragId, data: { jobId: job.id } });
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({ id: `card-${uniqueDragId}`, data: { type: 'card', jobId: job.id } });
  const setNodeRef = (node: HTMLElement | null) => { setDragRef(node); setDropRef(node); };
  const showDropIndicator = isDropOver && !isDragging;
  const isTouchDevice = useDeviceType().isTouchDevice;
  const [showClickHint, setShowClickHint] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : (matchesFilter ? 1 : 0.3),
    zIndex: isDragging ? 9999 : 'auto',
    filter: matchesFilter ? 'none' : 'grayscale(60%) blur(0.5px)',
    transition: 'all 0.3s ease-in-out',
  };
  const handleCardDoubleClick = () => { if (isDragging) return; setShowClickHint(false); onSelectJob(job); };
  const currentColumnId = job.columnId || 'PREPARE';

  return (
    <>
      {showDropIndicator && (
        <div className="w-full h-12 mb-2 rounded-lg border-dashed animate-pulse flex items-center justify-center" style={{ borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)', borderWidth: '3px' }}>
          <span className="text-[10px] text-blue-500 font-bold">↓ TUTAJ ↓</span>
        </div>
      )}
      <div className={`relative group ${!matchesFilter ? 'opacity-40 grayscale-[60%]' : 'opacity-100'} transition-all duration-300`}>
        {canMoveUp && <button onClick={(e) => { e.stopPropagation(); onMoveUp?.(job.id); }} className="absolute -top-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all opacity-0 group-hover:opacity-100"><ChevronUp className="w-5 h-5" /></button>}
        {canMoveDown && <button onClick={(e) => { e.stopPropagation(); onMoveDown?.(job.id); }} className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all opacity-0 group-hover:opacity-100"><ChevronDown className="w-5 h-5" /></button>}
        {(canMoveLeft || canMoveLeft === false) && <button onClick={(e) => { e.stopPropagation(); if (canMoveLeft) onMoveLeft?.(job.id); }} disabled={!canMoveLeft} className={`absolute top-1/2 -left-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 ${canMoveLeft ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}><ChevronLeft className="w-5 h-5" /></button>}
        {(canMoveRight || canMoveRight === false) && <button onClick={(e) => { e.stopPropagation(); if (canMoveRight) onMoveRight?.(job.id); }} disabled={!canMoveRight} className={`absolute top-1/2 -right-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 ${canMoveRight ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}><ChevronRight className="w-5 h-5" /></button>}
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} onDoubleClick={handleCardDoubleClick} className={`theme-card cursor-grab active:cursor-grabbing transition-all hover:shadow-md relative overflow-hidden touch-none ${showDropIndicator ? 'ring-2 ring-blue-400' : ''}`}>
          <div className="relative">
            <PaymentStatusBar status={job.paymentStatus || PaymentStatus.NONE} onClick={(e) => { e.stopPropagation(); setShowPaymentMenu(!showPaymentMenu); }} showLabel={true} />
            {showPaymentMenu && <PaymentStatusMiniMenu currentStatus={job.paymentStatus || PaymentStatus.NONE} onSelect={(status) => onPaymentStatusChange?.(job.id, status)} onClose={() => setShowPaymentMenu(false)} position="bottom" />}
          </div>
          <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            {job.projectImages?.[0] ? <img src={getJobThumbnailUrl(job.projectImages[0])} className="w-full h-full object-cover pointer-events-none" alt="" loading="lazy" /> : <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white"><Box className="w-8 h-8 opacity-50" /></div>}
            <div className="absolute bottom-1 right-1 text-[7px] font-medium px-1 py-0.5 bg-black/50 text-white/90 rounded">{job.friendlyId}</div>
          </div>
          <div className="p-2 flex flex-col" style={{ minHeight: '90px' }}>
            <h4 className="font-bold text-[11px] leading-snug mb-1 line-clamp-2">{job.data.jobTitle}</h4>
            <div className="text-[9px] truncate mb-1 text-slate-500">📍 {job.data.address?.split(',')[0] || 'Brak'}</div>
            {job.data.phoneNumber && <div className="text-[9px] font-bold truncate mb-1">📞 {job.data.phoneNumber}</div>}
            <div className="flex justify-between items-center mt-auto pt-1 border-t border-slate-100">
              {job.totalGross && job.totalGross > 0 ? (() => {
                const isVisible = isAdmin || job.paymentStatus === PaymentStatus.CASH || job.paymentStatus === PaymentStatus.PARTIAL;
                if (!isVisible) return <span className="text-[9px] text-slate-300">*** zł</span>;

                return (
                  <div className="flex flex-col items-start leading-none">
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] font-bold text-blue-600">{job.totalGross.toFixed(0)} zł</span>
                      {job.priceSource === 'ai' ? (
                        <span title="Wycena szacunkowa z maila" className="text-[8px] opacity-70">✉️</span>
                      ) : (
                        <span title="Wycena potwierdzona dokumentem" className="text-[8px] opacity-70">📄</span>
                      )}
                    </div>
                    {isAdmin && job.totalNet && job.totalNet > 0 && (
                      <span className="text-[7px] text-slate-400">({job.totalNet.toFixed(0)} netto)</span>
                    )}
                  </div>
                );
              })() : <span />}
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onDuplicate(job.id, e); }} className="p-0.5 rounded hover:bg-slate-100 text-blue-600"><Copy className="w-3 h-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); onArchive?.(job.id, e); }} className="p-0.5 rounded hover:bg-slate-100 text-slate-500"><Archive className="w-3 h-3" /></button>
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
            <div className="pt-1 mt-1 border-t border-slate-50">
              <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}>
                <span className="text-[8px] font-bold text-slate-400 uppercase">Przenieś</span>
                <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} />
              </div>
              {showMoveMenu && (
                <div className="grid grid-cols-4 gap-0.5 mt-1">
                  {MOVE_COLUMNS.map((col) => {
                    const isActive = currentColumnId === col.id;
                    return (
                      <button key={col.id} onClick={(e) => { e.stopPropagation(); if (!isActive) onMoveToColumn?.(job.id, col.id); setShowMoveMenu(false); }} className={`px-0.5 py-0.5 rounded text-[7px] font-bold flex flex-col items-center ${isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}><span className="text-[9px]">{col.icon}</span></button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- SECTION PROPS INTERFACES ---

export interface BoardViewSectionProps {
  sensors: any;
  cardFirstCollision: any;
  handleDragStart: any;
  handleDragOver: any;
  handleDragEnd: any;
  EXTENDED_ROWS_CONFIG: any[];
  getJobsForColumn: (id: JobColumnId) => Job[];
  activeId: string | null;
  isAdmin: boolean;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  handleDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleDuplicate: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleArchive: (id: string, e?: React.MouseEvent) => Promise<void>;
  handlePaymentStatusChange: (id: string, status: PaymentStatus) => Promise<void>;
  handleMoveToColumn: (id: string, columnId: JobColumnId) => Promise<void>;
  handleMoveLeft: (id: string) => void;
  handleMoveRight: (id: string) => void;
  handleJumpToStart: (id: string) => void;
  handleJumpToEnd: (id: string) => void;
  getJobMoveLeftRightInfo: (id: string) => any;
  jobMatchesPaymentFilter: (job: Job) => boolean;
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
  jobs: Job[];
}

export const BoardViewSection: React.FC<BoardViewSectionProps> = ({
  sensors, cardFirstCollision, handleDragStart, handleDragOver, handleDragEnd,
  EXTENDED_ROWS_CONFIG, getJobsForColumn, activeId, isAdmin, onSelectJob,
  handleDelete, handleDuplicate, handleArchive, handlePaymentStatusChange,
  handleMoveToColumn, handleMoveLeft, handleMoveRight, handleJumpToStart,
  handleJumpToEnd, getJobMoveLeftRightInfo, jobMatchesPaymentFilter,
  handleContextMenu, jobs
}) => {
  return (
    <DndContext sensors={sensors} collisionDetection={cardFirstCollision} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {EXTENDED_ROWS_CONFIG.map(row => {
          const rowJobs = getJobsForColumn(row.id);
          return (
            <div key={row.id} className="theme-surface transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor?.replace('text-', '') || '#ddd' }}>
              <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">{row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}{row.title}</h3>
                <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
              </div>
              <DroppableRow id={row.id} activeId={activeId}>
                {rowJobs.length === 0 && !activeId ? (
                  <div className="text-xs font-medium italic w-full text-center p-6 border-2 border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'var(--blur)' }}>Przeciągnij tutaj zlecenie</div>
                ) : (
                  rowJobs.map((job) => {
                    const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
                    const matchesFilter = jobMatchesPaymentFilter(job);
                    return (
                      <DraggableJobCard
                        key={job.id}
                        job={job}
                        isAdmin={isAdmin}
                        onSelectJob={onSelectJob}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onArchive={handleArchive}
                        onPaymentStatusChange={handlePaymentStatusChange}
                        onMoveToColumn={handleMoveToColumn}
                        onMoveLeft={handleMoveLeft}
                        onMoveRight={handleMoveRight}
                        onMoveUp={handleJumpToStart}
                        onMoveDown={handleJumpToEnd}
                        canMoveLeft={canMoveLeft}
                        canMoveRight={canMoveRight}
                        canMoveUp={canMoveUp}
                        canMoveDown={canMoveDown}
                        onContextMenu={handleContextMenu}
                        matchesFilter={matchesFilter}
                      />
                    );
                  })
                )}
              </DroppableRow>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeId ? (() => {
          const activeJob = jobs.find(j => j.id === activeId);
          if (!activeJob) return null;
          return (
            <div className="theme-card shadow-2xl rotate-2 opacity-95 p-2" style={{ width: '120px' }}>
              <div className="aspect-square rounded overflow-hidden mb-2" style={{ background: 'var(--bg-surface)' }}>{activeJob.projectImages?.[0] ? <img src={getJobThumbnailUrl(activeJob.projectImages[0])} className="w-full h-full object-cover" alt="" /> : <Box className="w-8 h-8 mx-auto mt-4 text-slate-300" />}</div>
              <h4 className="font-bold text-[9px] line-clamp-2">{activeJob.data.jobTitle || 'Bez nazwy'}</h4>
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
};

export interface KanbanViewSectionProps {
  sensors: any;
  cardFirstCollision: any;
  handleDragStart: any;
  handleDragOver: any;
  handleDragEnd: any;
  ROWS_CONFIG: any[];
  getJobsForColumn: (id: JobColumnId) => Job[];
  activeId: string | null;
  isAdmin: boolean;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  handleDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleDuplicate: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleArchive: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleMoveUp: (id: string) => void;
  handleMoveDown: (id: string) => void;
  getJobMoveInfo: (id: string) => any;
  getJobMoveLeftRightInfo: (id: string) => any;
  handleMoveLeft: (id: string) => void;
  handleMoveRight: (id: string) => void;
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
  handlePaymentStatusChange: (id: string, status: PaymentStatus) => Promise<void>;
  handleMoveToColumn: (id: string, columnId: JobColumnId) => Promise<void>;
  jobMatchesPaymentFilter: (job: Job) => boolean;
  jobs: Job[];
}

export const KanbanViewSection: React.FC<KanbanViewSectionProps> = ({
  sensors, cardFirstCollision, handleDragStart, handleDragOver, handleDragEnd,
  ROWS_CONFIG, getJobsForColumn, activeId, isAdmin, onSelectJob, handleDelete,
  handleDuplicate, handleArchive, handleMoveUp, handleMoveDown, getJobMoveInfo,
  getJobMoveLeftRightInfo, handleMoveLeft, handleMoveRight, handleContextMenu,
  handlePaymentStatusChange, handleMoveToColumn, jobMatchesPaymentFilter, jobs
}) => {
  return (
    <DndContext sensors={sensors} collisionDetection={cardFirstCollision} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {ROWS_CONFIG.map(row => {
          const rowJobs = getJobsForColumn(row.id);
          return (
            <div key={row.id} className="theme-surface flex flex-col min-h-[500px] transition-all" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className={`${row.headerBg} ${row.headerText} px-3 py-3 flex justify-between items-center sticky top-0 z-10`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                <h3 className="font-bold tracking-wide text-[10px] flex items-center gap-2">{row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}{row.title}</h3>
                <span className="bg-white/20 px-2 py-0.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-sm)' }}>{rowJobs.length}</span>
              </div>
              <DroppableColumn id={row.id} activeId={activeId}>
                <div className="flex flex-col gap-4 w-full p-2">
                  {rowJobs.map(job => {
                    const { canMoveUp, canMoveDown } = getJobMoveInfo(job.id);
                    const { canMoveLeft, canMoveRight } = getJobMoveLeftRightInfo(job.id);
                    const matchesFilter = jobMatchesPaymentFilter(job);
                    return (
                      <SmallKanbanCard
                        key={job.id}
                        job={job}
                        isAdmin={isAdmin}
                        onSelectJob={onSelectJob}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onArchive={handleArchive}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        canMoveUp={canMoveUp}
                        canMoveDown={canMoveDown}
                        onMoveLeft={handleMoveLeft}
                        onMoveRight={handleMoveRight}
                        canMoveLeft={canMoveLeft}
                        canMoveRight={canMoveRight}
                        onContextMenu={handleContextMenu}
                        onPaymentStatusChange={handlePaymentStatusChange}
                        onMoveToColumn={handleMoveToColumn}
                        matchesFilter={matchesFilter}
                      />
                    );
                  })}
                </div>
              </DroppableColumn>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeId ? (() => {
          const activeJob = jobs.find(j => j.id === activeId);
          if (!activeJob) return null;
          return (
            <div className="theme-card shadow-2xl rotate-2 opacity-95 p-2" style={{ width: '80px' }}>
              <div className="aspect-square rounded overflow-hidden mb-1" style={{ background: 'var(--bg-surface)' }}>{activeJob.projectImages?.[0] ? <img src={getJobThumbnailUrl(activeJob.projectImages[0])} className="w-full h-full object-cover" alt="" /> : <Box className="w-6 h-6 mx-auto mt-2 text-slate-300" />}</div>
              <h4 className="font-bold text-[7px] line-clamp-1">{activeJob.data.jobTitle || 'Bez nazwy'}</h4>
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
};

export interface PrepareSectionProps {
  row: any;
  rowJobs: Job[];
  activeId: string | null;
  isAdmin: boolean;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  handleDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleDuplicate: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleArchive: (id: string, e?: React.MouseEvent) => Promise<void>;
  handlePaymentStatusChange: (id: string, status: PaymentStatus) => Promise<void>;
  handleMoveToColumn: (id: string, columnId: JobColumnId) => Promise<void>;
  handleMoveLeft: (id: string) => void;
  handleMoveRight: (id: string) => void;
  handleJumpToStart: (id: string) => void;
  handleJumpToEnd: (id: string) => void;
  getJobMoveLeftRightInfo: (id: string) => any;
  jobMatchesPaymentFilter: (job: Job) => boolean;
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
}

export const PrepareSection: React.FC<PrepareSectionProps> = ({
  row, rowJobs, activeId, isAdmin, onSelectJob, handleDelete, handleDuplicate,
  handleArchive, handlePaymentStatusChange, handleMoveToColumn, handleMoveLeft,
  handleMoveRight, handleJumpToStart, handleJumpToEnd, getJobMoveLeftRightInfo,
  jobMatchesPaymentFilter, handleContextMenu
}) => {
  return (
    <div className="theme-surface transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor?.replace('text-', '') || '#ddd' }}>
      <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
        <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">{row.title}</h3>
        <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
      </div>
      <DroppableRow id={row.id} activeId={activeId}>
        {rowJobs.length === 0 && !activeId ? (
          <div className="text-xs font-medium italic w-full text-center p-6 border-2 border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'var(--blur)' }}>Przeciągnij tutaj zlecenie</div>
        ) : (
          rowJobs.map((job) => {
            const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
            const matchesFilter = jobMatchesPaymentFilter(job);
            return (
              <DraggableJobCard
                key={job.id}
                job={job}
                isAdmin={isAdmin}
                onSelectJob={onSelectJob}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
                onPaymentStatusChange={handlePaymentStatusChange}
                onMoveToColumn={handleMoveToColumn}
                onMoveLeft={handleMoveLeft}
                onMoveRight={handleMoveRight}
                onMoveUp={handleJumpToStart}
                onMoveDown={handleJumpToEnd}
                canMoveLeft={canMoveLeft}
                canMoveRight={canMoveRight}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onContextMenu={handleContextMenu}
                matchesFilter={matchesFilter}
              />
            );
          })
        )}
      </DroppableRow>
    </div>
  );
};

export interface CompletedSectionProps {
  row: any;
  rowJobs: Job[];
  activeId: string | null;
  isAdmin: boolean;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  handleDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleDuplicate: (job: Job) => Promise<void>;
  handlePaymentStatusChange: (id: string, status: PaymentStatus) => Promise<void>;
  handleMoveToColumn: (id: string, columnId: JobColumnId) => Promise<void>;
  handleMoveLeft: (id: string) => void;
  handleMoveRight: (id: string) => void;
  handleMoveUp?: (id: string) => void;
  handleMoveDown?: (id: string) => void;
  getJobMoveLeftRightInfo: (id: string) => any;
  jobMatchesPaymentFilter: (job: Job) => boolean;
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
}

export const CompletedSection: React.FC<CompletedSectionProps> = ({
  row, rowJobs, activeId, isAdmin, onSelectJob, handleDelete, handleDuplicate,
  handlePaymentStatusChange, handleMoveToColumn, handleMoveLeft, handleMoveRight,
  handleMoveUp, handleMoveDown, getJobMoveLeftRightInfo, jobMatchesPaymentFilter, handleContextMenu
}) => {
  return (
    <div className="theme-surface transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor?.replace('text-', '') || '#ddd' }}>
      <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
        <h3 className="font-bold tracking-wide text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{row.title}</h3>
        <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
      </div>
      <DroppableRow id={row.id} activeId={activeId}>
        {rowJobs.map((job) => {
          const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
          const matchesFilter = jobMatchesPaymentFilter(job);
          return (
            <DraggableJobCard
              key={job.id}
              job={job}
              isAdmin={isAdmin}
              onSelectJob={onSelectJob}
              onDelete={handleDelete}
              onDuplicate={() => handleDuplicate(job)}
              onPaymentStatusChange={handlePaymentStatusChange}
              onMoveToColumn={handleMoveToColumn}
              onMoveLeft={handleMoveLeft}
              onMoveRight={handleMoveRight}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              canMoveLeft={canMoveLeft}
              canMoveRight={canMoveRight}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onContextMenu={handleContextMenu}
              matchesFilter={matchesFilter}
            />
          );
        })}
      </DroppableRow>
    </div>
  );
};

export interface WeekColumnsSectionProps {
  showWeekend: boolean;
  setShowWeekend: (v: boolean) => void;
  ROWS_CONFIG: any[];
  getJobsForColumn: (id: JobColumnId) => Job[];
  activeId: string | null;
  isAdmin: boolean;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  handleDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleDuplicate: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleArchive: (id: string, e?: React.MouseEvent) => Promise<void>;
  handleMoveUp: (id: string) => void;
  handleMoveDown: (id: string) => void;
  getJobMoveInfo: (id: string) => any;
  getJobMoveLeftRightInfo: (id: string) => any;
  handleMoveLeft: (id: string) => void;
  handleMoveRight: (id: string) => void;
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
  handlePaymentStatusChange: (id: string, status: PaymentStatus) => Promise<void>;
  handleMoveToColumn: (id: string, columnId: JobColumnId) => Promise<void>;
  jobMatchesPaymentFilter: (job: Job) => boolean;
}

export const WeekColumnsSection: React.FC<WeekColumnsSectionProps> = ({
  showWeekend, setShowWeekend, ROWS_CONFIG, getJobsForColumn, activeId,
  isAdmin, onSelectJob, handleDelete, handleDuplicate, handleArchive,
  handleMoveUp, handleMoveDown, getJobMoveInfo, getJobMoveLeftRightInfo,
  handleMoveLeft, handleMoveRight, handleContextMenu, handlePaymentStatusChange,
  handleMoveToColumn, jobMatchesPaymentFilter
}) => {
  return (
    <>
      <div className="flex justify-end px-2">
         <button onClick={() => setShowWeekend(!showWeekend)} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 bg-white/50 px-2 py-1 rounded transition-colors">{showWeekend ? 'Ukryj weekend (Sob-Nd)' : 'Pokaż weekend (Sob-Nd)'}</button>
      </div>
      <div className={`grid grid-cols-1 gap-3 transition-all duration-300 ${showWeekend ? 'sm:grid-cols-7' : 'sm:grid-cols-5'}`}>
         {ROWS_CONFIG.filter(r => showWeekend ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(r.id) : ['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(r.id)).map(row => {
            const rowJobs = getJobsForColumn(row.id);
            const today = new Date().getDay();
            const mapDayToId: Record<number, string> = { 1:'MON', 2:'TUE', 3:'WED', 4:'THU', 5:'FRI', 6:'SAT', 0:'SUN' };
            const isToday = mapDayToId[today] === row.id;
            return (
              <div key={row.id} className={`theme-surface flex flex-col min-h-[500px] transition-all ${isToday ? 'ring-2 ring-blue-500 shadow-xl z-20' : ''}`} style={{ borderRadius: 'var(--radius-lg)' }}>
                <div className={`${row.headerBg} ${row.headerText} px-3 py-3 flex justify-between items-center sticky top-0 z-10 relative`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                   {isToday && (
                     <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-50 pointer-events-none">
                       <div className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg uppercase tracking-wider flex items-center gap-1 border-2 border-white">DZISIAJ</div>
                       <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-red-600"></div>
                     </div>
                   )}
                   <h3 className="font-bold tracking-wide text-xs sm:text-[10px] flex items-center gap-2"><span className="sm:hidden">{row.title}</span><span className="hidden sm:inline">{row.shortTitle}</span></h3>
                   <span className="bg-white/20 px-2 py-0.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-sm)' }}>{rowJobs.length}</span>
                </div>
                <DroppableColumn id={row.id} activeId={activeId}>
                   <div className="flex flex-col gap-4 w-full p-2">
                      {rowJobs.map(job => {
                         const { canMoveUp, canMoveDown } = getJobMoveInfo(job.id);
                         const { canMoveLeft, canMoveRight } = getJobMoveLeftRightInfo(job.id);
                         const matchesFilter = jobMatchesPaymentFilter(job);
                         return (
                            <SmallKanbanCard
                              key={job.id}
                              job={job}
                              isAdmin={isAdmin}
                              onSelectJob={onSelectJob}
                              onDelete={handleDelete}
                              onDuplicate={handleDuplicate}
                              onArchive={handleArchive}
                              onMoveUp={handleMoveUp}
                              onMoveDown={handleMoveDown}
                              canMoveUp={canMoveUp}
                              canMoveDown={canMoveDown}
                              onMoveLeft={handleMoveLeft}
                              onMoveRight={handleMoveRight}
                              canMoveLeft={canMoveLeft}
                              canMoveRight={canMoveRight}
                              onContextMenu={handleContextMenu}
                              onPaymentStatusChange={handlePaymentStatusChange}
                              onMoveToColumn={handleMoveToColumn}
                              matchesFilter={matchesFilter}
                            />
                         );
                      })}
                   </div>
                </DroppableColumn>
              </div>
            );
         })}
      </div>
    </>
  );
};



