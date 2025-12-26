import React from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Box, CheckCircle2 } from 'lucide-react';
import { Job, JobColumnId, PaymentStatus } from '../../types';
import { EXTENDED_ROWS_CONFIG } from './DashboardConstants';
import { DroppableRow } from './DroppableContainers';
import { DraggableJobCard } from './JobCards';
import { DashboardMapSection } from './DashboardMapSection';
import { getJobThumbnailUrl } from '../../utils/imageUtils';

interface DashboardBoardViewProps {
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
  getJobMoveLeftRightInfo: (jobId: string) => { canMoveLeft: boolean; canMoveRight: boolean; canMoveUp?: boolean; canMoveDown?: boolean };
  handleContextMenu: (e: React.MouseEvent, job: Job) => void;
  mapProvider: 'GOOGLE' | 'OSM';
  setMapProvider: (v: 'GOOGLE' | 'OSM') => void;
  filteredJobs: Job[];
  loadJobs: () => void;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  jobs: Job[];
}

export const DashboardBoardView: React.FC<DashboardBoardViewProps> = ({
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
                    <SortableContext 
                      items={rowJobs.map(j => `${j.id}-${j.createdAt}`)} 
                      strategy={rectSortingStrategy}
                    >
                      {rowJobs.map((job: Job) => {
                        const { canMoveLeft, canMoveRight, canMoveUp, canMoveDown } = getJobMoveLeftRightInfo(job.id);
                        const isPrepare = (job.columnId || 'PREPARE') === 'PREPARE';
                        return (
                          <div key={job.id}>
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
                              onMoveUp={isPrepare ? handleJumpToStart : undefined}
                              onMoveDown={isPrepare ? handleJumpToEnd : undefined}
                              canMoveLeft={canMoveLeft}
                              canMoveRight={canMoveRight}
                              canMoveUp={isPrepare ? canMoveUp : undefined}
                              canMoveDown={isPrepare ? canMoveDown : undefined}
                              onContextMenu={handleContextMenu}
                            />
                          </div>
                        );
                      })}
                    </SortableContext>
                  )}
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

