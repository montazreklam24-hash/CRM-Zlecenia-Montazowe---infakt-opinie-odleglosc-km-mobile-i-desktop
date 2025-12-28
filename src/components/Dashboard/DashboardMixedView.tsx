import React from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, CheckCircle2 } from 'lucide-react';
import { Job, JobColumnId, PaymentStatus } from '../../types';
import { ROWS_CONFIG } from './DashboardConstants';
import { DroppableRow, DroppableColumn } from './DroppableContainers';
import { DraggableJobCard, SmallKanbanCard } from './JobCards';
import { DashboardMapSection } from './DashboardMapSection';
import { getJobThumbnailUrl } from '../../utils/imageUtils';

interface DashboardMixedViewProps {
  sensors: any;
  collisionDetection: any;
  handleDragStart: (e: any) => void;
  handleDragOver: (e: any) => void;
  handleDragEnd: (e: any) => Promise<void>;
  getJobsForColumn: (colId: JobColumnId) => Job[];
  activeId: string | null;
  isAdmin: boolean;
  onSelectJob: (job: Job) => void;
  handleDelete: (id: string, e: React.MouseEvent) => void;
  handleDuplicate: (id: string, e: React.MouseEvent) => void;
  handleArchive: (id: string, e: React.MouseEvent) => void;
  handlePaymentStatusChange: (jobId: string, status: PaymentStatus) => Promise<void>;
  handleMoveToColumn: (jobId: string, columnId: JobColumnId) => Promise<void>;
  handleMoveLeft: (jobId: string) => Promise<void>;
  handleMoveRight: (jobId: string) => Promise<void>;
  handleJumpToStart: (jobId: string) => Promise<void>;
  handleJumpToEnd: (jobId: string) => Promise<void>;
  handleMoveUp: (jobId: string) => Promise<void>;
  handleMoveDown: (jobId: string) => Promise<void>;
  getJobMoveInfo: (jobId: string) => { canMoveUp: boolean; canMoveDown: boolean };
  getJobMoveLeftRightInfo: (jobId: string) => { canMoveLeft: boolean; canMoveRight: boolean; canMoveUp?: boolean; canMoveDown?: boolean };
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
  showWeekend: boolean;
  setShowWeekend: (v: boolean) => void;
  mapProvider: 'GOOGLE' | 'OSM';
  setMapProvider: (v: 'GOOGLE' | 'OSM') => void;
  filteredJobs: Job[];
  loadJobs: () => void;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  jobs: Job[];
}

export const DashboardMixedView: React.FC<DashboardMixedViewProps> = ({
  sensors,
  collisionDetection,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  getJobsForColumn,
  activeId,
  isAdmin,
  onSelectJob,
  handleDelete,
  handleDuplicate,
  handleArchive,
  handlePaymentStatusChange,
  handleMoveToColumn,
  handleMoveLeft,
  handleMoveRight,
  handleJumpToStart,
  handleJumpToEnd,
  handleMoveUp,
  handleMoveDown,
  getJobMoveInfo,
  getJobMoveLeftRightInfo,
  handleContextMenu,
  showWeekend,
  setShowWeekend,
  mapProvider,
  setMapProvider,
  filteredJobs,
  loadJobs,
  setJobs,
  jobs
}) => {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
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
                  <SortableContext 
                    items={rowJobs.map(j => `${j.id}-${j.createdAt}`)} 
                    strategy={rectSortingStrategy}
                  >
                    {rowJobs.map((job: Job) => {
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
                          onMoveLeft={handleMoveUp}
                          onMoveRight={handleMoveDown}
                          onMoveUp={handleMoveLeft}
                          onMoveDown={handleMoveRight}
                          canMoveLeft={canMoveLeft}
                          canMoveRight={canMoveRight}
                          canMoveUp={canMoveUp}
                          canMoveDown={canMoveDown}
                          onContextMenu={handleContextMenu}
                        />
                      );
                    })}
                  </SortableContext>
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
        
        <div className={`grid grid-cols-1 gap-4 transition-all duration-300 w-full ${showWeekend ? 'sm:grid-cols-7' : 'sm:grid-cols-5'}`}>
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
                <div key={row.id} className={`theme-surface flex flex-col min-h-[600px] h-full transition-all ${isToday ? 'ring-2 ring-blue-500 shadow-xl z-20' : ''}`} style={{ borderRadius: 'var(--radius-lg)', minWidth: '0' }}>
                  <div className={`${row.headerBg} ${row.headerText} px-3 py-3 flex justify-between items-center sticky top-0 z-10`} style={{ borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
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
                        <SortableContext 
                          items={rowJobs.map(j => `${j.id}-${j.createdAt}`)} 
                          strategy={verticalListSortingStrategy}
                        >
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
                        </SortableContext>
                     </div>
                  </DroppableColumn>
                </div>
              );
           })}
        </div>

        {/* 3. MAP with toggle buttons */}
        <DashboardMapSection 
          mapProvider={mapProvider}
          setMapProvider={setMapProvider}
          filteredJobs={filteredJobs}
          onSelectJob={onSelectJob}
          loadJobs={loadJobs}
          setJobs={setJobs}
        />

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
                <SortableContext 
                  items={rowJobs.map(j => `${j.id}-${j.createdAt}`)} 
                  strategy={rectSortingStrategy}
                >
                  {rowJobs.map((job) => {
                    const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
                    return (
                      <div key={job.id}>
                        <DraggableJobCard
                          job={job}
                          isAdmin={isAdmin}
                          onSelectJob={onSelectJob}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onPaymentStatusChange={handlePaymentStatusChange}
                          onMoveToColumn={handleMoveToColumn}
                          onMoveLeft={handleMoveUp}
                          onMoveRight={handleMoveDown}
                          onMoveUp={handleMoveLeft}
                          onMoveDown={handleMoveRight}
                          canMoveLeft={canMoveLeft}
                          canMoveRight={canMoveRight}
                          canMoveUp={canMoveUp}
                          canMoveDown={canMoveDown}
                          onContextMenu={handleContextMenu}
                        />
                      </div>
                    );
                  })}
                </SortableContext>
              </DroppableRow>
            </div>
           );
        })}
      </div>

      <DragOverlay zIndex={10000}>
        {activeId ? (() => {
          const activeJob = jobs.find(j => j.id === activeId);
          if (!activeJob) return null;
          return createPortal(
            <div className="theme-card shadow-2xl rotate-2 opacity-95 p-2 pointer-events-none" style={{ width: '120px', zIndex: 10000 }}>
              <div className="aspect-square rounded overflow-hidden mb-2" style={{ background: 'var(--bg-surface)' }}>
                {activeJob.projectImages?.[0] ? (
                  <img src={getJobThumbnailUrl(activeJob.projectImages[0])} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Box className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
              </div>
              <h4 className="font-bold text-[9px] line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {activeJob.data.jobTitle || 'Bez nazwy'}
              </h4>
            </div>,
            document.body
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
};

