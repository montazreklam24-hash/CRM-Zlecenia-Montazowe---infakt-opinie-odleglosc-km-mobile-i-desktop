import React, { useEffect, useState, useRef } from 'react';
import { Job, JobStatus, UserRole, JobColumnId, PaymentStatus } from '../types';
import { jobsService } from '../services/apiService';
import { 
  Plus, MapPin, CheckCircle2, Trash2, Box, Kanban, 
  Download, Copy, RefreshCw, Search, StretchHorizontal, ExternalLink,
  ChevronUp, ChevronDown, Map as MapIcon, Layers, LayoutDashboard,
  ChevronLeft, ChevronRight, Archive
} from 'lucide-react';
import MapBoardGoogle from './MapBoardGoogle';
import MapBoardOSM from './MapBoardOSM';
import PaymentStatusBadge, { PaymentStatusBar, PaymentStatusIcon } from './PaymentStatusBadge';

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
}

// Helper function for payment status color
const getPaymentStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return '#22c55e'; // green
    case PaymentStatus.PROFORMA: return '#f97316'; // orange
    case PaymentStatus.PARTIAL: return '#a855f7'; // purple
    case PaymentStatus.CASH: return '#eab308'; // yellow
    case PaymentStatus.OVERDUE: return '#ef4444'; // red
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

const DraggableJobCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveLeft, onMoveRight, canMoveLeft, canMoveRight
}) => {
  // Draggable
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: job.id,
  });
  
  // Also droppable (for dropping other cards on this one)
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `card-${job.id}`,
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

  const [showClickHint, setShowClickHint] = useState(false);
  const [showArrows, setShowArrows] = useState(false);

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
        className="relative group"
        onMouseEnter={() => setShowArrows(true)}
        onMouseLeave={() => setShowArrows(false)}
      >
        {/* LEFT arrow - appears on hover at left */}
        {showArrows && canMoveLeft && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveLeft?.(job.id); }}
            className="absolute top-1/2 -left-3 -translate-y-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title="Przesuń w lewo"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {/* RIGHT arrow - appears on hover at right */}
        {showArrows && canMoveRight && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveRight?.(job.id); }}
            className="absolute top-1/2 -right-3 -translate-y-1/2 z-20 p-0.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-110 transition-all"
            title="Przesuń w prawo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div 
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onClick={handleCardClick}
          onDoubleClick={handleCardDoubleClick}
          className={`theme-card min-w-[160px] w-40 cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group relative flex flex-col overflow-hidden touch-none ${showDropIndicator ? 'ring-2 ring-blue-400' : ''}`}
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
        {/* Image with payment status bar on top */}
        <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
          {/* Payment Status Bar - 8% height at top */}
          {job.paymentStatus && job.paymentStatus !== PaymentStatus.NONE && (
            <div 
              className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center"
              style={{ 
                height: '8%', 
                minHeight: '12px',
                background: paymentColor,
                color: 'white',
                fontSize: '8px',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}
            >
              {paymentLabel}
            </div>
          )}
          
          {job.projectImages?.[0] ? (
            <img src={job.projectImages[0]} className="w-full h-full object-cover pointer-events-none" alt="preview" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              <Box className="w-10 h-10" />
            </div>
          )}
          
          {/* Job ID - more subtle */}
          <div 
            className="absolute bottom-2 right-2 text-[9px] font-medium px-1.5 py-0.5 backdrop-blur-sm" 
            style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius-sm)' }}
          >
            {job.friendlyId}
          </div>
        </div>
        
        <div className="p-3 flex flex-col" style={{ minHeight: '110px' }}>
          {/* Title - max 3 linie */}
          <h4 className="font-bold text-xs leading-tight mb-2 line-clamp-3" style={{ color: 'var(--text-primary)' }}>
            {job.data.jobTitle}
          </h4>
          
          {/* Full Address */}
          <div className="flex items-start gap-1 text-[10px] mb-2" style={{ color: 'var(--text-secondary)' }}>
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-orange)' }} />
            <span className="truncate">{job.data.address || 'Brak adresu'}</span>
          </div>
          
          {/* Phone Number - bold black */}
          {job.data.phoneNumber && (
            <div className="text-[11px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              📞 {job.data.phoneNumber}
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
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} 
                  className="p-1 hover:text-red-500 hover:bg-slate-100 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  title="Usuń"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
}

// Drop zone placeholder - wykrywany jako cel upuszczenia dla kolumny
const ColumnDropZone: React.FC<{ columnId: string }> = ({ columnId }) => {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  
  return (
    <div 
      ref={setNodeRef}
      className={`w-full h-16 mt-2 rounded-lg border-2 border-dashed transition-all flex items-center justify-center ${
        isOver 
          ? 'border-blue-500 bg-blue-100/50 scale-105' 
          : 'border-transparent hover:border-gray-300/50'
      }`}
    >
      {isOver && <span className="text-xs text-blue-500 font-medium">Upuść tutaj</span>}
    </div>
  );
};

// Droppable for horizontal board (row layout)
const DroppableRow: React.FC<DroppableColumnProps> = ({ id, children }) => {
  return (
    <div 
      className="p-4 flex flex-wrap gap-3 min-h-[180px] items-start content-start transition-all"
      style={{ 
        background: 'var(--bg-surface)', 
        backdropFilter: 'var(--blur)', 
        WebkitBackdropFilter: 'var(--blur)' 
      }}
    >
      {children}
      <ColumnDropZone columnId={id} />
    </div>
  );
};

// Droppable for vertical kanban (column layout)
const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children }) => {
  return (
    <div 
      className="p-2 min-h-[400px] flex-1 transition-all flex flex-col"
      style={{ 
        background: 'var(--bg-surface)', 
        backdropFilter: 'var(--blur)', 
        WebkitBackdropFilter: 'var(--blur)' 
      }}
    >
      {children}
      <ColumnDropZone columnId={id} />
    </div>
  );
};

// Small Kanban Card (for narrow vertical columns)
const SmallKanbanCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown 
}) => {
  // Draggable
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: job.id,
  });
  
  // Also droppable (for dropping other cards on this one)
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `card-${job.id}`,
    data: { type: 'card', jobId: job.id }
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const [showClickHint, setShowClickHint] = useState(false);
  const [showArrows, setShowArrows] = useState(false);

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
        
        <div 
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onDoubleClick={handleCardDoubleClick}
          className={`theme-card cursor-grab active:cursor-grabbing transition-all hover:shadow-md relative overflow-hidden touch-none ${showDropIndicator ? 'ring-2 ring-blue-400' : ''}`}
        >
        {/* Payment status bar on top */}
        {job.paymentStatus && job.paymentStatus !== PaymentStatus.NONE && (
          <div 
            className="flex items-center justify-center"
            style={{ 
              height: '14px',
              background: paymentColor,
              color: 'white',
              fontSize: '7px',
              fontWeight: 700,
              letterSpacing: '0.3px'
            }}
          >
            {paymentLabel}
          </div>
        )}

        {/* Thumbnail */}
        <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
          {job.projectImages?.[0] ? (
            <img src={job.projectImages[0]} className="w-full h-full object-cover pointer-events-none" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Box className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
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

        {/* Content - compact, fixed height */}
        <div className="p-3 flex flex-col" style={{ minHeight: '100px' }}>
          <h4 className="font-bold text-xs leading-snug mb-2 line-clamp-3" style={{ color: 'var(--text-primary)' }}>
            {job.data.jobTitle}
          </h4>
          
          {/* Address - one line */}
          <div className="text-[10px] truncate mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex-shrink-0">📍</span> {job.data.address?.split(',')[0] || 'Brak'}
          </div>
          
          {/* Phone */}
          {job.data.phoneNumber && (
            <div className="text-[10px] font-bold truncate mb-2" style={{ color: 'var(--text-primary)' }}>
              📞 {job.data.phoneNumber}
            </div>
          )}

          {/* Bottom row: Amount + Actions */}
          <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100">
            {job.totalGross && job.totalGross > 0 ? (
              <span className="text-[10px] font-bold" style={{ color: 'var(--accent-primary)' }}>
                {job.totalGross.toFixed(0)} zł
              </span>
            ) : <span />}
            
            {/* Delete/Duplicate buttons */}
            {isAdmin && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(job.id, e); }} 
                  className="p-1 rounded hover:bg-slate-100"
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
                  onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} 
                  className="p-1 rounded hover:bg-slate-100 hover:text-red-500"
                  style={{ color: 'var(--text-muted)' }}
                  title="Usuń"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ role, onSelectJob, onCreateNew, onCreateNewSimple, initialTab }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [viewMode, setViewMode] = useState<'BOARD' | 'KANBAN' | 'MIXED'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'BOARD' | 'KANBAN' | 'MIXED') || 'MIXED';
  });

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode);
  }, [viewMode]);
  const [mapProvider, setMapProvider] = useState<'GOOGLE' | 'OSM'>('GOOGLE'); // Wybór mapy
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const healingDoneRef = useRef(false); // Zapobiega wielokrotnemu uruchamianiu healJobs

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
            
            console.log(`✅ Auto-Heal: Naprawiono ${job.friendlyId} (${bestMatch.formattedAddress})`);
          }
        } catch (e) {
          console.error(`❌ Auto-Heal błąd dla ${job.friendlyId}:`, e);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Odśwież listę po naprawie
      if (jobsToHeal.length > 0) {
        loadJobs();
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

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await jobsService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === id);
    const jobName = job?.data.jobTitle || job?.friendlyId || 'to zlecenie';
    if (window.confirm(`🗑️ Czy na pewno chcesz USUNĄĆ zlecenie?\n\n"${jobName}"\n\nTej operacji nie można cofnąć!`)) {
      await jobsService.deleteJob(id);
      loadJobs();
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Zduplikować to zlecenie?')) {
      await jobsService.duplicateJob(id);
      loadJobs();
    }
  };

  // Move job up in the same column
  const handleMoveUp = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
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
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
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
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    
    return {
      canMoveUp: currentIndex > 0,
      canMoveDown: currentIndex < columnJobs.length - 1
    };
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
    const id = event.active.id as string;
    const job = jobs.find(j => j.id === id);
    console.log('🟢 DRAG START:', {
      jobId: id,
      jobTitle: job?.data.jobTitle,
      currentColumn: job?.columnId || 'PREPARE'
    });
    setActiveId(id);
    setOverId(null);
  };

  // DnD over handler - just tracks which item we're over for visual feedback
  const handleDragOver = (event: DragOverEvent) => {
    let overId = event.over?.id as string || null;
    
    // Extract job ID if it's a card drop target
    if (overId && overId.startsWith('card-')) {
      overId = overId.replace('card-', '');
    }
    
    const allColumnIds = ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'COMPLETED'];
    
    if (overId && overId !== event.active.id) {
      const isColumn = allColumnIds.includes(overId);
      const overJob = !isColumn ? jobs.find(j => j.id === overId) : null;
      console.log('🟡 DRAG OVER:', {
        overId,
        isColumn,
        overJobTitle: overJob?.data.jobTitle,
        overJobColumn: overJob?.columnId || (isColumn ? overId : 'PREPARE')
      });
    }
    setOverId(overId);
  };

  // DnD Kit handler - handles column changes and reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Clear states
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const draggedId = active.id as string;
    let droppedOnId = over.id as string;
    
    // Extract job ID if dropped on a card (format: "card-{jobId}")
    const isCardDrop = droppedOnId.startsWith('card-');
    if (isCardDrop) {
      droppedOnId = droppedOnId.replace('card-', '');
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
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
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
      console.log('🟣 ENTERING REORDER BLOCK');
      const sourceJobs = jobs
        .filter(j => (j.columnId || 'PREPARE') === sourceColumn)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const currentIndex = sourceJobs.findIndex(j => j.id === draggedId);
      
      console.log('🔵 REORDER DEBUG:', {
        sourceJobs: sourceJobs.map(j => ({ id: j.id, title: j.data.jobTitle?.substring(0, 15), order: j.order })),
        currentIndex,
        newOrder,
        insertBeforeJobId
      });
      
      if (currentIndex === -1) {
        console.log('❌ currentIndex is -1, aborting');
        return;
      }
      
      // If dropping on same position, do nothing
      if (currentIndex === newOrder) {
        console.log('❌ Same position, aborting');
        return;
      }
      
      // Reorder array - remove dragged item and insert at new position
      const reordered = sourceJobs.filter(j => j.id !== draggedId);
      const draggedJob = sourceJobs[currentIndex];
      
      // Calculate insert position
      let insertAt = newOrder;
      if (newOrder > currentIndex) {
        insertAt = newOrder - 1; // Adjust because we removed one item before this position
      }
      
      console.log('🔵 Insert at:', insertAt);
      
      reordered.splice(insertAt, 0, draggedJob);
      
      console.log('🔵 After reorder:', reordered.map(j => ({ id: j.id, title: j.data.jobTitle?.substring(0, 15) })));
      
      // Update orders
      const orderMap = new Map<string, number>();
      reordered.forEach((job, idx) => orderMap.set(job.id, idx));
      
      setJobs(prev => {
        const updated = prev.map(job => 
          orderMap.has(job.id) ? { ...job, order: orderMap.get(job.id)! } : job
        );
        console.log('🔵 NEW STATE:', updated.filter(j => (j.columnId || 'PREPARE') === sourceColumn).sort((a,b) => (a.order||0)-(b.order||0)).map(j => ({ title: j.data.jobTitle?.substring(0,15), order: j.order })));
        return updated;
      });
      
      await jobsService.updateJobPosition(draggedId, targetColumn, orderMap.get(draggedId) || 0);
      console.log('✅ Reorder complete');
    } else {
      // Moving to different column
      // Update all orders in target column to make room
      const updatedJobs = jobs.map(job => {
        if (job.id === draggedId) {
          // Move the dragged job to new column
          return { ...job, columnId: targetColumn, order: newOrder };
        }
        if ((job.columnId || 'PREPARE') === targetColumn) {
          // Shift jobs at or after insertion point
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
    
    return matchesTab && matchesSearch;
  });

  const getJobsForColumn = (colId: JobColumnId) => {
    const result = filteredJobs
      .filter(j => (j.columnId || 'PREPARE') === colId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    // Debug: log when rendering WED column
    if (colId === 'WED' && result.length > 0) {
      console.log('🟠 RENDER WED:', result.map(j => ({ title: j.data.jobTitle?.substring(0,15), order: j.order })));
    }
    return result;
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
      <div className="flex flex-col gap-3 mb-4">
        {/* Row 1: Tabs + New button */}
        <div className="flex justify-between items-center gap-2">
          <div className="theme-surface flex p-1 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
            <button 
              onClick={() => setActiveTab('ACTIVE')}
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
              onClick={() => setActiveTab('ARCHIVED')}
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
          
          {isAdmin && (
            <button 
              onClick={() => setShowTypeModal(true)} 
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
            onClick={loadJobs}
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

      {/* MIXED VIEW (New Layout) */}
      {viewMode === 'MIXED' && (
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
                <div key={row.id} className="theme-surface overflow-hidden transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor.replace('text-', '') }}>
                  <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`}>
                    <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                       {row.title}
                    </h3>
                    <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
                  </div>
                  <DroppableRow id={row.id}>
                    {rowJobs.length === 0 && !activeId ? (
                      <div className="text-xs font-medium italic w-full text-center p-6 border-2 border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'var(--blur)' }}>
                        Przeciągnij tutaj zlecenie
                      </div>
                    ) : (
                      rowJobs.map(job => (
                        <DraggableJobCard
                          key={job.id}
                          job={job}
                          isAdmin={isAdmin}
                          onSelectJob={onSelectJob}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                        />
                      ))
                    )}
                  </DroppableRow>
                </div>
               );
            })}

            {/* 2. MIDDLE: MON-FRI COLUMNS (Vertical Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
               {ROWS_CONFIG.filter(r => ['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(r.id)).map(row => {
                  const rowJobs = getJobsForColumn(row.id);
                  return (
                    <div key={row.id} className="theme-surface flex flex-col min-h-[500px]" style={{ borderRadius: 'var(--radius-lg)' }}>
                      <div className={`${row.headerBg} ${row.headerText} px-3 py-3 flex justify-between items-center sticky top-0 z-10`}>
                         <h3 className="font-bold tracking-wide text-xs sm:text-[10px] flex items-center gap-2">
                           <span className="sm:hidden">{row.title}</span>
                           <span className="hidden sm:inline">{row.shortTitle}</span>
                         </h3>
                         <span className="bg-white/20 px-2 py-0.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-sm)' }}>{rowJobs.length}</span>
                      </div>
                      <DroppableColumn id={row.id}>
                         <div className="flex flex-col gap-3 w-full p-1">
                            {rowJobs.map(job => {
                               const { canMoveUp, canMoveDown } = getJobMoveInfo(job.id);
                               return (
                                  <SmallKanbanCard
                                    key={job.id}
                                    job={job}
                                    isAdmin={isAdmin}
                                    onSelectJob={onSelectJob}
                                    onDelete={handleDelete}
                                    onDuplicate={handleDuplicate}
                                    onMoveUp={handleMoveUp}
                                    onMoveDown={handleMoveDown}
                                    canMoveUp={canMoveUp}
                                    canMoveDown={canMoveDown}
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
                      await jobsService.updateJobColumn(jobId, newColumnId);
                    }}
                  />
                ) : (
                  <MapBoardOSM 
                    jobs={filteredJobs} 
                    onSelectJob={onSelectJob} 
                  />
                )}
              </div>
            </div>

            {/* 4. BOTTOM: COMPLETED ROW (Horizontal) */}
            {ROWS_CONFIG.filter(r => r.id === 'COMPLETED').map(row => {
               const rowJobs = getJobsForColumn(row.id);
               return (
                <div key={row.id} className="theme-surface overflow-hidden transition-all" style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid', borderColor: row.dotColor.replace('text-', '') }}>
                  <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`}>
                    <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4" />
                       {row.title}
                    </h3>
                    <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
                  </div>
                  <DroppableRow id={row.id}>
                    {rowJobs.map(job => (
                      <DraggableJobCard
                        key={job.id}
                        job={job}
                        isAdmin={isAdmin}
                        onSelectJob={onSelectJob}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                      />
                    ))}
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
                      <img src={activeJob.projectImages[0]} className="w-full h-full object-cover" alt="" />
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
      {viewMode === 'BOARD' && (
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
                  className="theme-surface overflow-hidden transition-all"
                  style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid' }}
                >
                  <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`}>
                    <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                      {row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}
                      {row.title}
                    </h3>
                    <span className="bg-white/20 px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 'var(--radius-md)' }}>{rowJobs.length}</span>
                  </div>

                  <DroppableRow id={row.id}>
                    {rowJobs.length === 0 && !activeId ? (
                      <div className="text-xs font-medium italic w-full text-center p-6 border-2 border-dashed rounded-xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-medium)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'var(--blur)' }}>
                        Przeciągnij tutaj zlecenie
                      </div>
                    ) : (
                      rowJobs.map(job => (
                        <DraggableJobCard
                          key={job.id}
                          job={job}
                          isAdmin={isAdmin}
                          onSelectJob={onSelectJob}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                        />
                      ))
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
                      <img src={activeJob.projectImages[0]} className="w-full h-full object-cover" alt="" />
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
              />
            )}
          </div>
        </div>
        </>
      )}

      {/* VERTICAL KANBAN VIEW (Trello style) - 7 columns */}
      {viewMode === 'KANBAN' && (
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
                  <DroppableColumn id={row.id}>
                    <div className="flex flex-col gap-3 w-full p-1">
                      {rowJobs.map(job => {
                        const { canMoveUp, canMoveDown } = getJobMoveInfo(job.id);
                        return (
                          <SmallKanbanCard
                            key={job.id}
                            job={job}
                            isAdmin={isAdmin}
                            onSelectJob={onSelectJob}
                            onDelete={handleDelete}
                            onDuplicate={handleDuplicate}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                            canMoveUp={canMoveUp}
                            canMoveDown={canMoveDown}
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
                      <img src={activeJob.projectImages[0]} className="w-full h-full object-cover" alt="" />
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
    </div>
  );
};

export default Dashboard;
