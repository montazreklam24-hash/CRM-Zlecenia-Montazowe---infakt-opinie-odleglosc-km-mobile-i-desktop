import React from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, CheckCircle2 } from 'lucide-react';
import { Job, JobColumnId, PaymentStatus } from '../../types';
import { KANBAN_ROWS_CONFIG } from './DashboardConstants';
import { DroppableColumn } from './DroppableContainers';
import { SmallKanbanCard } from './JobCards';
import { DashboardMapSection } from './DashboardMapSection';
import { getJobThumbnailUrl } from '../../utils/imageUtils';

interface DashboardKanbanViewProps {
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
  handleMoveUp: (jobId: string) => Promise<void>;
  handleMoveDown: (jobId: string) => Promise<void>;
  getJobMoveInfo: (jobId: string) => { canMoveUp: boolean; canMoveDown: boolean };
  getJobMoveLeftRightInfo: (jobId: string) => { canMoveLeft: boolean; canMoveRight: boolean; canMoveUp?: boolean; canMoveDown?: boolean };
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
  mapProvider: 'GOOGLE' | 'OSM';
  setMapProvider: (v: 'GOOGLE' | 'OSM') => void;
  filteredJobs: Job[];
  loadJobs: () => void;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  jobs: Job[];
}

export const DashboardKanbanView: React.FC<DashboardKanbanViewProps> = ({
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
  handleMoveUp,
  handleMoveDown,
  getJobMoveInfo,
  getJobMoveLeftRightInfo,
  handleContextMenu,
  mapProvider,
  setMapProvider,
  filteredJobs,
  loadJobs,
  setJobs,
  jobs
}) => {
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:grid-cols-7 sm:gap-3 sm:overflow-visible w-full min-h-[600px]">
          {KANBAN_ROWS_CONFIG.map(row => {
            const rowJobs = getJobsForColumn(row.id);
            return (
              <div 
                key={row.id} 
                className="theme-surface flex flex-col min-w-[85vw] sm:min-w-[150px] sm:w-full h-full mr-3 sm:mr-0 snap-center border-r sm:border-r-0 border-slate-200/50 last:mr-0"
                style={{ borderRadius: 'var(--radius-lg)', minWidth: '0' }}
              >
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

                <DroppableColumn id={row.id} activeId={activeId}>
                  <div className="flex flex-col gap-5 w-full py-4 px-2 overflow-visible">
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
                            onPaymentStatusChange={handlePaymentStatusChange}
                            onMoveToColumn={handleMoveToColumn}
                            onContextMenu={handleContextMenu}
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

      <DashboardMapSection 
        mapProvider={mapProvider}
        setMapProvider={setMapProvider}
        filteredJobs={filteredJobs}
        onSelectJob={onSelectJob}
        loadJobs={loadJobs}
        setJobs={setJobs}
      />
    </>
  );
};

