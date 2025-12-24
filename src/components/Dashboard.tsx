import React, { useEffect, useState, useRef } from 'react';
import { Job, JobStatus, UserRole, JobColumnId, PaymentStatus } from '../types';
import { jobsService } from '../services/apiService';
import { 
  Plus, MapPin, CheckCircle2, Trash2, Box, Kanban, 
  Download, Copy, RefreshCw, Search, StretchHorizontal, ExternalLink,
  ChevronUp, ChevronDown, Map as MapIcon, Layers, LayoutDashboard,
  ChevronLeft, ChevronRight, Archive, Calendar, Star, MessageSquare, 
  CreditCard, Image as ImageIcon, ThumbsUp, ThumbsDown, Radio
} from 'lucide-react';
import MapBoardGoogle from './MapBoardGoogle';
import MapBoardOSM from './MapBoardOSM';
import PaymentStatusBadge, { PaymentStatusBar, PaymentStatusIcon, PaymentStatusMiniMenu } from './PaymentStatusBadge';
import JobContextMenu from './JobContextMenu';
import JobPlaceholder from './JobPlaceholder';
import { getJobThumbnailUrl } from '../utils/imageUtils';

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
} from '@dnd-kit/core';

// Custom collision detection: prioritize cards over columns
const cardFirstCollision: CollisionDetection = (args) => {
  // First, check for card collisions using pointerWithin
  const pointerCollisions = pointerWithin(args);
  
  // Separate card droppables from column droppables
  const cardCollisions = pointerCollisions.filter(c => 
    typeof c.id === 'string' && c.id.startsWith('card-')
  );
  const otherCollisions = pointerCollisions.filter(c => 
    typeof c.id !== 'string' || !c.id.startsWith('card-')
  );
  
  // If we're over a card, prioritize it
  if (cardCollisions.length > 0) {
    return cardCollisions;
  }
  
  // Otherwise, use rectIntersection for column detection
  if (otherCollisions.length > 0) {
    return otherCollisions;
  }
  
  // Fallback to rectIntersection for catching columns
  return rectIntersection(args);
};
import { CSS } from '@dnd-kit/utilities';

interface DashboardProps {
  role: UserRole;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  onCreateNew: () => void;
  onCreateNewSimple?: () => void;
  initialTab?: 'ACTIVE' | 'ARCHIVED';
  refreshTrigger?: number; // Trigger do odświeżania listy zleceń
}

// 7 kolumn: PRZYGOTOWANIE, PN-PT, WYKONANE (bez weekendu)
const ROWS_CONFIG: { 
  id: JobColumnId; 
  title: string; 
  shortTitle: string;
  headerBg: string; 
  dotColor: string; 
  borderColor: string;
  bodyBg: string; 
  headerText: string; 
  badgeBg: string;
  badgeText: string;
}[] = [
  { id: 'PREPARE', title: 'DO PRZYGOTOWANIA', shortTitle: 'PRZYG.', headerBg: 'bg-gradient-to-r from-slate-700 to-slate-800', headerText: 'text-white', dotColor: 'text-slate-600', bodyBg: 'bg-slate-50/50', borderColor: 'border-slate-600', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700' },
  { id: 'MON', title: 'PONIEDZIAŁEK', shortTitle: 'PN', headerBg: 'bg-gradient-to-r from-rose-500 to-rose-600', headerText: 'text-white', dotColor: 'text-rose-500', bodyBg: 'bg-rose-50/50', borderColor: 'border-rose-500', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700' },
  { id: 'TUE', title: 'WTOREK', shortTitle: 'WT', headerBg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', headerText: 'text-white', dotColor: 'text-emerald-500', bodyBg: 'bg-emerald-50/50', borderColor: 'border-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  { id: 'WED', title: 'ŚRODA', shortTitle: 'ŚR', headerBg: 'bg-gradient-to-r from-violet-500 to-violet-600', headerText: 'text-white', dotColor: 'text-violet-500', bodyBg: 'bg-violet-50/50', borderColor: 'border-violet-500', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  { id: 'THU', title: 'CZWARTEK', shortTitle: 'CZW', headerBg: 'bg-gradient-to-r from-amber-400 to-amber-500', headerText: 'text-amber-900', dotColor: 'text-amber-500', bodyBg: 'bg-amber-50/50', borderColor: 'border-amber-400', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
  { id: 'FRI', title: 'PIĄTEK', shortTitle: 'PT', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-600', headerText: 'text-white', dotColor: 'text-blue-500', bodyBg: 'bg-blue-50/50', borderColor: 'border-blue-500', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  { id: 'SAT', title: 'SOBOTA', shortTitle: 'SB', headerBg: 'bg-gradient-to-r from-indigo-500 to-indigo-600', headerText: 'text-white', dotColor: 'text-indigo-500', bodyBg: 'bg-indigo-50/50', borderColor: 'border-indigo-500', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700' },
  { id: 'SUN', title: 'NIEDZIELA', shortTitle: 'ND', headerBg: 'bg-gradient-to-r from-purple-500 to-purple-600', headerText: 'text-white', dotColor: 'text-purple-500', bodyBg: 'bg-purple-50/50', borderColor: 'border-purple-500', badgeBg: 'bg-purple-100', badgeText: 'text-purple-700' },
  { id: 'COMPLETED', title: 'WYKONANE', shortTitle: 'OK', headerBg: 'bg-gradient-to-r from-green-600 to-green-700', headerText: 'text-white', dotColor: 'text-green-600', bodyBg: 'bg-green-50/50', borderColor: 'border-green-600', badgeBg: 'bg-green-100', badgeText: 'text-green-700' },
];

// Te same kolumny dla wszystkich widoków
const EXTENDED_ROWS_CONFIG = ROWS_CONFIG;
const KANBAN_ROWS_CONFIG = ROWS_CONFIG;

// Draggable Job Card Component
interface DraggableJobCardProps {
  job: Job;
  isAdmin: boolean;
  onSelectJob: (job: Job) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDuplicate: (id: string, e: React.MouseEvent) => void;
  onArchive?: (id: string, e: React.MouseEvent) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onMoveLeft?: (id: string) => void;
  onMoveRight?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onPaymentStatusChange?: (jobId: string, status: PaymentStatus) => void;
  onMoveToColumn?: (jobId: string, columnId: JobColumnId) => void;
  onContextMenu?: (e: React.MouseEvent, job: Job) => void;
}

const BASE_COORDS = { lat: 52.2297, lng: 21.0122 }; // ul. Poprawna 39R, Warszawa

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

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

const parseAddressForNav = (address: string | undefined) => {
  if (!address) return { street: 'Brak adresu', city: '' };
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    let city = parts[1].replace(/\d{2}-\d{3}\s*/g, '').trim(); // Remove postal code
    if (!city && parts[2]) city = parts[2].replace(/\d{2}-\d{3}\s*/g, '').trim();
    return { street, city };
  }
  return { street: address, city: '' };
};

// Formatowanie numeru telefonu
const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return '';
  // Remove all spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // Check for +48 or just 9 digits
  const match = cleaned.match(/^(\+48)?(\d{9})$/);
  
  if (match) {
    const prefix = match[1] ? '+48 ' : '';
    const num = match[2];
    return `${prefix}${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 9)}`;
  }
  
  return phone;
};


// Formatowanie adresu (skrócone)
const formatAddressShort = (address: string | undefined): string => {
  if (!address) return 'BRAK ADRESU';
  
  // Try to split by comma to get Street and City
  const parts = address.split(',');
  
  if (parts.length >= 2) {
    const street = parts[0].trim();
    let city = parts[1].trim();
    
    // Remove zip code XX-XXX from city
    city = city.replace(/\d{2}-\d{3}\s*/, '').trim();
    
    // If city is empty (was just zip), try next part
    if (!city && parts[2]) {
      city = parts[2].trim();
    }
    
    return city ? `${street}, ${city}` : street;
  }
  
  return address;
};

// Helper function for payment status color
const getPaymentStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return '#22c55e'; // green
    case PaymentStatus.PROFORMA: return '#f97316'; // orange
    case PaymentStatus.PARTIAL: return '#f97316'; // orange
    case PaymentStatus.CASH: return '#eab308'; // yellow
    case PaymentStatus.OVERDUE: return '#ea580c'; // dark orange
    default: return 'transparent';
  }
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return 'OPŁACONE';
    case PaymentStatus.PROFORMA: return 'PROFORMA';
    case PaymentStatus.PARTIAL: return 'ZALICZKA';
    case PaymentStatus.CASH: return 'GOTÓWKA';
    case PaymentStatus.OVERDUE: return 'DO ZAPŁATY';
    default: return '';
  }
};

// Kolumny dostępne do przenoszenia (do sekcji "Przenieś do" na kafelku)
const MOVE_COLUMNS: { id: JobColumnId; label: string; shortLabel: string; icon: string }[] = [
  { id: 'PREPARE', label: 'Przygot.', shortLabel: 'P', icon: '📋' },
  { id: 'MON', label: 'Pon', shortLabel: 'Pn', icon: '🔴' },
  { id: 'TUE', label: 'Wt', shortLabel: 'Wt', icon: '🟢' },
  { id: 'WED', label: 'Śr', shortLabel: 'Śr', icon: '🟣' },
  { id: 'THU', label: 'Czw', shortLabel: 'Cz', icon: '🟡' },
  { id: 'FRI', label: 'Pt', shortLabel: 'Pt', icon: '🔵' },
  { id: 'COMPLETED', label: 'OK', shortLabel: '✓', icon: '✅' },
];

const DraggableJobCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveLeft, onMoveRight, onMoveUp, onMoveDown, canMoveLeft, canMoveRight, canMoveUp, canMoveDown,
  onPaymentStatusChange, onMoveToColumn, onContextMenu
}) => {
  // Unikalne ID dla DnD - kombinacja id + createdAt zabezpiecza przed duplikatami
  const uniqueDragId = `${job.id}-${job.createdAt}`;
  
  // Draggable
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: uniqueDragId,
    data: { jobId: job.id } // Prawdziwe ID do operacji
  });
  
  // Also droppable (for dropping other cards on this one)
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `card-${uniqueDragId}`,
    data: { type: 'card', jobId: job.id }
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
  };

  const showDropIndicator = isDropOver && !isDragging;

  const paymentColor = getPaymentStatusColor(job.paymentStatus || PaymentStatus.NONE);
  const paymentLabel = getPaymentStatusLabel(job.paymentStatus || PaymentStatus.NONE);
  
  // Format creation date
  const createdDate = job.createdAt ? new Date(job.createdAt).toLocaleDateString('pl-PL', { 
    day: '2-digit', 
    month: '2-digit',
    year: '2-digit'
  }) : '';

  // Format scheduled date
  const scheduledDateFormatted = job.data.scheduledDate ? new Date(job.data.scheduledDate).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) : null;

  const [showClickHint, setShowClickHint] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  // Stan mini-menu statusu płatności
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  // Stan rozwinięcia sekcji "Przenieś do"
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Address & Distance for Navigation Button
  const distance = job.data.coordinates 
    ? calculateDistance(BASE_COORDS.lat, BASE_COORDS.lng, job.data.coordinates.lat, job.data.coordinates.lng)
    : null;
  const addressParts = parseAddressForNav(job.data.address);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    // Show hint on single click
    setShowClickHint(true);
    setTimeout(() => setShowClickHint(false), 1500);
  };

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    setShowClickHint(false);
    onSelectJob(job);
  };

  const currentColumnId = job.columnId || 'PREPARE';

  return (
    <>
      {/* Drop indicator - pokazuje gdzie wpadnie kafelek */}
      {showDropIndicator && (
        <div 
          className="min-w-[160px] w-40 h-16 mr-3 rounded-lg border-dashed animate-pulse flex items-center justify-center"
          style={{ borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)', borderWidth: '3px' }}
        >
          <span className="text-xs text-blue-500 font-bold">↓ TUTAJ ↓</span>
        </div>
      )}
      <div 
        className="relative group h-full"
        onMouseEnter={() => setShowArrows(true)}
        onMouseLeave={() => setShowArrows(false)}
      >
        {/* LEFT arrow - dla PREPARE przesuwa o jedną pozycję w lewo, dla innych kolumn przenosi między kolumnami */}
        {showArrows && canMoveLeft && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveLeft?.(job.id); }}
            className="absolute top-1/2 -left-3 -translate-y-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title={currentColumnId === 'PREPARE' ? "Przesuń o jedną pozycję w lewo" : "Przesuń w lewo"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {/* RIGHT arrow - dla PREPARE przesuwa o jedną pozycję w prawo, dla innych kolumn przenosi między kolumnami */}
        {showArrows && canMoveRight && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveRight?.(job.id); }}
            className="absolute top-1/2 -right-3 -translate-y-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title={currentColumnId === 'PREPARE' ? "Przesuń o jedną pozycję w prawo" : "Przesuń w prawo"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* UP arrow (jump to start) - tylko dla PREPARE, pojawia się na górze */}
        {showArrows && currentColumnId === 'PREPARE' && canMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(job.id); }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 p-0.5 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:scale-110 transition-all"
            title="Na początek"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}

        {/* DOWN arrow (jump to end) - tylko dla PREPARE, pojawia się na dole */}
        {showArrows && currentColumnId === 'PREPARE' && canMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(job.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 p-0.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:scale-110 transition-all"
            title="Na koniec"
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
          {/* Click hint tooltip */}
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
        {/* PAYMENT STATUS BAR - na samej górze kafelka, kliknięcie otwiera mini-menu */}
        <div className="relative">
          <PaymentStatusBar
            status={job.paymentStatus || PaymentStatus.NONE}
            onClick={(e) => { e.stopPropagation(); setShowPaymentMenu(!showPaymentMenu); }}
            showLabel={true}
          />
          
          {/* Mini-menu statusu płatności */}
          {showPaymentMenu && (
            <PaymentStatusMiniMenu
              currentStatus={job.paymentStatus || PaymentStatus.NONE}
              onSelect={(status) => onPaymentStatusChange?.(job.id, status)}
              onClose={() => setShowPaymentMenu(false)}
              position="bottom"
            />
          )}
        </div>

        {/* Image */}
        <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
          {job.projectImages?.[0] ? (
            <img src={getJobThumbnailUrl(job.projectImages[0])} className="w-full h-full object-cover pointer-events-none" alt="preview" loading="lazy" />
          ) : (
            <JobPlaceholder job={job} size="medium" />
          )}

          {/* Job ID - more subtle */}
          <div 
            className="absolute bottom-2 right-2 text-[9px] font-medium px-1.5 py-0.5 backdrop-blur-sm" 
            style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius-sm)' }}
          >
            {job.friendlyId}
          </div>
        </div>
        
        <div className="p-3 flex flex-col flex-1">
          {/* Title - max 3 linie */}
          <h4 className="font-bold text-xs leading-tight mb-1 line-clamp-3" style={{ color: 'var(--text-primary)' }}>
            {job.data.jobTitle}
          </h4>
          
          {/* Scheduled Date/Time Badge */}
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
          
          {/* Przyciski Nawiguj i Zadzwoń - układ pionowy */}
          <div className="flex flex-col gap-1.5 mb-2 mt-auto">
            {/* Nawiguj - Nowy Wygląd */}
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
                  {addressParts.city}
                  {distance !== null && ` • ${distance.toFixed(1)} km`}
                </span>
              </div>
            </a>

            {/* Zadzwoń - pełna szerokość z numerem */}
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
          
          {/* Scheduled Date (Termin) */}
          {scheduledDateFormatted && (
            <div className="mt-2 text-sm font-black text-black leading-tight capitalize">
              {scheduledDateFormatted}
            </div>
          )}
          
          <div className="flex justify-between items-center pt-2 mt-auto" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              {/* Creation date instead of checklist */}
              {createdDate && (
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {createdDate}
                </span>
              )}
              {job.totalGross && job.totalGross > 0 && (
                <span className="text-[10px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {job.totalGross.toFixed(0)} zł
                </span>
              )}
            </div>
            {isAdmin && (
              <div className="flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(job.id, e); }} 
                  className="p-1 hover:bg-slate-100 rounded"
                  style={{ color: 'var(--accent-primary)' }}
                  title="Duplikuj"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onArchive?.(job.id, e); }} 
                  className="p-1 hover:bg-slate-100 rounded"
                  style={{ color: 'var(--text-secondary)' }}
                  title="Archiwizuj"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} 
                  className="p-1 hover:text-blue-500 hover:bg-slate-100 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  title="Usuń"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          
          {/* SEKCJA "PRZENIEŚ DO" - na dole kafelka */}
          <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
            >
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
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (!isActive) {
                          onMoveToColumn?.(job.id, col.id);
                        }
                        setShowMoveMenu(false);
                      }}
                      disabled={isActive}
                      className={`px-1 py-1 rounded text-[8px] font-bold transition-all flex flex-col items-center ${
                        isActive 
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={col.label}
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

// Droppable Column Component
interface DroppableColumnProps {
  id: JobColumnId;
  children: React.ReactNode;
  activeId?: string | null;
}

// Droppable for horizontal board (row layout)
const DroppableRow: React.FC<DroppableColumnProps> = ({ id, children, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      className={`p-5 transition-all overflow-visible ${
        isOver && activeId ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      style={{ 
        background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)', 
        backdropFilter: 'var(--blur)', 
        WebkitBackdropFilter: 'var(--blur)'
      }}
    >
      <div 
        className="grid gap-8 min-h-[180px] items-stretch overflow-visible px-4"
        style={{ 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gridAutoRows: 'minmax(280px, auto)' // Equal minimum height rows
        }}
      >
        {children}
      </div>
    </div>
  );
};

// Droppable for vertical kanban (column layout)
const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children, activeId }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      className={`p-3 min-h-[400px] flex-1 transition-all flex flex-col overflow-visible ${
        isOver && activeId ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      style={{ 
        background: isOver && activeId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface)', 
        backdropFilter: 'var(--blur)', 
        WebkitBackdropFilter: 'var(--blur)' 
      }}
    >
      {children}
    </div>
  );
};

// Small Kanban Card (for narrow vertical columns)
const SmallKanbanCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown, 
  onMoveLeft, onMoveRight, canMoveLeft, canMoveRight,
  onContextMenu, onPaymentStatusChange, onMoveToColumn
}) => {
  // Unikalne ID dla DnD - kombinacja id + createdAt zabezpiecza przed duplikatami
  const uniqueDragId = `${job.id}-${job.createdAt}`;
  
  // Draggable
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: uniqueDragId,
    data: { jobId: job.id } // Prawdziwe ID do operacji
  });
  
  // Also droppable (for dropping other cards on this one)
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `card-${uniqueDragId}`,
    data: { type: 'card', jobId: job.id }
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const [showClickHint, setShowClickHint] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  // Stan mini-menu statusu płatności
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  // Stan rozwinięcia sekcji "Przenieś do"
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Address & Distance for Navigation Button
  const distance = job.data.coordinates 
    ? calculateDistance(BASE_COORDS.lat, BASE_COORDS.lng, job.data.coordinates.lat, job.data.coordinates.lng)
    : null;
  const addressParts = parseAddressForNav(job.data.address);

  const showDropIndicator = isDropOver && !isDragging;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
  };

  const handleCardDoubleClick = () => {
    if (isDragging) return;
    setShowClickHint(false);
    onSelectJob(job);
  };

  const paymentColor = getPaymentStatusColor(job.paymentStatus || PaymentStatus.NONE);
  const paymentLabel = getPaymentStatusLabel(job.paymentStatus || PaymentStatus.NONE);
  const currentColumnId = job.columnId || 'PREPARE';

  return (
    <>
      {/* Drop indicator - pokazuje gdzie wpadnie kafelek */}
      {showDropIndicator && (
        <div 
          className="w-full h-12 mb-2 rounded-lg border-dashed animate-pulse flex items-center justify-center"
          style={{ borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)', borderWidth: '3px' }}
        >
          <span className="text-[10px] text-blue-500 font-bold">↓ TUTAJ ↓</span>
        </div>
      )}
      <div 
        className="relative group"
        onMouseEnter={() => setShowArrows(true)}
        onMouseLeave={() => setShowArrows(false)}
      >
        {/* UP arrow - appears on hover at top */}
        {showArrows && canMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(job.id); }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title="Przesuń w górę"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
        
        {/* DOWN arrow - appears on hover at bottom */}
        {showArrows && canMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(job.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title="Przesuń w dół"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
        
        {/* LEFT arrow - dla PREPARE przesuwa o jedną pozycję w lewo, dla innych kolumn przenosi między kolumnami */}
        {showArrows && canMoveLeft && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveLeft?.(job.id); }}
            className="absolute top-1/2 -left-3 -translate-y-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title={currentColumnId === 'PREPARE' ? "Przesuń o jedną pozycję w lewo" : "Przesuń w lewo"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {/* RIGHT arrow - dla PREPARE przesuwa o jedną pozycję w prawo, dla innych kolumn przenosi między kolumnami */}
        {showArrows && canMoveRight && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveRight?.(job.id); }}
            className="absolute top-1/2 -right-3 -translate-y-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title={currentColumnId === 'PREPARE' ? "Przesuń o jedną pozycję w prawo" : "Przesuń w prawo"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        
        <div 
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onDoubleClick={handleCardDoubleClick}
          className={`theme-card cursor-grab active:cursor-grabbing transition-all hover:shadow-md relative overflow-hidden touch-none ${showDropIndicator ? 'ring-2 ring-blue-400' : ''}`}
        >
        {/* PAYMENT STATUS BAR - na samej górze, kliknięcie otwiera mini-menu */}
        <div className="relative">
          <PaymentStatusBar
            status={job.paymentStatus || PaymentStatus.NONE}
            onClick={(e) => { e.stopPropagation(); setShowPaymentMenu(!showPaymentMenu); }}
            showLabel={true}
          />
          
          {/* Mini-menu statusu płatności */}
          {showPaymentMenu && (
            <PaymentStatusMiniMenu
              currentStatus={job.paymentStatus || PaymentStatus.NONE}
              onSelect={(status) => onPaymentStatusChange?.(job.id, status)}
              onClose={() => setShowPaymentMenu(false)}
              position="bottom"
            />
          )}
        </div>

        {/* Thumbnail */}
        <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
          {job.projectImages?.[0] ? (
            <img src={getJobThumbnailUrl(job.projectImages[0])} className="w-full h-full object-cover pointer-events-none" alt="" loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2" style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              {job.data.scopeWorkText ? (
                <>
                  <div className="text-[8px] font-bold mb-0.5 opacity-90">OPIS</div>
                  <div className="text-[7px] leading-tight text-center line-clamp-3 opacity-95">
                    {job.data.scopeWorkText}
                  </div>
                </>
              ) : (
                <Box className="w-8 h-8 opacity-50" />
              )}
            </div>
          )}
          {/* Job ID */}
          <div 
            className="absolute bottom-1 right-1 text-[7px] font-medium px-1 py-0.5 backdrop-blur-sm" 
            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.9)', borderRadius: '2px' }}
          >
            {job.friendlyId}
          </div>
        </div>

        {/* Content - compact */}
        <div className="p-2 flex flex-col" style={{ minHeight: '90px' }}>
          <h4 className="font-bold text-[11px] leading-snug mb-1 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {job.data.jobTitle}
          </h4>
          
          {/* Address - one line */}
          <div className="text-[9px] truncate mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex-shrink-0">📍</span> {job.data.address?.split(',')[0] || 'Brak'}
          </div>
          
          {/* Phone */}
          {job.data.phoneNumber && (
            <div className="text-[9px] font-bold truncate mb-1" style={{ color: 'var(--text-primary)' }}>
              📞 {job.data.phoneNumber}
            </div>
          )}

          {/* Bottom row: Amount + Actions */}
          <div className="flex justify-between items-center mt-auto pt-1 border-t border-slate-100">
            {job.totalGross && job.totalGross > 0 ? (
              <span className="text-[9px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                {job.totalGross.toFixed(0)} zł
              </span>
            ) : <span />}
            
            {/* Delete/Duplicate buttons */}
            {isAdmin && (
              <div className="flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(job.id, e); }} 
                  className="p-0.5 rounded hover:bg-slate-100"
                  style={{ color: 'var(--accent-primary)' }}
                  title="Duplikuj"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onArchive?.(job.id, e); }} 
                  className="p-0.5 hover:bg-slate-100 rounded"
                  style={{ color: 'var(--text-secondary)' }}
                  title="Archiwizuj"
                >
                  <Archive className="w-3 h-3" />
                </button>
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} 
                  className="p-0.5 rounded hover:bg-slate-100 hover:text-blue-500"
                  style={{ color: 'var(--text-muted)' }}
                  title="Usuń"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          
          {/* SEKCJA "PRZENIEŚ DO" - na dole kafelka */}
          <div className="pt-1 mt-1" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
            >
              <span className="text-[8px] font-bold text-slate-400 uppercase">Przenieś</span>
              <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} />
            </div>
            
            {showMoveMenu && (
              <div className="grid grid-cols-4 gap-0.5 mt-1">
                {MOVE_COLUMNS.map((col) => {
                  const isActive = currentColumnId === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (!isActive) {
                          onMoveToColumn?.(job.id, col.id);
                        }
                        setShowMoveMenu(false);
                      }}
                      disabled={isActive}
                      className={`px-0.5 py-0.5 rounded text-[7px] font-bold transition-all flex flex-col items-center ${
                        isActive 
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={col.label}
                    >
                      <span className="text-[9px]">{col.icon}</span>
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

const Dashboard: React.FC<DashboardProps> = ({ role, onSelectJob, onCreateNew, onCreateNewSimple, initialTab, refreshTrigger }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  // Zapamiętuj aktywną zakładkę w localStorage i przywracaj przy odświeżeniu
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>(() => {
    // Jeśli jest initialTab (z App.tsx), użyj go, w przeciwnym razie sprawdź localStorage
    if (initialTab) return initialTab;
    const saved = localStorage.getItem('dashboard_active_tab') as 'ACTIVE' | 'ARCHIVED' | null;
    return saved || 'ACTIVE';
  });
  const [viewMode, setViewMode] = useState<'BOARD' | 'KANBAN' | 'MIXED'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'BOARD' | 'KANBAN' | 'MIXED') || 'MIXED';
  });

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode);
  }, [viewMode]);
  
  // Persist active tab
  useEffect(() => {
    localStorage.setItem('dashboard_active_tab', activeTab);
  }, [activeTab]);
  
  // Aktualizuj activeTab gdy initialTab się zmienia (np. po powrocie z karty zlecenia)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // Map provider - domyślnie OSM, zapamiętuje wybór
  const [mapProvider, setMapProvider] = useState<'GOOGLE' | 'OSM'>(() => {
    return (localStorage.getItem('dashboard_map_provider') as 'GOOGLE' | 'OSM') || 'OSM';
  });
  
  // Persist map provider
  useEffect(() => {
    localStorage.setItem('dashboard_map_provider', mapProvider);
  }, [mapProvider]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Weekend - automatyczne rozwijanie w piątek/sobota/niedziela
  const [showWeekend, setShowWeekend] = useState(() => {
    const today = new Date().getDay(); // 0 = niedziela, 5 = piątek, 6 = sobota
    return today === 5 || today === 6 || today === 0; // Piątek, sobota lub niedziela
  });
  const [showTypeModal, setShowTypeModal] = useState(false);
  const healingDoneRef = useRef(false); // Zapobiega wielokrotnemu uruchamianiu healJobs
  const [liveRefresh, setLiveRefresh] = useState(false); // Live refresh toggle
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'ALL'>('ALL'); // Payment filter dla aktywnego widoku
  
  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; job: Job } | null>(null);
  
  // Archive filters
  const [archivePaymentFilter, setArchivePaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [archiveReviewFilter, setArchiveReviewFilter] = useState<'all' | 'sent' | 'not_sent'>('all');
  const [archivePaymentMenuOpen, setArchivePaymentMenuOpen] = useState<string | null>(null); // jobId dla otwartego menu płatności

  // Auto-Heal: Sprawdź zlecenia z adresem ale bez współrzędnych (tylko RAZ po załadowaniu)
  useEffect(() => {
    // Jeśli już wykonano healing - nie powtarzaj
    if (healingDoneRef.current) return;
    
    const healJobs = async () => {
      // Oznacz że healing jest w trakcie
      healingDoneRef.current = true;
      
      // Filtruj zlecenia, które mają adres (>3 znaki) ale nie mają współrzędnych
      const jobsToHeal = jobs.filter(j => 
        j.data.address && 
        j.data.address.length > 3 && 
        !j.data.coordinates
      );

      if (jobsToHeal.length === 0) return;

      console.log(`🩹 Auto-Heal: Znaleziono ${jobsToHeal.length} zleceń do naprawy geolokalizacji.`);

      let fixedCount = 0;

      for (const job of jobsToHeal) {
        try {
          const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: job.data.address })
          });
          
          const data = await response.json();
          if (data.success && data.results && data.results.length > 0) {
            const bestMatch = data.results[0];
            
            // Aktualizuj w bazie
            await jobsService.updateJob(job.id, {
              data: {
                ...job.data,
                address: bestMatch.formattedAddress,
                coordinates: bestMatch.coordinates
              }
            });
            
            fixedCount++;
            console.log(`✅ Auto-Heal: Naprawiono ${job.friendlyId} (${bestMatch.formattedAddress})`);
          } else {
             console.warn(`⚠️ Auto-Heal: Nie udało się znaleźć współrzędnych dla ${job.friendlyId} ("${job.data.address}"). Google status: ${data.message || 'UNKNOWN'}`);
          }
        } catch (e) {
          console.error(`❌ Auto-Heal błąd dla ${job.friendlyId}:`, e);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Odśwież listę po naprawie TYLKO jeśli coś naprawiono
      if (fixedCount > 0) {
        loadJobs(true);
      }
    };

    // Uruchom po 3 sekundach od załadowania (tylko raz!)
    if (!loading && jobs.length > 0) {
      const timer = setTimeout(healJobs, 3000);
      return () => clearTimeout(timer);
    }
  }, [loading, jobs.length]);

  // Sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    loadJobs();
  }, []);

  // Odśwież listę zleceń gdy refreshTrigger się zmienia
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadJobs();
    }
  }, [refreshTrigger]);

  // Broadcast zmian przez localStorage
  const broadcastChange = () => {
    localStorage.setItem('crm_last_change', Date.now().toString());
  };

  // Nasłuchuj zmian z innych okien
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crm_last_change' && e.newValue) {
        // Inne okno zmieniło dane - odśwież
        loadJobs(true); // Silent refresh
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Live refresh polling
  useEffect(() => {
    if (!liveRefresh) return;

    const interval = setInterval(() => {
      // Odświeżaj tylko gdy karta jest widoczna
      if (document.visibilityState === 'visible') {
        loadJobs(true); // Silent refresh
      }
    }, 12000); // Co 12 sekund

    return () => clearInterval(interval);
  }, [liveRefresh]);

  const loadJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await jobsService.getJobs();
      
      // DEBUG: Loguj ile zleceń otrzymaliśmy i jakie typy
      console.log('📊 Dashboard loadJobs:', {
        total: data.length,
        ai: data.filter(j => j.type === 'ai').length,
        simple: data.filter(j => j.type === 'simple').length,
        jobs: data.map(j => ({ id: j.id, type: j.type, title: j.data.jobTitle?.substring(0, 30) }))
      });
      
      // ZABEZPIECZENIE: Usuń duplikaty po ID (zostaw tylko pierwszy wystąpienie)
      const seenIds = new Set<string>();
      const uniqueJobs = data.filter(job => {
        if (seenIds.has(job.id)) {
          console.warn(`⚠️ DUPLIKAT: Znaleziono zduplikowane ID "${job.id}" - "${job.data?.jobTitle || job.friendlyId}"`);
          return false;
        }
        seenIds.add(job.id);
        return true;
      });
      
      if (uniqueJobs.length !== data.length) {
        console.error(`🔴 UWAGA: Usunięto ${data.length - uniqueJobs.length} duplikatów ID z widoku!`);
      }
      
      setJobs(uniqueJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === id);
    const jobName = job?.data.jobTitle || job?.friendlyId || 'to zlecenie';
    if (window.confirm(`🗑️ Czy na pewno chcesz USUNĄĆ zlecenie?\n\n"${jobName}"\n\nTej operacji nie można cofnąć!`)) {
      // Optymistyczna aktualizacja UI - usuń od razu z listy
      const previousJobs = [...jobs];
      setJobs(prevJobs => prevJobs.filter(j => j.id !== id));
      
      try {
        await jobsService.deleteJob(id);
        broadcastChange();
        console.log('✅ Zlecenie usunięte:', id);
      } catch (err) {
        console.error('❌ Błąd usuwania zlecenia:', err);
        // Przywróć stan jeśli błąd
        setJobs(previousJobs);
        alert('Nie udało się usunąć zlecenia. Spróbuj ponownie.');
      }
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Zduplikować to zlecenie?')) {
      await jobsService.duplicateJob(id);
      broadcastChange();
      loadJobs();
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === id);
    const jobName = job?.data.jobTitle || job?.friendlyId || 'to zlecenie';
    if (window.confirm(`📦 Czy na pewno chcesz zarchiwizować zlecenie?\n\n"${jobName}"`)) {
      try {
        await jobsService.updateJob(id, { status: JobStatus.ARCHIVED });
        broadcastChange();
        loadJobs();
        console.log('✅ Zlecenie zarchiwizowane:', id);
      } catch (err) {
        console.error('❌ Błąd archiwizacji:', err);
        alert('Nie udało się zarchiwizować zlecenia.');
      }
    }
  };

  // Context Menu handler - prawy klik na kafelku
  const handleContextMenu = (e: React.MouseEvent, job: Job) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, job });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Toggle review request status (kciuk w górę/dół)
  const handleToggleReviewRequest = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Nie otwieraj karty
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const currentlySent = !!job.reviewRequestSentAt;
    const newStatus = currentlySent ? undefined : Date.now();
    try {
      await jobsService.updateJob(jobId, { reviewRequestSentAt: newStatus });
      loadJobs();
    } catch (err) {
      console.error('Błąd zmiany statusu opinii:', err);
      alert('Nie udało się zmienić statusu opinii.');
    }
  };

  // Move job up in the same column
  const handleMoveUp = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => {
        const orderA = a.order ?? a.columnOrder ?? 0;
        const orderB = b.order ?? b.columnOrder ?? 0;
        return orderA - orderB;
      });
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex <= 0) return; // Already at top
    
    // Swap with the job above
    const jobAbove = columnJobs[currentIndex - 1];
    const currentOrder = job.order || currentIndex;
    const aboveOrder = jobAbove.order || (currentIndex - 1);
    
    // Update orders
    setJobs(prevJobs => prevJobs.map(j => {
      if (j.id === jobId) return { ...j, order: aboveOrder };
      if (j.id === jobAbove.id) return { ...j, order: currentOrder };
      return j;
    }));
    
    // Save to backend
    try {
      await jobsService.updateJobColumn(jobId, columnId, aboveOrder);
      await jobsService.updateJobColumn(jobAbove.id, columnId, currentOrder);
    } catch (err) {
      console.error('Failed to save order:', err);
      loadJobs(); // Reload on error
    }
  };

  // Move job down in the same column
  const handleMoveDown = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => {
        const orderA = a.order ?? a.columnOrder ?? 0;
        const orderB = b.order ?? b.columnOrder ?? 0;
        return orderA - orderB;
      });
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex >= columnJobs.length - 1) return; // Already at bottom
    
    // Swap with the job below
    const jobBelow = columnJobs[currentIndex + 1];
    const currentOrder = job.order || currentIndex;
    const belowOrder = jobBelow.order || (currentIndex + 1);
    
    // Update orders
    setJobs(prevJobs => prevJobs.map(j => {
      if (j.id === jobId) return { ...j, order: belowOrder };
      if (j.id === jobBelow.id) return { ...j, order: currentOrder };
      return j;
    }));
    
    // Save to backend
    try {
      await jobsService.updateJobColumn(jobId, columnId, belowOrder);
      await jobsService.updateJobColumn(jobBelow.id, columnId, currentOrder);
    } catch (err) {
      console.error('Failed to save order:', err);
      loadJobs(); // Reload on error
    }
  };

  // Helper to check if job can move up/down
  const getJobMoveInfo = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { canMoveUp: false, canMoveDown: false };
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => {
        const orderA = a.order ?? a.columnOrder ?? 0;
        const orderB = b.order ?? b.columnOrder ?? 0;
        return orderA - orderB;
      });
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    
    return {
      canMoveUp: currentIndex > 0,
      canMoveDown: currentIndex < columnJobs.length - 1
    };
  };

  // Kolejność kolumn dla strzałek lewo/prawo
  // Dynamic column order based on weekend visibility
  const getColumnOrder = () => {
    const base = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    if (showWeekend) base.push('SAT', 'SUN');
    base.push('COMPLETED');
    return base as JobColumnId[];
  };
  
  // Helper to check if job can move left/right
  const getJobMoveLeftRightInfo = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { canMoveLeft: false, canMoveRight: false };

    const columnId = job.columnId || 'PREPARE';
    
    // Special handling for PREPARE - arrows allow reordering
    if (columnId === 'PREPARE') {
        const colJobs = jobs
            .filter(j => (j.columnId || 'PREPARE') === 'PREPARE')
            .sort((a, b) => {
        const orderA = a.order ?? a.columnOrder ?? 0;
        const orderB = b.order ?? b.columnOrder ?? 0;
        return orderA - orderB;
      });
        const index = colJobs.findIndex(j => j.id === jobId);
        // Can move left (up) if not first, can move right (down) if not last
        // Can move up (jump to start) if not first, can move down (jump to end) if not last
        return {
            canMoveLeft: index > 0,
            canMoveRight: index < colJobs.length - 1,
            canMoveUp: index > 0,
            canMoveDown: index < colJobs.length - 1
        };
    }

    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    
    if (currentIndex === -1) return { canMoveLeft: false, canMoveRight: false };
    
    return {
      canMoveLeft: currentIndex > 0,
      canMoveRight: currentIndex < order.length - 1
    };
  };

  // ============================================
  // PRZEPISANA OD ZERA LOGIKA PREPARE
  // Grid poziomy: kolejność wizualna = kolejność w DOM = kolejność po order
  // ============================================
  
  // Helper: Pobierz posortowane zlecenia z PREPARE z znormalizowanymi orderami
  const getPrepareJobsSorted = () => {
    const prepareJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === 'PREPARE')
      .map((job, idx) => {
        // Normalizuj order - jeśli nie ma, użyj index
        const normalizedOrder = job.order ?? job.columnOrder ?? idx;
        return { ...job, normalizedOrder };
      })
      .sort((a, b) => a.normalizedOrder - b.normalizedOrder);
    
    return prepareJobs;
  };

  // UP arrow: Przenosi na sam początek (order = 0)
  const handleJumpToStart = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || (job.columnId || 'PREPARE') !== 'PREPARE') return;
    
    const sortedJobs = getPrepareJobsSorted();
    const index = sortedJobs.findIndex(j => j.id === jobId);
    if (index === -1 || index === 0) return;
    
    // Przesuń wszystkie zlecenia przed aktualnym o 1 w dół
    const jobsToUpdate = sortedJobs.slice(0, index).map((j, idx) => ({
      id: j.id,
      currentOrder: j.normalizedOrder,
      newOrder: idx + 1
    }));
    
    // Optymistyczna aktualizacja
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) return { ...j, order: 0, columnOrder: 0 };
      const update = jobsToUpdate.find(u => u.id === j.id);
      if (update) return { ...j, order: update.newOrder, columnOrder: update.newOrder };
      return j;
    }));
    
    try {
      await jobsService.updateJob(jobId, { order: 0 });
      await Promise.all(jobsToUpdate.map(u => 
        jobsService.updateJob(u.id, { order: u.newOrder })
      ));
      broadcastChange();
    } catch (err) {
      console.error('Jump to start failed', err);
      loadJobs();
    }
  };

  // DOWN arrow: Przenosi na sam koniec (order = max + 1)
  const handleJumpToEnd = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || (job.columnId || 'PREPARE') !== 'PREPARE') return;
    
    const sortedJobs = getPrepareJobsSorted();
    const index = sortedJobs.findIndex(j => j.id === jobId);
    if (index === -1 || index === sortedJobs.length - 1) return;
    
    const maxOrder = Math.max(...sortedJobs.map(j => j.normalizedOrder), -1);
    const newOrder = maxOrder + 1;
    
    // Optymistyczna aktualizacja
    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, order: newOrder, columnOrder: newOrder } : j
    ));
    
    try {
      await jobsService.updateJob(jobId, { order: newOrder });
      broadcastChange();
    } catch (err) {
      console.error('Jump to end failed', err);
      loadJobs();
    }
  };

  // LEFT arrow dla PREPARE: Przesuwa o jedną pozycję w lewo (zamienia z poprzednim)
  const handleMoveLeftInPrepare = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || (job.columnId || 'PREPARE') !== 'PREPARE') return;
    
    const sortedJobs = getPrepareJobsSorted();
    const index = sortedJobs.findIndex(j => j.id === jobId);
    if (index === -1 || index === 0) return;
    
    const otherJob = sortedJobs[index - 1];
    const order1 = sortedJobs[index].normalizedOrder;
    const order2 = otherJob.normalizedOrder;
    
    console.log('🔄 handleMoveLeftInPrepare:', {
      jobId,
      jobTitle: job.data.jobTitle?.substring(0, 30),
      index,
      order1,
      order2,
      otherJobId: otherJob.id,
      otherJobTitle: otherJob.data.jobTitle?.substring(0, 30)
    });
    
    // Zamiana orderów
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) return { ...j, order: order2, columnOrder: order2 };
      if (j.id === otherJob.id) return { ...j, order: order1, columnOrder: order1 };
      return j;
    }));
    
    try {
      await Promise.all([
        jobsService.updateJob(jobId, { order: order2 }),
        jobsService.updateJob(otherJob.id, { order: order1 })
      ]);
      broadcastChange();
      console.log('✅ handleMoveLeftInPrepare: Sukces');
    } catch (err) {
      console.error('❌ Move left in PREPARE failed', err);
      loadJobs();
    }
  };

  // RIGHT arrow dla PREPARE: Przesuwa o jedną pozycję w prawo (zamienia z następnym)
  const handleMoveRightInPrepare = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || (job.columnId || 'PREPARE') !== 'PREPARE') return;
    
    const sortedJobs = getPrepareJobsSorted();
    const index = sortedJobs.findIndex(j => j.id === jobId);
    if (index === -1 || index === sortedJobs.length - 1) {
      console.log('⚠️ handleMoveRightInPrepare: Już na końcu', { index, total: sortedJobs.length });
      return;
    }
    
    const otherJob = sortedJobs[index + 1];
    const order1 = sortedJobs[index].normalizedOrder;
    const order2 = otherJob.normalizedOrder;
    
    console.log('🔄 handleMoveRightInPrepare:', {
      jobId,
      jobTitle: job.data.jobTitle?.substring(0, 30),
      index,
      order1,
      order2,
      otherJobId: otherJob.id,
      otherJobTitle: otherJob.data.jobTitle?.substring(0, 30)
    });
    
    // Zamiana orderów
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) return { ...j, order: order2, columnOrder: order2 };
      if (j.id === otherJob.id) return { ...j, order: order1, columnOrder: order1 };
      return j;
    }));
    
    try {
      await Promise.all([
        jobsService.updateJob(jobId, { order: order2 }),
        jobsService.updateJob(otherJob.id, { order: order1 })
      ]);
      broadcastChange();
      console.log('✅ handleMoveRightInPrepare: Sukces');
    } catch (err) {
      console.error('❌ Move right in PREPARE failed', err);
      loadJobs();
    }
  };

  // Move job to the left column (dla innych kolumn niż PREPARE)
  const handleMoveLeft = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    
    // Dla PREPARE używamy specjalnej funkcji
    if (columnId === 'PREPARE') {
      await handleMoveLeftInPrepare(jobId);
      return;
    }

    // Dla innych kolumn: przenoszenie między kolumnami
    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    if (currentIndex <= 0) return;
    
    const newColumnId = order[currentIndex - 1];
    
    setJobs(prevJobs => prevJobs.map(j => 
      j.id === jobId ? { ...j, columnId: newColumnId } : j
    ));
    
    try {
      await jobsService.updateJobColumn(jobId, newColumnId, undefined);
      broadcastChange();
    } catch (err) {
      console.error('Failed to move left:', err);
      loadJobs();
    }
  };

  // Move job to the right column (dla innych kolumn niż PREPARE)
  const handleMoveRight = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    
    // Dla PREPARE używamy specjalnej funkcji
    if (columnId === 'PREPARE') {
      await handleMoveRightInPrepare(jobId);
      return;
    }

    // Dla innych kolumn: przenoszenie między kolumnami
    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    if (currentIndex >= order.length - 1 || currentIndex === -1) return;
    
    const newColumnId = order[currentIndex + 1];
    
    setJobs(prevJobs => prevJobs.map(j => 
      j.id === jobId ? { ...j, columnId: newColumnId } : j
    ));
    
    try {
      await jobsService.updateJobColumn(jobId, newColumnId, undefined);
      broadcastChange();
    } catch (err) {
      console.error('Failed to move right:', err);
      loadJobs();
    }
  };

  // Zmiana statusu płatności bezpośrednio z kafelka
  const handlePaymentStatusChange = async (jobId: string, newStatus: PaymentStatus) => {
    // Optymistyczna aktualizacja UI
    setJobs(prevJobs => prevJobs.map(j => 
      j.id === jobId ? { ...j, paymentStatus: newStatus } : j
    ));
    
    // Zapisz do backendu
    try {
      await jobsService.updateJob(jobId, { paymentStatus: newStatus });
      broadcastChange();
    } catch (err) {
      console.error('Failed to update payment status:', err);
      loadJobs(); // Reload on error
    }
  };

  // Przeniesienie zlecenia do innej kolumny (z dropdownu / sekcji "Przenieś do")
  // NAPRAWIONE: Teraz oblicza prawidłowy order na podstawie istniejących zleceń w docelowej kolumnie
  const handleMoveToColumn = async (jobId: string, targetColumnId: JobColumnId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const sourceColumnId = job.columnId || 'PREPARE';
    
    // Jeśli to ta sama kolumna - nie rób nic
    if (sourceColumnId === targetColumnId) return;
    
    // Oblicz nowy order: pobierz wszystkie zlecenia w docelowej kolumnie i ustaw na końcu
    const targetColumnJobs = jobs.filter(j => 
      (j.columnId || 'PREPARE') === targetColumnId && j.id !== jobId
    );
    const maxOrder = targetColumnJobs.length > 0 
      ? Math.max(...targetColumnJobs.map(j => j.order || 0)) + 1 
      : 0;
    
    console.log('📦 handleMoveToColumn:', {
      jobId,
      jobTitle: job.data.jobTitle,
      from: sourceColumnId,
      to: targetColumnId,
      newOrder: maxOrder,
      targetColumnJobsCount: targetColumnJobs.length
    });
    
    // Optymistyczna aktualizacja UI - ustaw zarówno columnId JAK I order
    setJobs(prevJobs => prevJobs.map(j => 
      j.id === jobId ? { ...j, columnId: targetColumnId, order: maxOrder } : j
    ));
    
    // Zapisz do backendu z prawidłowym order
    try {
      await jobsService.updateJobColumn(jobId, targetColumnId, maxOrder);
      broadcastChange();
      console.log('✅ handleMoveToColumn: zapisano pomyślnie');
    } catch (err) {
      console.error('❌ Failed to move job to column:', err);
      loadJobs(); // Reload on error - przywróć stan z backendu
    }
  };

  const handleBackup = async () => {
    const data = await jobsService.getJobs();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_montaz24_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to find which column a job belongs to
  const findColumnForJob = (jobId: string): JobColumnId | null => {
    const job = jobs.find(j => j.id === jobId);
    return job ? (job.columnId || 'PREPARE') : null;
  };

  // DnD start handler
  const handleDragStart = (event: DragStartEvent) => {
    // Pobierz prawdziwe ID zlecenia z data (bo event.active.id to teraz uniqueDragId)
    const jobId = (event.active.data?.current as any)?.jobId || event.active.id.toString().split('-')[0];
    const job = jobs.find(j => j.id === jobId);
    console.log('🟢 DRAG START:', {
      jobId: jobId,
      jobTitle: job?.data.jobTitle,
      currentColumn: job?.columnId || 'PREPARE'
    });
    setActiveId(jobId); // Używamy prawdziwego ID
    setOverId(null);
  };

  // DnD over handler - just tracks which item we're over for visual feedback
  const handleDragOver = (event: DragOverEvent) => {
    let overIdValue = event.over?.id as string || null;
    
    // Extract job ID if it's a card drop target (format: "card-{jobId}-{createdAt}")
    if (overIdValue && overIdValue.startsWith('card-')) {
      // Pobierz jobId z data lub wyciągnij z uniqueDragId
      overIdValue = (event.over?.data?.current as any)?.jobId || overIdValue.replace('card-', '').split('-')[0];
    }
    
    const allColumnIds = ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'COMPLETED'];
    
    if (overIdValue && overIdValue !== activeId) {
      const isColumn = allColumnIds.includes(overIdValue);
      const overJob = !isColumn ? jobs.find(j => j.id === overIdValue) : null;
      console.log('🟡 DRAG OVER:', {
        overId: overIdValue,
        isColumn,
        overJobTitle: overJob?.data.jobTitle,
        overJobColumn: overJob?.columnId || (isColumn ? overIdValue : 'PREPARE')
      });
    }
    setOverId(overIdValue);
  };

  // DnD Kit handler - handles column changes and reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Clear states
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    // Pobierz prawdziwe ID zlecenia z data (bo active.id to teraz uniqueDragId)
    const draggedId = (active.data?.current as any)?.jobId || active.id.toString().split('-')[0];
    let droppedOnId = over.id as string;
    
    // Extract job ID if dropped on a card (format: "card-{uniqueDragId}")
    const isCardDrop = droppedOnId.startsWith('card-');
    if (isCardDrop) {
      // Format: "card-{jobId}-{createdAt}" -> wyciągnij jobId
      const withoutPrefix = droppedOnId.replace('card-', '');
      droppedOnId = (over.data?.current as any)?.jobId || withoutPrefix.split('-')[0];
    }
    
    // Don't do anything if dropped on itself
    if (draggedId === droppedOnId) return;

    const allColumnIds = ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'COMPLETED'];
    
    // Find source column of dragged item
    const sourceColumn = findColumnForJob(draggedId);
    if (!sourceColumn) return;
    
    // Determine target column and position
    let targetColumn: JobColumnId;
    let insertBeforeJobId: string | null = null;
    
    if (allColumnIds.includes(droppedOnId)) {
      // Dropped directly on a column (empty space or column header)
      targetColumn = droppedOnId as JobColumnId;
    } else {
      // Dropped on another job - find its column
      const overJobColumn = findColumnForJob(droppedOnId);
      if (!overJobColumn) return;
      targetColumn = overJobColumn;
      insertBeforeJobId = droppedOnId;
    }
    
    const draggedJob = jobs.find(j => j.id === draggedId);
    const insertBeforeJob = insertBeforeJobId ? jobs.find(j => j.id === insertBeforeJobId) : null;
    
    console.log('🔴 DRAG END:', {
      draggedId,
      draggedJobTitle: draggedJob?.data.jobTitle,
      droppedOnId,
      sourceColumn,
      targetColumn,
      insertBeforeJobId,
      insertBeforeJobTitle: insertBeforeJob?.data.jobTitle,
      isColumnDrop: allColumnIds.includes(droppedOnId),
      isSameColumn: sourceColumn === targetColumn
    });
    
    // Get jobs in target column (excluding the dragged item)
    const targetColumnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === targetColumn && j.id !== draggedId)
      .sort((a, b) => {
        const orderA = a.order ?? a.columnOrder ?? 0;
        const orderB = b.order ?? b.columnOrder ?? 0;
        return orderA - orderB;
      });
    
    // Calculate new order
    let newOrder: number;
    
    if (insertBeforeJobId) {
      // Insert at the position of the job we dropped on
      const insertIndex = targetColumnJobs.findIndex(j => j.id === insertBeforeJobId);
      newOrder = insertIndex !== -1 ? insertIndex : targetColumnJobs.length;
    } else {
      // Dropped on column itself - add to end
      newOrder = targetColumnJobs.length;
    }
    
    console.log('🟣 Before reorder check:', { sourceColumn, targetColumn, areEqual: sourceColumn === targetColumn });
    
    // Same column - just reorder
    if (sourceColumn === targetColumn) {
      const sourceJobs = jobs
        .filter(j => (j.columnId || 'PREPARE') === sourceColumn)
        .sort((a, b) => {
        const orderA = a.order ?? a.columnOrder ?? 0;
        const orderB = b.order ?? b.columnOrder ?? 0;
        return orderA - orderB;
      });
      
      // Build array of IDs
      const jobIds = sourceJobs.map(j => j.id);
      const currentIndex = jobIds.indexOf(draggedId);
      
      if (currentIndex === -1) return; // Should not happen

      // Remove from old position
      jobIds.splice(currentIndex, 1);
      
      // Determine insert index
      let insertIndex = jobIds.length; // Default: end
      if (insertBeforeJobId) {
        insertIndex = jobIds.indexOf(insertBeforeJobId);
        if (insertIndex === -1) insertIndex = jobIds.length;
      }
      
      // Insert at new position
      jobIds.splice(insertIndex, 0, draggedId);
      
      // Create new jobs array with updated orders
      const orderMap = new Map<string, number>();
      jobIds.forEach((id, idx) => orderMap.set(id, idx));
      
      setJobs(prev => prev.map(job => 
        orderMap.has(job.id) ? { ...job, order: orderMap.get(job.id)! } : job
      ));
      
      // Send update to backend
      // We need to send the exact new index
      await jobsService.updateJobPosition(draggedId, targetColumn, insertIndex);
      
    } else {
      // Moving to different column
      // ... (reszta bez zmian)
      const updatedJobs = jobs.map(job => {
        if (job.id === draggedId) {
          return { ...job, columnId: targetColumn, order: newOrder };
        }
        // Shift jobs in target column
        if ((job.columnId || 'PREPARE') === targetColumn) {
           const currentOrder = job.order || 0;
           if (currentOrder >= newOrder) {
             return { ...job, order: currentOrder + 1 };
           }
        }
        return job;
      });
      
      setJobs(updatedJobs);
      await jobsService.updateJobPosition(draggedId, targetColumn, newOrder);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesTab = activeTab === 'ACTIVE' 
      ? job.status !== JobStatus.ARCHIVED 
      : job.status === JobStatus.ARCHIVED;
    
    const matchesSearch = !searchQuery || 
      job.data.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.data.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.data.address?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Archive filters
    let matchesArchiveFilters = true;
    if (activeTab === 'ARCHIVED') {
      // Payment status filter
      if (archivePaymentFilter !== 'all') {
        const jobPaymentStatus = job.paymentStatus || PaymentStatus.NONE;
        matchesArchiveFilters = matchesArchiveFilters && jobPaymentStatus === archivePaymentFilter;
      }
      
      // Review status filter
      if (archiveReviewFilter !== 'all') {
        const reviewSent = !!job.reviewRequestSentAt;
        if (archiveReviewFilter === 'sent') {
          matchesArchiveFilters = matchesArchiveFilters && reviewSent;
        } else if (archiveReviewFilter === 'not_sent') {
          matchesArchiveFilters = matchesArchiveFilters && !reviewSent;
        }
      }
    }
    
    return matchesTab && matchesSearch && matchesArchiveFilters;
  });

  const getJobsForColumn = (colId: JobColumnId) => {
    const filtered = filteredJobs.filter(j => (j.columnId || 'PREPARE') === colId);
    
    // Dla PREPARE: użyj znormalizowanych orderów (zapewnia poprawną kolejność w gridzie)
    if (colId === 'PREPARE') {
      return filtered
        .map((job, idx) => {
          const normalizedOrder = job.order ?? job.columnOrder ?? idx;
          return { ...job, normalizedOrder };
        })
        .sort((a, b) => a.normalizedOrder - b.normalizedOrder);
    }
    
    // Dla innych kolumn: standardowe sortowanie
    return filtered.sort((a, b) => {
      const orderA = a.order ?? a.columnOrder ?? 0;
      const orderB = b.order ?? b.columnOrder ?? 0;
      return orderA - orderB;
    });
    // Debug: log when rendering WED column
    if (colId === 'WED' && result.length > 0) {
      console.log('🟠 RENDER WED:', result.map(j => ({ title: j.data.jobTitle?.substring(0,15), order: j.order })));
    }
    return result;
  };

  // Helper do sprawdzania czy karta pasuje do filtra płatności
  const jobMatchesPaymentFilter = (job: Job): boolean => {
    if (activeTab !== 'ACTIVE' || paymentFilter === 'ALL') return true;
    const jobPaymentStatus = job.paymentStatus || PaymentStatus.NONE;
    return jobPaymentStatus === paymentFilter;
  };

  const isAdmin = role === UserRole.ADMIN;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--accent-orange)', borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Ładowanie zleceń...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 mb-4 mt-11">
        {/* Row 1: Tabs + New button */}
        <div className="flex justify-between items-center gap-2">
          <div className="theme-surface flex p-1 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
            <button 
              onClick={() => {
                setActiveTab('ACTIVE');
                localStorage.setItem('dashboard_active_tab', 'ACTIVE');
              }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: activeTab === 'ACTIVE' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'ACTIVE' ? 'var(--text-inverse)' : 'var(--text-secondary)'
              }}
            >
              AKTYWNE ({jobs.filter(j => j.status !== JobStatus.ARCHIVED).length})
            </button>
            <button 
              onClick={() => {
                setActiveTab('ARCHIVED');
                localStorage.setItem('dashboard_active_tab', 'ARCHIVED');
              }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: activeTab === 'ARCHIVED' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'ARCHIVED' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              ARCHIWUM
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Live Refresh Toggle */}
            <button
              onClick={() => setLiveRefresh(!liveRefresh)}
              className={`px-3 py-2 font-bold flex items-center gap-2 transition-all rounded-lg ${
                liveRefresh 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
              title={liveRefresh ? 'Wyłącz live odświeżanie' : 'Włącz live odświeżanie'}
            >
              <Radio className={`w-4 h-4 ${liveRefresh ? 'fill-white' : ''}`} />
              <span className="hidden sm:inline text-xs">LIVE</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => loadJobs()}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 transition-all rounded-lg border border-slate-300 shadow-sm"
              title="Odśwież ręcznie"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Odśwież</span>
            </button>

            {isAdmin && (
              <button 
                onClick={onCreateNew}
                className="px-3 sm:px-5 py-2.5 font-bold flex items-center gap-2 transition-all active:scale-95 flex-shrink-0"
                style={{ 
                  background: 'var(--accent-orange)', 
                  color: 'var(--text-inverse)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <Plus className="w-5 h-5" /> 
                <span className="hidden sm:inline">NOWE ZLECENIE</span>
              </button>
            )}
          </div>
        </div>

        {/* Payment Filters - Chips dla aktywnego widoku */}
        {activeTab === 'ACTIVE' && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Płatność:</span>
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                paymentFilter === 'ALL'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setPaymentFilter(PaymentStatus.PROFORMA)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                paymentFilter === PaymentStatus.PROFORMA
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
              }`}
            >
              Proforma
            </button>
            <button
              onClick={() => setPaymentFilter(PaymentStatus.PAID)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                paymentFilter === PaymentStatus.PAID
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              Opłacone
            </button>
            <button
              onClick={() => setPaymentFilter(PaymentStatus.CASH)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                paymentFilter === PaymentStatus.CASH
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
              }`}
            >
              Gotówka
            </button>
            <button
              onClick={() => setPaymentFilter(PaymentStatus.OVERDUE)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                paymentFilter === PaymentStatus.OVERDUE
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              Przeterminowane
            </button>
            <button
              onClick={() => setPaymentFilter(PaymentStatus.PARTIAL)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                paymentFilter === PaymentStatus.PARTIAL
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
            >
              Częściowe
            </button>
          </div>
        )}

        {/* Archive Filters - Chips nad paskiem wyszukiwania */}
        {activeTab === 'ARCHIVED' && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {/* Payment Status Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Płatność:</span>
              <button
                onClick={() => setArchivePaymentFilter('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archivePaymentFilter === 'all'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setArchivePaymentFilter(PaymentStatus.PROFORMA)}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archivePaymentFilter === PaymentStatus.PROFORMA
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                }`}
              >
                Proforma
              </button>
              <button
                onClick={() => setArchivePaymentFilter(PaymentStatus.PAID)}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archivePaymentFilter === PaymentStatus.PAID
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                Opłacone
              </button>
              <button
                onClick={() => setArchivePaymentFilter(PaymentStatus.PARTIAL)}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archivePaymentFilter === PaymentStatus.PARTIAL
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                }`}
              >
                Zaliczka
              </button>
              <button
                onClick={() => setArchivePaymentFilter(PaymentStatus.CASH)}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archivePaymentFilter === PaymentStatus.CASH
                    ? 'bg-yellow-500 text-white shadow-md'
                    : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                }`}
              >
                Barter
              </button>
              <button
                onClick={() => setArchivePaymentFilter(PaymentStatus.OVERDUE)}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archivePaymentFilter === PaymentStatus.OVERDUE
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                Przeterminowane
              </button>
            </div>
            
            {/* Review Status Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold ml-2" style={{ color: 'var(--text-secondary)' }}>Opinia:</span>
              <button
                onClick={() => setArchiveReviewFilter('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                  archiveReviewFilter === 'all'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setArchiveReviewFilter('sent')}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1 ${
                  archiveReviewFilter === 'sent'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                <ThumbsUp className="w-3 h-3" /> Wystawiona
              </button>
              <button
                onClick={() => setArchiveReviewFilter('not_sent')}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1 ${
                  archiveReviewFilter === 'not_sent'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                <ThumbsDown className="w-3 h-3" /> Nie wystawiona
              </button>
            </div>
          </div>
        )}

        {/* Row 2: Search & Actions */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Szukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="theme-input pl-10 pr-3 py-2 text-sm w-full"
            />
          </div>
          
          {/* Refresh */}
          <button 
            onClick={() => loadJobs()}
            className="theme-card p-2.5 transition-all"
            style={{ borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}
            title="Odśwież"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {isAdmin && (
            <button 
              onClick={handleBackup} 
              className="theme-card p-2.5" 
              style={{ borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}
              title="Pobierz Kopię Zapasową"
            >
              <Download className="w-5 h-5" />
            </button>
          )}

          {/* View toggle - 3 widoki */}
          <div className="theme-surface flex p-1 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
            <button 
              onClick={() => setViewMode('MIXED')} 
              className="p-2 transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: viewMode === 'MIXED' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'MIXED' ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}
              title="Widok mieszany (PRZYGOT. + PN-PT + MAPA + WYKONANE)"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('KANBAN')} 
              className="p-2 transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: viewMode === 'KANBAN' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'KANBAN' ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}
              title="Kolumny pionowe (7 kolumn)"
            >
              <Kanban className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('BOARD')} 
              className="p-2 transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: viewMode === 'BOARD' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'BOARD' ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}
              title="Wiersze poziome (7 wierszy)"
            >
              <StretchHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ARCHIVED LIST VIEW - Lista podzielona na dni */}
      {activeTab === 'ARCHIVED' && (() => {
        if (filteredJobs.length === 0) {
          return (
            <div className="theme-card p-12 text-center" style={{ borderRadius: 'var(--radius-lg)' }}>
              <Archive className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Archiwum jest puste</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zakończone zlecenia pojawią się tutaj</p>
            </div>
          );
        }

        // Grupuj zlecenia po dniach (najnowsze na górze)
        const jobsByDate = filteredJobs
          .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
          .reduce((acc, job) => {
            const date = new Date(job.completedAt || job.createdAt);
            // Format: "Poniedziałek, 14 grudnia"
            const dayOfWeek = date.toLocaleDateString('pl-PL', { weekday: 'long' });
            const dayAndMonth = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
            const dateKey = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${dayAndMonth}`;
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(job);
            return acc;
          }, {} as Record<string, Job[]>);

        return (
          <div className="space-y-6">
            {Object.entries(jobsByDate).map(([dateKey, dayJobs]) => (
              <div key={dateKey}>
                {/* Nagłówek dnia */}
                <h3 className="text-lg font-bold mb-3 px-2" style={{ color: 'var(--text-primary)' }}>
                  {dateKey}
                </h3>
                
                {/* Lista zleceń z tego dnia - pionowo, pełna szerokość */}
                <div className="space-y-2">
                  {dayJobs.map(job => {
                    const imgUrl = job.projectImages?.[0] || job.completionImages?.[0];
                    const reviewRequestSent = !!job.reviewRequestSentAt;
                    const paymentStatus = job.paymentStatus || PaymentStatus.NONE;
                    
                    return (
                      <div 
                        key={job.id}
                        className="theme-card flex gap-4 p-4 hover:shadow-lg transition-all group w-full"
                        style={{ borderRadius: 'var(--radius-lg)' }}
                      >
                        {/* Miniaturka kwadratowa po lewej */}
                        <div 
                          className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border cursor-pointer"
                          style={{ borderColor: 'var(--border-light)', background: 'var(--bg-surface)' }}
                          onClick={() => onSelectJob(job, true)}
                        >
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                        </div>
                        
                        {/* Dane zlecenia w środku */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectJob(job, true)}>
                          <h4 className="font-bold text-sm mb-1 group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                            {job.data.jobTitle || 'Bez nazwy'}
                          </h4>
                          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                            <strong>Klient:</strong> {job.data.clientName || 'Brak'}
                          </p>
                          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                            <strong>Adres:</strong> {job.data.address || 'Brak'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {job.friendlyId}
                          </p>
                        </div>
                        
                        {/* Przyciski po prawej */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Kciuk w górę/dół - status opinii */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleReviewRequest(e, job.id); }}
                            className={`p-2 rounded-lg transition-all hover:scale-110 ${
                              reviewRequestSent 
                                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            }`}
                            title={reviewRequestSent ? 'Prośba o opinię wysłana (kliknij aby odznaczyć)' : 'Prośba o opinię nie wysłana (kliknij aby oznaczyć)'}
                          >
                            {reviewRequestSent ? (
                              <ThumbsUp className="w-5 h-5 fill-current" />
                            ) : (
                              <ThumbsDown className="w-5 h-5 fill-current text-red-600" />
                            )}
                          </button>
                          
                          {/* Status płatności - klikalny przycisk z menu */}
                          <div className="relative" style={{ zIndex: archivePaymentMenuOpen === job.id ? 1000 : 'auto' }}>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setArchivePaymentMenuOpen(archivePaymentMenuOpen === job.id ? null : job.id);
                              }}
                              className="transition-all hover:scale-105"
                            >
                              <PaymentStatusBadge status={paymentStatus} size="sm" />
                            </button>
                            
                            {/* Menu zmiany statusu płatności */}
                            {archivePaymentMenuOpen === job.id && (
                              <div className="absolute right-0 top-full mt-1" style={{ zIndex: 1001 }}>
                                <PaymentStatusMiniMenu
                                  currentStatus={paymentStatus}
                                  onSelect={async (newStatus) => {
                                    await handlePaymentStatusChange(job.id, newStatus);
                                    setArchivePaymentMenuOpen(null);
                                  }}
                                  onClose={() => setArchivePaymentMenuOpen(null)}
                                  position="bottom"
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Ikona kosza - trwałe usunięcie */}
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const jobName = job.data.jobTitle || job.friendlyId || 'to zlecenie';
                                if (window.confirm(`🗑️ Czy na pewno chcesz TRWALE USUNĄĆ zlecenie z archiwum?\n\n"${jobName}"\n\nTej operacji nie można cofnąć!`)) {
                                  handleDelete(job.id, e);
                                }
                              }}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all hover:scale-110"
                              title="Trwale usuń z archiwum"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* MIXED VIEW (New Layout) */}
      {activeTab === 'ACTIVE' && viewMode === 'MIXED' && (
        <DndContext
          sensors={sensors}
          collisionDetection={cardFirstCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            
            {/* 1. TOP: PREPARE ROW (Horizontal) */}
            {ROWS_CONFIG.filter(r => r.id === 'PREPARE').map(row => {
               const rowJobs = getJobsForColumn(row.id);
               return (
                <div key={row.id} className="theme-surface transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor.replace('text-', ''), overflow: 'visible' }}>
                  <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                    <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                       {row.title}
                    </h3>
                    <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
                  </div>
                  <DroppableRow id={row.id} activeId={activeId}>
                    {rowJobs.length === 0 && !activeId ? (
                      <div className="text-xs font-medium italic w-full text-center p-6 border-2 border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'var(--blur)' }}>
                        Przeciągnij tutaj zlecenie
                      </div>
                    ) : (
                      rowJobs.map(job => {
                        const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
                        const matchesFilter = jobMatchesPaymentFilter(job);
                        return (
                          <div 
                            key={job.id}
                            className={matchesFilter ? '' : 'opacity-50 brightness-75 transition-opacity'}
                          >
                            <DraggableJobCard
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
                            />
                          </div>
                        );
                      })
                    )}
                  </DroppableRow>
                </div>
               );
            })}

            {/* 2. MIDDLE: MON-FRI COLUMNS (Vertical Grid) */}
            <div className="flex justify-end px-2">
               <button 
                 onClick={() => setShowWeekend(!showWeekend)}
                 className="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 bg-white/50 px-2 py-1 rounded transition-colors"
               >
                 {showWeekend ? 'Ukryj weekend (Sob-Nd)' : 'Pokaż weekend (Sob-Nd)'}
               </button>
            </div>
            
            <div className={`grid grid-cols-1 gap-3 transition-all duration-300 ${showWeekend ? 'sm:grid-cols-7' : 'sm:grid-cols-5'}`}>
               {ROWS_CONFIG.filter(r => {
                 if (showWeekend) {
                   return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(r.id);
                 }
                 return ['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(r.id);
               }).map(row => {
                  const rowJobs = getJobsForColumn(row.id);
                  const today = new Date().getDay();
                  const mapDayToId: Record<number, string> = { 1:'MON', 2:'TUE', 3:'WED', 4:'THU', 5:'FRI', 6:'SAT', 0:'SUN' };
                  const isToday = mapDayToId[today] === row.id;

                  return (
                    <div key={row.id} className={`theme-surface flex flex-col min-h-[500px] transition-all ${isToday ? 'ring-2 ring-blue-500 shadow-xl z-20' : ''}`} style={{ borderRadius: 'var(--radius-lg)' }}>
                      <div className={`${row.headerBg} ${row.headerText} px-3 py-3 flex justify-between items-center sticky top-0 z-10 relative`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                         {isToday && (
                           <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce z-50 pointer-events-none">
                             <div className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg uppercase tracking-wider flex items-center gap-1 border-2 border-white">
                               DZISIAJ
                             </div>
                             <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-orange-600"></div>
                           </div>
                         )}
                         <h3 className="font-bold tracking-wide text-xs sm:text-[10px] flex items-center gap-2">
                           <span className="sm:hidden">{row.title}</span>
                           <span className="hidden sm:inline">{row.shortTitle}</span>
                         </h3>
                         <span className="bg-white/20 px-2 py-0.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-sm)' }}>{rowJobs.length}</span>
                      </div>
                      <DroppableColumn id={row.id} activeId={activeId}>
                         <div className="flex flex-col gap-4 w-full p-2">
                            {rowJobs.map(job => {
                               const { canMoveUp, canMoveDown } = getJobMoveInfo(job.id);
                               const { canMoveLeft, canMoveRight } = getJobMoveLeftRightInfo(job.id);
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
                                  />
                               );
                            })}
                         </div>
                      </DroppableColumn>
                    </div>
                  );
               })}
            </div>

            {/* 3. MAP with toggle buttons */}
            <div className="mt-4 theme-surface overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
              {/* Map toggle buttons */}
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 flex justify-between items-center">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  MAPA ZLECEŃ
                </h3>
                <div className="flex gap-1 bg-white/20 p-1" style={{ borderRadius: 'var(--radius-md)' }}>
                  <button 
                    onClick={() => setMapProvider('GOOGLE')} 
                    className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                    style={{ 
                      borderRadius: 'var(--radius-sm)',
                      background: mapProvider === 'GOOGLE' ? 'white' : 'transparent',
                      color: mapProvider === 'GOOGLE' ? 'var(--accent-primary)' : 'white'
                    }}
                  >
                    <MapIcon className="w-3 h-3" /> Google
                  </button>
                  <button 
                    onClick={() => setMapProvider('OSM')} 
                    className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                    style={{ 
                      borderRadius: 'var(--radius-sm)',
                      background: mapProvider === 'OSM' ? 'white' : 'transparent',
                      color: mapProvider === 'OSM' ? 'var(--accent-primary)' : 'white'
                    }}
                  >
                    <Layers className="w-3 h-3" /> OSM
                  </button>
                </div>
              </div>
              {/* Map content */}
              <div className="p-2">
                {mapProvider === 'GOOGLE' ? (
                  <MapBoardGoogle 
                    jobs={filteredJobs} 
                    onSelectJob={onSelectJob} 
                    onJobsUpdated={loadJobs}
                    onChangeColumn={async (jobId, newColumnId) => {
                      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, columnId: newColumnId } : j));
                      await jobsService.updateJobColumn(jobId, newColumnId, undefined);
                    }}
                  />
                ) : (
                  <MapBoardOSM 
                    jobs={filteredJobs} 
                    onSelectJob={onSelectJob}
                    onJobsUpdated={loadJobs}
                  />
                )}
              </div>
            </div>

            {/* 4. BOTTOM: COMPLETED ROW (Horizontal) */}
            {ROWS_CONFIG.filter(r => r.id === 'COMPLETED').map(row => {
               const rowJobs = getJobsForColumn(row.id);
               return (
                <div key={row.id} className="theme-surface transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor.replace('text-', ''), overflow: 'visible' }}>
                  <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                    <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4" />
                       {row.title}
                    </h3>
                    <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
                  </div>
                  <DroppableRow id={row.id} activeId={activeId}>
                    {rowJobs.map(job => {
                      const { canMoveLeft, canMoveRight } = getJobMoveLeftRightInfo(job.id);
                      return (
                        <DraggableJobCard
                          key={job.id}
                          job={job}
                          isAdmin={isAdmin}
                          onSelectJob={onSelectJob}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onPaymentStatusChange={handlePaymentStatusChange}
                          onMoveToColumn={handleMoveToColumn}
                          onMoveLeft={handleMoveLeft}
                          onMoveRight={handleMoveRight}
                          canMoveLeft={canMoveLeft}
                          canMoveRight={canMoveRight}
                          onContextMenu={handleContextMenu}
                        />
                      );
                    })}
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
                  <div className="aspect-square rounded overflow-hidden mb-2" style={{ background: 'var(--bg-surface)' }}>
                    {activeJob.projectImages?.[0] ? (
                      <img src={getJobThumbnailUrl(activeJob.projectImages[0])} className="w-full h-full object-cover" alt="" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Box className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-[9px] line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {activeJob.data.jobTitle || 'Bez nazwy'}
                  </h4>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* KANBAN BOARD VIEW with DnD Kit */}
      {activeTab === 'ACTIVE' && viewMode === 'BOARD' && (
        <>
        <DndContext
          sensors={sensors}
          collisionDetection={cardFirstCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            {EXTENDED_ROWS_CONFIG.map(row => {
              const rowJobs = getJobsForColumn(row.id);
              return (
                <div 
                  key={row.id} 
                  className="theme-surface transition-all"
                  style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', overflow: 'visible' }}
                >
                  <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                    <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                      {row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}
                      {row.title}
                    </h3>
                    <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
                  </div>

                  <DroppableRow id={row.id} activeId={activeId}>
                    {rowJobs.length === 0 && !activeId ? (
                      <div className="text-xs font-medium italic w-full text-center p-6 border-2 border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'var(--blur)' }}>
                        Przeciągnij tutaj zlecenie
                      </div>
                    ) : (
                      rowJobs.map(job => {
                        const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
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
                            onMoveUp={job.columnId === 'PREPARE' ? handleJumpToStart : undefined}
                            onMoveDown={job.columnId === 'PREPARE' ? handleJumpToEnd : undefined}
                            canMoveLeft={canMoveLeft}
                            canMoveRight={canMoveRight}
                            canMoveUp={job.columnId === 'PREPARE' ? canMoveUp : undefined}
                            canMoveDown={job.columnId === 'PREPARE' ? canMoveDown : undefined}
                            onContextMenu={handleContextMenu}
                          />
                        );
                      })
                    )}
                  </DroppableRow>
                </div>
              );
            })}
          </div>

          {/* Drag Overlay - follows cursor */}
          <DragOverlay>
            {activeId ? (() => {
              const activeJob = jobs.find(j => j.id === activeId);
              if (!activeJob) return null;
              return (
                <div className="theme-card w-40 shadow-2xl rotate-2 opacity-95">
                  <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    {activeJob.projectImages?.[0] ? (
                      <img src={getJobThumbnailUrl(activeJob.projectImages[0])} className="w-full h-full object-cover" alt="" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Box className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <h4 className="font-bold text-[10px] line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                      {activeJob.data.jobTitle || 'Bez nazwy'}
                    </h4>
                  </div>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>

        {/* MAP for BOARD view */}
        <div className="mt-4 theme-surface overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 flex justify-between items-center">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              MAPA ZLECEŃ
            </h3>
            <div className="flex gap-1 bg-white/20 p-1" style={{ borderRadius: 'var(--radius-md)' }}>
              <button 
                onClick={() => setMapProvider('GOOGLE')} 
                className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                style={{ 
                  borderRadius: 'var(--radius-sm)',
                  background: mapProvider === 'GOOGLE' ? 'white' : 'transparent',
                  color: mapProvider === 'GOOGLE' ? 'var(--accent-primary)' : 'white'
                }}
              >
                <MapIcon className="w-3 h-3" /> Google
              </button>
              <button 
                onClick={() => setMapProvider('OSM')} 
                className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                style={{ 
                  borderRadius: 'var(--radius-sm)',
                  background: mapProvider === 'OSM' ? 'white' : 'transparent',
                  color: mapProvider === 'OSM' ? 'var(--accent-primary)' : 'white'
                }}
              >
                <Layers className="w-3 h-3" /> OSM
              </button>
            </div>
          </div>
          <div className="p-2">
            {mapProvider === 'GOOGLE' ? (
              <MapBoardGoogle 
                jobs={filteredJobs} 
                onSelectJob={onSelectJob} 
                onJobsUpdated={loadJobs}
                onChangeColumn={async (jobId, newColumnId) => {
                  setJobs(prev => prev.map(j => j.id === jobId ? { ...j, columnId: newColumnId } : j));
                  await jobsService.updateJobColumn(jobId, newColumnId);
                }}
              />
            ) : (
              <MapBoardOSM 
                jobs={filteredJobs} 
                onSelectJob={onSelectJob}
                onJobsUpdated={loadJobs}
              />
            )}
          </div>
        </div>
        </>
      )}

      {/* VERTICAL KANBAN VIEW (Trello style) - 7 columns */}
      {activeTab === 'ACTIVE' && viewMode === 'KANBAN' && (
        <>
        <DndContext
          sensors={sensors}
          collisionDetection={cardFirstCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible">
            {KANBAN_ROWS_CONFIG.map(row => {
              const rowJobs = getJobsForColumn(row.id);
              return (
                <div 
                  key={row.id} 
                  className="theme-surface flex flex-col min-w-[85vw] sm:min-w-0 sm:w-auto mr-3 sm:mr-0 snap-center border-r sm:border-r-0 border-slate-200/50 last:mr-0"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  {/* Column Header - compact */}
                  <div className={`${row.headerBg} ${row.headerText} px-3 py-3 flex justify-between items-center flex-shrink-0 sticky top-0 z-10`}>
                    <h3 className="font-bold tracking-wide text-xs sm:text-[10px] flex items-center gap-2">
                      {row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 sm:w-3 sm:h-3" />}
                      <span className="sm:hidden">{row.title}</span>
                      <span className="hidden sm:inline">{row.shortTitle}</span>
                    </h3>
                    <span className="bg-white/20 px-2 py-0.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-sm)' }}>
                      {rowJobs.length}
                    </span>
                  </div>

                  {/* Column Body - Droppable, stretches to bottom */}
                  <DroppableColumn id={row.id} activeId={activeId}>
                    <div className="flex flex-col gap-5 w-full py-4 px-2 overflow-visible">
                      {rowJobs.map(job => {
                        const { canMoveUp, canMoveDown } = getJobMoveInfo(job.id);
                        const { canMoveLeft, canMoveRight } = getJobMoveLeftRightInfo(job.id);
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
                            onPaymentStatusChange={handlePaymentStatusChange}
                            onMoveToColumn={handleMoveToColumn}
                          />
                        );
                      })}
                    </div>
                  </DroppableColumn>
                </div>
              );
            })}
          </div>

          {/* Drag Overlay - follows cursor */}
          <DragOverlay>
            {activeId ? (() => {
              const activeJob = jobs.find(j => j.id === activeId);
              if (!activeJob) return null;
              return (
                <div className="theme-card shadow-2xl rotate-2 opacity-95 p-2" style={{ width: '120px' }}>
                  <div className="aspect-square rounded overflow-hidden mb-2" style={{ background: 'var(--bg-surface)' }}>
                    {activeJob.projectImages?.[0] ? (
                      <img src={getJobThumbnailUrl(activeJob.projectImages[0])} className="w-full h-full object-cover" alt="" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Box className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-[9px] line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {activeJob.data.jobTitle || 'Bez nazwy'}
                  </h4>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>

        {/* MAP for KANBAN view */}
        <div className="mt-4 theme-surface overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 flex justify-between items-center">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              MAPA ZLECEŃ
            </h3>
            <div className="flex gap-1 bg-white/20 p-1" style={{ borderRadius: 'var(--radius-md)' }}>
              <button 
                onClick={() => setMapProvider('GOOGLE')} 
                className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                style={{ 
                  borderRadius: 'var(--radius-sm)',
                  background: mapProvider === 'GOOGLE' ? 'white' : 'transparent',
                  color: mapProvider === 'GOOGLE' ? 'var(--accent-primary)' : 'white'
                }}
              >
                <MapIcon className="w-3 h-3" /> Google
              </button>
              <button 
                onClick={() => setMapProvider('OSM')} 
                className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                style={{ 
                  borderRadius: 'var(--radius-sm)',
                  background: mapProvider === 'OSM' ? 'white' : 'transparent',
                  color: mapProvider === 'OSM' ? 'var(--accent-primary)' : 'white'
                }}
              >
                <Layers className="w-3 h-3" /> OSM
              </button>
            </div>
          </div>
          <div className="p-2">
            {mapProvider === 'GOOGLE' ? (
              <MapBoardGoogle 
                jobs={filteredJobs} 
                onSelectJob={onSelectJob} 
                onJobsUpdated={loadJobs}
                onChangeColumn={async (jobId, newColumnId) => {
                  setJobs(prev => prev.map(j => j.id === jobId ? { ...j, columnId: newColumnId } : j));
                  await jobsService.updateJobColumn(jobId, newColumnId);
                }}
              />
            ) : (
              <MapBoardOSM 
                jobs={filteredJobs} 
                onSelectJob={onSelectJob}
                onJobsUpdated={loadJobs}
              />
            )}
          </div>
        </div>
        </>
      )}

      {/* Modal wyboru typu zlecenia */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 text-center">
              <h2 className="text-2xl font-bold">Wybierz typ zlecenia</h2>
              <p className="text-slate-300 mt-1">Jak chcesz dodać nowe zlecenie?</p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Opcja: Proste zlecenie */}
              <button
                onClick={() => {
                  setShowTypeModal(false);
                  if (onCreateNewSimple) onCreateNewSimple();
                }}
                className="w-full p-5 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">📋</span>
                  <div>
                    <h3 className="text-xl font-bold text-green-700 group-hover:text-green-800">Proste zlecenie</h3>
                    <p className="text-slate-600 text-sm mt-1">Ręczne wypełnianie pól - szybkie i proste</p>
                  </div>
                </div>
              </button>
              
              {/* Opcja: AI zlecenie */}
              <button
                onClick={() => {
                  setShowTypeModal(false);
                  onCreateNew();
                }}
                className="w-full p-5 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🤖</span>
                  <div>
                    <h3 className="text-xl font-bold text-blue-700 group-hover:text-blue-800">Zlecenie AI</h3>
                    <p className="text-slate-600 text-sm mt-1">Wklej mail - Gemini wypełni dane automatycznie</p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowTypeModal(false)}
                className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu - prawy klik na kafelku */}
      {contextMenu && (
        <JobContextMenu
          job={contextMenu.job}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onPaymentStatusChange={handlePaymentStatusChange}
          onMoveToColumn={handleMoveToColumn}
          onArchive={async (id) => {
            await jobsService.updateJob(id, { status: JobStatus.ARCHIVED });
            loadJobs();
          }}
          onDelete={async (id) => {
            const job = jobs.find(j => j.id === id);
            const jobName = job?.data.jobTitle || job?.friendlyId || 'to zlecenie';
            if (window.confirm(`🗑️ Czy na pewno chcesz USUNĄĆ zlecenie?\n\n"${jobName}"\n\nTej operacji nie można cofnąć!`)) {
              // Optymistyczna aktualizacja UI
              const previousJobs = [...jobs];
              setJobs(prevJobs => prevJobs.filter(j => j.id !== id));
              setContextMenu(null); // Zamknij menu
              
              try {
                await jobsService.deleteJob(id);
                console.log('✅ Zlecenie usunięte:', id);
              } catch (err) {
                console.error('❌ Błąd usuwania:', err);
                setJobs(previousJobs);
                alert('Nie udało się usunąć zlecenia.');
              }
            }
          }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

export default Dashboard;
