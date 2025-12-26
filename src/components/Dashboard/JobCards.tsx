import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, 
  Copy, Archive, Trash2, MapPin, Box 
} from 'lucide-react';
import { Job, JobColumnId, PaymentStatus } from '../../types';
import { getJobThumbnailUrl } from '../../utils/imageUtils';
import { PaymentStatusBar, PaymentStatusMiniMenu } from '../PaymentStatusBadge';
import JobPlaceholder from '../JobPlaceholder';
import { BASE_COORDS, MOVE_COLUMNS } from './DashboardConstants';
import { 
  calculateDistance, 
  parseAddressForNav, 
  formatPhoneNumber, 
  getPaymentStatusColor, 
  getPaymentStatusLabel 
} from './DashboardUtils';

export interface DraggableJobCardProps {
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

export const DraggableJobCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveLeft, onMoveRight, onMoveUp, onMoveDown, canMoveLeft, canMoveRight, canMoveUp, canMoveDown,
  onPaymentStatusChange, onMoveToColumn, onContextMenu
}) => {
  const uniqueDragId = `${job.id}-${job.createdAt}`;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: uniqueDragId,
    data: { jobId: job.id }
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
  };

  const [showClickHint, setShowClickHint] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const distance = job.data.coordinates 
    ? calculateDistance(BASE_COORDS.lat, BASE_COORDS.lng, job.data.coordinates.lat, job.data.coordinates.lng)
    : null;
  const addressParts = parseAddressForNav(job.data.address);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging) return;
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
    <div 
      className="relative group h-full"
      data-job-id={job.id}
      onMouseEnter={() => setShowArrows(true)}
      onMouseLeave={() => setShowArrows(false)}
    >
        {/* LEFT arrow - zawsze widoczne */}
        {(canMoveLeft || canMoveLeft === false) && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveLeft) onMoveLeft?.(job.id); }}
            disabled={!canMoveLeft}
            className={`absolute top-1/2 -left-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all ${
              canMoveLeft 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-125 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
            }`}
            title={canMoveLeft ? "Przesuń o 1 w lewo" : "Pierwsza pozycja"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {/* RIGHT arrow - zawsze widoczne */}
        {(canMoveRight || canMoveRight === false) && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveRight) onMoveRight?.(job.id); }}
            disabled={!canMoveRight}
            className={`absolute top-1/2 -right-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all ${
              canMoveRight 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-125 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
            }`}
            title={canMoveRight ? "Przesuń o 1 w prawo" : "Ostatnia pozycja"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* UP arrow */}
        {canMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(job.id); }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-125 transition-all"
            title={currentColumnId === 'PREPARE' ? "Na sam początek" : "Przesuń w górę"}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}

        {/* DOWN arrow */}
        {canMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(job.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-125 transition-all"
            title={currentColumnId === 'PREPARE' ? "Na sam koniec" : "Przesuń w dół"}
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
          className={`theme-card min-w-[160px] w-full min-h-[280px] h-full cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group relative flex flex-col overflow-visible touch-none`}
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
                  {addressParts.city}
                  {distance !== null && ` • ${distance.toFixed(1)} km`}
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
          
          {job.data.scheduledDate && (
            <div className="mt-2 text-sm font-black text-black leading-tight capitalize">
              {new Date(job.data.scheduledDate).toLocaleDateString('pl-PL', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </div>
          )}
          
          <div className="flex justify-between items-center pt-2 mt-auto" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              {job.createdAt && (
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {new Date(job.createdAt).toLocaleDateString('pl-PL', { 
                    day: '2-digit', 
                    month: '2-digit',
                    year: '2-digit'
                  })}
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
  );
};

export const SmallKanbanCard: React.FC<DraggableJobCardProps> = ({ 
  job, isAdmin, onSelectJob, onDelete, onDuplicate, onArchive,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown, 
  onMoveLeft, onMoveRight, canMoveLeft, canMoveRight,
  onContextMenu, onPaymentStatusChange, onMoveToColumn
}) => {
  const uniqueDragId = `${job.id}-${job.createdAt}`;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: uniqueDragId,
    data: { jobId: job.id }
  });

  const [showClickHint, setShowClickHint] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const addressParts = parseAddressForNav(job.data.address);
  const distance = job.data.coordinates 
    ? calculateDistance(BASE_COORDS.lat, BASE_COORDS.lng, job.data.coordinates.lat, job.data.coordinates.lng)
    : null;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
  };

  const handleCardDoubleClick = () => {
    if (isDragging) return;
    setShowClickHint(false);
    onSelectJob(job);
  };

  const currentColumnId = job.columnId || 'PREPARE';

  return (
    <div 
      className="relative group"
      data-job-id={job.id}
      onMouseEnter={() => setShowArrows(true)}
      onMouseLeave={() => setShowArrows(false)}
    >
        {/* UP arrow */}
        {canMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(job.id); }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-125 transition-all"
            title="Przesuń w górę"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
        
        {/* DOWN arrow */}
        {canMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(job.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-[100] p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:scale-125 transition-all"
            title="Przesuń w dół"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        {/* LEFT arrow - zawsze widoczne */}
        {(canMoveLeft || canMoveLeft === false) && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveLeft) onMoveLeft?.(job.id); }}
            disabled={!canMoveLeft}
            className={`absolute top-1/2 -left-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all ${
              canMoveLeft 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-125 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
            }`}
            title={canMoveLeft ? "Przesuń w lewo" : "Pierwsza pozycja"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {/* RIGHT arrow - zawsze widoczne */}
        {(canMoveRight || canMoveRight === false) && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveRight) onMoveRight?.(job.id); }}
            disabled={!canMoveRight}
            className={`absolute top-1/2 -right-3 -translate-y-1/2 z-[100] p-1 rounded-full shadow-lg transition-all ${
              canMoveRight 
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-125 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
            }`}
            title={canMoveRight ? "Przesuń w prawo" : "Ostatnia pozycja"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div 
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onClick={() => {
            setShowClickHint(true);
            setTimeout(() => setShowClickHint(false), 1500);
          }}
          onDoubleClick={handleCardDoubleClick}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu?.(e, job);
          }}
          className={`theme-card w-full cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group relative flex flex-col overflow-visible touch-none p-2 min-h-[160px]`}
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

          <div className="relative mb-2">
            <PaymentStatusBar
              status={job.paymentStatus || PaymentStatus.NONE}
              onClick={(e) => { e.stopPropagation(); setShowPaymentMenu(!showPaymentMenu); }}
              showLabel={false}
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

          <div className="flex gap-2">
            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
              {job.projectImages?.[0] ? (
                <img src={getJobThumbnailUrl(job.projectImages[0])} className="w-full h-full object-cover" alt="" />
              ) : (
                <JobPlaceholder job={job} size="small" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-[10px] leading-tight line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>
                {job.data.jobTitle}
              </h4>
              <div className="flex flex-wrap gap-1">
                {job.data.scheduledDate && (
                  <div className="text-[8px] text-indigo-600 bg-indigo-50 px-1 rounded flex items-center gap-0.5">
                    <span>📅</span>
                    {new Date(job.data.scheduledDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                  </div>
                )}
                {job.totalGross && job.totalGross > 0 && (
                  <div className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                    {job.totalGross.toFixed(0)} zł
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.data.address || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 p-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors text-[9px] border border-blue-100"
            >
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{addressParts.street}</span>
            </a>

            {job.data.phoneNumber && (
              <a 
                href={`tel:${job.data.phoneNumber}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 p-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-[9px] border border-green-100 font-bold"
              >
                <span>📞</span>
                <span className="truncate">{formatPhoneNumber(job.data.phoneNumber)}</span>
              </a>
            )}
          </div>

          <div className="flex justify-between items-center mt-2 pt-1" style={{ borderTop: '1px solid var(--border-light)' }}>
            <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>#{job.friendlyId}</span>
            {isAdmin && (
              <div className="flex gap-0.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); onArchive?.(job.id, e); }} 
                  className="p-0.5 hover:bg-slate-100 rounded text-slate-400"
                >
                  <Archive className="w-2.5 h-2.5" />
                </button>
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(job.id, e); }} 
                  className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded text-slate-300"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
            >
              <span className="text-[8px] font-bold text-slate-400 uppercase">Przenieś</span>
              <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} />
            </div>
            
            {showMoveMenu && (
              <div className="grid grid-cols-4 gap-0.5 mt-0.5">
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
                      className={`py-0.5 rounded text-[7px] font-bold transition-all flex flex-col items-center ${
                        isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={col.label}
                    >
                      <span>{col.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

