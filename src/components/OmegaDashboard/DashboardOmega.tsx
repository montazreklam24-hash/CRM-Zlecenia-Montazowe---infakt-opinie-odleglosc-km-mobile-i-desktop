import React, { useEffect, useState, useRef } from 'react';
import { Job, JobStatus, UserRole, JobColumnId, PaymentStatus } from '../../types';
import { jobsService } from '../../services/apiService';
import { checkPaymentStatusChange } from '../../utils/paymentStatusGuard';
import { 
  Plus, CheckCircle2, Box 
} from 'lucide-react';
import JobContextMenu from '../JobContextMenu';
import OmegaArchive from './OmegaArchive';
import OmegaHeader from './OmegaHeader';
import OmegaMap from './OmegaMap';
import { 
  BoardViewSection, 
  KanbanViewSection, 
  PrepareSection, 
  CompletedSection, 
  WeekColumnsSection 
} from './OmegaKanban';

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
  CollisionDetection,
  pointerWithin,
  rectIntersection
} from '@dnd-kit/core';

import { getJobThumbnailUrl } from '../../utils/imageUtils';

// --- CONFIGURATION ---
const ROWS_CONFIG = [
  { id: 'PREPARE', title: 'DO PRZYGOTOWANIA', headerBg: 'bg-slate-700', headerText: 'text-white', dotColor: 'text-slate-500' },
  { id: 'MON', title: 'PONIEDZIAŁEK', shortTitle: 'PON', headerBg: 'bg-blue-600', headerText: 'text-white', dotColor: 'text-blue-500' },
  { id: 'TUE', title: 'WTOREK', shortTitle: 'WT', headerBg: 'bg-indigo-600', headerText: 'text-white', dotColor: 'text-indigo-500' },
  { id: 'WED', title: 'ŚRODA', shortTitle: 'ŚR', headerBg: 'bg-violet-600', headerText: 'text-white', dotColor: 'text-violet-500' },
  { id: 'THU', title: 'CZWARTEK', shortTitle: 'CZW', headerBg: 'bg-purple-600', headerText: 'text-white', dotColor: 'text-purple-500' },
  { id: 'FRI', title: 'PIĄTEK', shortTitle: 'PT', headerBg: 'bg-fuchsia-600', headerText: 'text-white', dotColor: 'text-fuchsia-500' },
  { id: 'SAT', title: 'SOBOTA', shortTitle: 'SB', headerBg: 'bg-orange-600', headerText: 'text-white', dotColor: 'text-orange-500' },
  { id: 'SUN', title: 'NIEDZIELA', shortTitle: 'ND', headerBg: 'bg-red-600', headerText: 'text-white', dotColor: 'text-red-500' },
  { id: 'COMPLETED', title: 'WYKONANE / DO ROZLICZENIA', headerBg: 'bg-green-600', headerText: 'text-white', dotColor: 'text-green-500' },
] as const;

const EXTENDED_ROWS_CONFIG = [
  { id: 'PREPARE', title: 'DO PRZYGOTOWANIA', headerBg: 'bg-slate-700', headerText: 'text-white', dotColor: 'text-slate-500' },
  { id: 'MON', title: 'PONIEDZIAŁEK', shortTitle: 'PON', headerBg: 'bg-blue-600', headerText: 'text-white', dotColor: 'text-blue-500' },
  { id: 'TUE', title: 'WTOREK', shortTitle: 'WT', headerBg: 'bg-indigo-600', headerText: 'text-white', dotColor: 'text-indigo-500' },
  { id: 'WED', title: 'ŚRODA', shortTitle: 'ŚR', headerBg: 'bg-violet-600', headerText: 'text-white', dotColor: 'text-violet-500' },
  { id: 'THU', title: 'CZWARTEK', shortTitle: 'CZW', headerBg: 'bg-purple-600', headerText: 'text-white', dotColor: 'text-purple-500' },
  { id: 'FRI', title: 'PIĄTEK', shortTitle: 'PT', headerBg: 'bg-fuchsia-600', headerText: 'text-white', dotColor: 'text-fuchsia-500' },
  { id: 'SAT', title: 'SOBOTA', shortTitle: 'SB', headerBg: 'bg-orange-600', headerText: 'text-white', dotColor: 'text-orange-500' },
  { id: 'SUN', title: 'NIEDZIELA', shortTitle: 'ND', headerBg: 'bg-red-600', headerText: 'text-white', dotColor: 'text-red-500' },
  { id: 'COMPLETED', title: 'WYKONANE / DO ROZLICZENIA', headerBg: 'bg-green-600', headerText: 'text-white', dotColor: 'text-green-500' },
];

const cardFirstCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const cardCollisions = pointerCollisions.filter(c => typeof c.id === 'string' && c.id.startsWith('card-'));
  const otherCollisions = pointerCollisions.filter(c => typeof c.id !== 'string' || !c.id.startsWith('card-'));
  if (cardCollisions.length > 0) return cardCollisions;
  if (otherCollisions.length > 0) return otherCollisions;
  return rectIntersection(args);
};

interface DashboardProps {
  role: UserRole;
  onSelectJob: (job: Job) => void;
  onCreateNew: () => void;
  onCreateNewSimple?: () => void;
  initialTab?: 'ACTIVE' | 'ARCHIVED';
  refreshTrigger?: number;
}

const DashboardOmega: React.FC<DashboardProps> = ({ role, onSelectJob, onCreateNew, onCreateNewSimple, initialTab, refreshTrigger }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>(() => {
    if (initialTab) return initialTab;
    const saved = localStorage.getItem('dashboard_active_tab') as 'ACTIVE' | 'ARCHIVED' | null;
    return saved || 'ACTIVE';
  });
  const [viewMode, setViewMode] = useState<'BOARD' | 'KANBAN' | 'MIXED'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'BOARD' | 'KANBAN' | 'MIXED') || 'MIXED';
  });

  useEffect(() => { localStorage.setItem('dashboard_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('dashboard_active_tab', activeTab); }, [activeTab]);
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    else if (refreshTrigger && refreshTrigger > 0) setActiveTab('ACTIVE');
  }, [initialTab, refreshTrigger]);

  const [mapProvider, setMapProvider] = useState<'GOOGLE' | 'OSM'>(() => {
    return (localStorage.getItem('dashboard_map_provider') as 'GOOGLE' | 'OSM') || 'OSM';
  });
  useEffect(() => { localStorage.setItem('dashboard_map_provider', mapProvider); }, [mapProvider]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [showWeekend, setShowWeekend] = useState(() => {
    const today = new Date().getDay();
    return today === 5 || today === 6 || today === 0;
  });
  const [showTypeModal, setShowTypeModal] = useState(false);
  const healingDoneRef = useRef(false);
  const [liveRefresh, setLiveRefresh] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; job: Job } | null>(null);
  const [archivePaymentFilter, setArchivePaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [archiveReviewFilter, setArchiveReviewFilter] = useState<'all' | 'sent' | 'not_sent'>('all');
  const [archivePaymentMenuOpen, setArchivePaymentMenuOpen] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (refreshTrigger !== undefined) loadJobs(); }, [refreshTrigger]);

  const broadcastChange = () => { localStorage.setItem('crm_last_change', Date.now().toString()); };
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crm_last_change' && e.newValue) loadJobs(true);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!liveRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadJobs(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [liveRefresh]);

  const loadJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await jobsService.getJobs();
      const seenIds = new Set<string>();
      const uniqueJobs = data.filter(job => {
        if (seenIds.has(job.id)) return false;
        seenIds.add(job.id);
        return true;
      });
      setJobs(uniqueJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const job = jobs.find(j => j.id === id);
    if (window.confirm(`🗑️ Czy na pewno chcesz USUNĄĆ zlecenie?\n\n"${job?.data.jobTitle}"`)) {
      const previousJobs = [...jobs];
      setJobs(prevJobs => prevJobs.filter(j => j.id !== id));
      try {
        await jobsService.deleteJob(id);
        broadcastChange();
      } catch (err) {
        setJobs(previousJobs);
        alert('Nie udało się usunąć zlecenia.');
      }
    }
  };

  const handleDuplicate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await jobsService.duplicateJob(id);
    broadcastChange();
    loadJobs();
  };

  const handleArchive = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const job = jobs.find(j => j.id === id);
    if (window.confirm(`📦 Czy na pewno chcesz zarchiwizować zlecenie?\n\n"${job?.data.jobTitle}"`)) {
      try {
        await jobsService.updateJob(id, { status: JobStatus.ARCHIVED });
        broadcastChange();
        loadJobs();
      } catch (err) {
        alert('Nie udało się zarchiwizować zlecenia.');
      }
    }
  };

  const handlePaymentStatusChange = async (jobId: string, newStatus: PaymentStatus, source: 'manual' | 'auto' = 'manual') => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const canChange = checkPaymentStatusChange(job, newStatus, source);
    if (!canChange) return;
    setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? { ...j, paymentStatus: newStatus } : j));
    try {
      await jobsService.updateJob(jobId, { paymentStatus: newStatus });
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleMoveToColumn = async (jobId: string, targetColumnId: JobColumnId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || (job.columnId || 'PREPARE') === targetColumnId) return;
    const targetColumnJobs = jobs.filter(j => (j.columnId || 'PREPARE') === targetColumnId && j.id !== jobId);
    const maxOrder = targetColumnJobs.length > 0 ? Math.max(...targetColumnJobs.map(j => j.order || 0)) + 1 : 0;
    setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? { ...j, columnId: targetColumnId, order: maxOrder } : j));
    try {
      await jobsService.updateJobColumn(jobId, targetColumnId, maxOrder);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, job: Job) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, job });
  };

  const handleToggleReviewRequest = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const newStatus = job.reviewRequestSentAt ? undefined : Date.now();
    try {
      await jobsService.updateJob(jobId, { reviewRequestSentAt: newStatus });
      loadJobs();
    } catch (err) {
      alert('Nie udało się zmienić statusu opinii.');
    }
  };

  // Reordering helpers (for manual arrows)
  const handleMoveUp = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex <= 0) return;
    
    const jobAbove = columnJobs[currentIndex - 1];
    const currentSortOrder = job.sortOrder || (currentIndex * 10);
    const aboveSortOrder = jobAbove.sortOrder || ((currentIndex - 1) * 10);
    
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) return { ...j, sortOrder: aboveSortOrder };
      if (j.id === jobAbove.id) return { ...j, sortOrder: currentSortOrder };
      return j;
    }));
    
    try {
      await jobsService.updateJobPosition(jobId, columnId, aboveSortOrder);
      await jobsService.updateJobPosition(jobAbove.id, columnId, currentSortOrder);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleMoveDown = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex >= columnJobs.length - 1) return;
    
    const jobBelow = columnJobs[currentIndex + 1];
    const currentSortOrder = job.sortOrder || (currentIndex * 10);
    const belowSortOrder = jobBelow.sortOrder || ((currentIndex + 1) * 10);
    
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) return { ...j, sortOrder: belowSortOrder };
      if (j.id === jobBelow.id) return { ...j, sortOrder: currentSortOrder };
      return j;
    }));
    
    try {
      await jobsService.updateJobPosition(jobId, columnId, belowSortOrder);
      await jobsService.updateJobPosition(jobBelow.id, columnId, currentSortOrder);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleMoveLeft = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    if (currentIndex <= 0) return;
    
    const targetColumnId = order[currentIndex - 1] as JobColumnId;
    handleMoveToColumn(jobId, targetColumnId);
  };

  const handleMoveRight = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    if (currentIndex < 0 || currentIndex >= order.length - 1) return;
    
    const targetColumnId = order[currentIndex + 1] as JobColumnId;
    handleMoveToColumn(jobId, targetColumnId);
  };

  const handleJumpToStart = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs.filter(j => (j.columnId || 'PREPARE') === columnId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const minSortOrder = (columnJobs[0]?.sortOrder || 0) - 10;
    
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, sortOrder: minSortOrder } : j));
    try {
      await jobsService.updateJobPosition(jobId, columnId, minSortOrder);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleJumpToEnd = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs.filter(j => (j.columnId || 'PREPARE') === columnId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const maxSortOrder = (columnJobs[columnJobs.length - 1]?.sortOrder || 0) + 10;
    
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, sortOrder: maxSortOrder } : j));
    try {
      await jobsService.updateJobPosition(jobId, columnId, maxSortOrder);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const getColumnOrder = () => ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'COMPLETED'];
  
  const getJobMoveInfo = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return { canMoveUp: false, canMoveDown: false };
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs.filter(j => (j.columnId || 'PREPARE') === columnId).sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = columnJobs.findIndex(j => j.id === id);
    return { canMoveUp: idx > 0, canMoveDown: idx < columnJobs.length - 1 };
  };

  const getJobMoveLeftRightInfo = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return { canMoveLeft: false, canMoveRight: false, canMoveUp: false, canMoveDown: false };
    
    const columnId = job.columnId || 'PREPARE';
    const isHorizontal = columnId === 'PREPARE' || columnId === 'COMPLETED';
    
    const order = getColumnOrder();
    const colIdx = order.indexOf(columnId);
    const colJobs = jobs.filter(j => (j.columnId || 'PREPARE') === columnId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const jobIdx = colJobs.findIndex(j => j.id === id);
    
    if (isHorizontal) {
      // Dla wierszy poziomych (Przygotowanie, Wykonane):
      // Lewo/Prawo porusza się wewnątrz wiersza (sortOrder)
      // Góra/Dół porusza się między kolumnami (order)
      return {
        canMoveLeft: jobIdx > 0,
        canMoveRight: jobIdx < colJobs.length - 1,
        canMoveUp: colIdx > 0,
        canMoveDown: colIdx < order.length - 1
      };
    } else {
      // Dla kolumn pionowych (Dni tygodnia):
      // Góra/Dół porusza się wewnątrz kolumny (sortOrder)
      // Lewo/Prawo porusza się między kolumnami (order)
      return {
        canMoveLeft: colIdx > 0,
        canMoveRight: colIdx < order.length - 1,
        canMoveUp: jobIdx > 0,
        canMoveDown: jobIdx < colJobs.length - 1
      };
    }
  };

  const findColumnForJob = (jobId: string): JobColumnId | null => {
    const job = jobs.find(j => j.id === jobId);
    return job ? (job.columnId || 'PREPARE') : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const jobId = (event.active.data?.current as any)?.jobId || event.active.id.toString().split('-')[0];
    setActiveId(jobId); setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    let overIdValue = event.over?.id as string || null;
    if (overIdValue && overIdValue.startsWith('card-')) {
      overIdValue = (event.over?.data?.current as any)?.jobId || overIdValue.replace('card-', '').split('-')[0];
    }
    setOverId(overIdValue);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null); setOverId(null);
    if (!over) return;
    const draggedId = (active.data?.current as any)?.jobId || active.id.toString().split('-')[0];
    let droppedOnId = over.id as string;
    if (droppedOnId.startsWith('card-')) {
      droppedOnId = (over.data?.current as any)?.jobId || droppedOnId.replace('card-', '').split('-')[0];
    }
    if (draggedId === droppedOnId) return;

    const sourceColumn = findColumnForJob(draggedId);
    if (!sourceColumn) return;
    const allColumnIds = ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'COMPLETED'];
    let targetColumn: JobColumnId;
    let insertBeforeJobId: string | null = null;
    if (allColumnIds.includes(droppedOnId)) targetColumn = droppedOnId as JobColumnId;
    else {
      const overJobColumn = findColumnForJob(droppedOnId);
      if (!overJobColumn) return;
      targetColumn = overJobColumn;
      insertBeforeJobId = droppedOnId;
    }

    if (sourceColumn === targetColumn) {
      const sourceJobs = jobs.filter(j => (j.columnId || 'PREPARE') === sourceColumn).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const jobIds = sourceJobs.map(j => j.id);
      const currentIndex = jobIds.indexOf(draggedId);
      jobIds.splice(currentIndex, 1);
      let insertIndex = insertBeforeJobId ? jobIds.indexOf(insertBeforeJobId) : jobIds.length;
      jobIds.splice(insertIndex, 0, draggedId);
      const orderMap = new Map(); jobIds.forEach((id, idx) => orderMap.set(id, (idx + 1) * 10));
      setJobs(prev => prev.map(job => orderMap.has(job.id) ? { ...job, sortOrder: orderMap.get(job.id)! } : job));
      await jobsService.reorderJobs(targetColumn, jobIds);
    } else {
      const targetJobs = jobs.filter(j => (j.columnId || 'PREPARE') === targetColumn && j.id !== draggedId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const targetIds = targetJobs.map(j => j.id);
      let insertIndex = insertBeforeJobId ? targetIds.indexOf(insertBeforeJobId) : targetIds.length;
      targetIds.splice(insertIndex, 0, draggedId);
      const orderMap = new Map(); targetIds.forEach((id, idx) => orderMap.set(id, (idx + 1) * 10));
      setJobs(prev => prev.map(job => job.id === draggedId ? { ...job, columnId: targetColumn, sortOrder: orderMap.get(job.id)! } : (orderMap.has(job.id) ? { ...job, sortOrder: orderMap.get(job.id)! } : job)));
      await jobsService.reorderJobs(targetColumn, targetIds);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesTab = activeTab === 'ACTIVE' ? job.status !== JobStatus.ARCHIVED : job.status === JobStatus.ARCHIVED;
    const matchesSearch = !searchQuery || [job.data.jobTitle, job.data.clientName, job.data.address, job.friendlyId].some(f => f?.toLowerCase().includes(searchQuery.toLowerCase()));
    let matchesArchiveFilters = true;
    if (activeTab === 'ARCHIVED') {
      if (archivePaymentFilter !== 'all') matchesArchiveFilters = matchesArchiveFilters && (job.paymentStatus === archivePaymentFilter);
      if (archiveReviewFilter !== 'all') {
        const reviewSent = !!job.reviewRequestSentAt;
        matchesArchiveFilters = matchesArchiveFilters && (archiveReviewFilter === 'sent' ? reviewSent : !reviewSent);
      }
    }
    return matchesTab && matchesSearch && matchesArchiveFilters;
  });

  const getJobsForColumn = (colId: JobColumnId) => {
    const filtered = filteredJobs.filter(j => (j.columnId || 'PREPARE') === colId);
    
    // Używamy sortOrder z bazy jeśli istnieje, w przeciwnym razie fallback na createdAt
    return filtered.sort((a, b) => {
      if (a.sortOrder !== null && a.sortOrder !== undefined && b.sortOrder !== null && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder;
      }
      if (a.sortOrder !== null && a.sortOrder !== undefined) return -1;
      if (b.sortOrder !== null && b.sortOrder !== undefined) return 1;
      
      // Fallback: starsze zlecenia na górze (created_at ASC)
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  };

  const jobMatchesPaymentFilter = (job: Job): boolean => {
    if (activeTab !== 'ACTIVE' || paymentFilter === 'ALL') return true;
    return (job.paymentStatus || PaymentStatus.NONE) === paymentFilter;
  };

  const isAdmin = role === UserRole.ADMIN;

  if (loading) return <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 rounded-full animate-spin border-orange-500 border-t-transparent" /></div>;

  return (
    <div className="animate-fade-in pb-20">
      <OmegaHeader 
        activeTab={activeTab} setActiveTab={setActiveTab} jobs={jobs} liveRefresh={liveRefresh} setLiveRefresh={setLiveRefresh}
        loadJobs={loadJobs} isAdmin={isAdmin} onCreateNew={() => setShowTypeModal(true)} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}
        archivePaymentFilter={archivePaymentFilter} setArchivePaymentFilter={setArchivePaymentFilter} archiveReviewFilter={archiveReviewFilter}
        setArchiveReviewFilter={setArchiveReviewFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={viewMode}
        setViewMode={setViewMode} handleBackup={() => {}} 
      />

      {activeTab === 'ARCHIVED' && (
        <OmegaArchive filteredJobs={filteredJobs} onSelectJob={onSelectJob} handleToggleReviewRequest={handleToggleReviewRequest}
          archivePaymentMenuOpen={archivePaymentMenuOpen} setArchivePaymentMenuOpen={setArchivePaymentMenuOpen}
          handlePaymentStatusChange={handlePaymentStatusChange} isAdmin={isAdmin} handleDelete={handleDelete}
        />
      )}

      {activeTab === 'ACTIVE' && (
        <>
          {viewMode === 'MIXED' && (
            <DndContext sensors={sensors} collisionDetection={cardFirstCollision} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
              <div className="space-y-6">
                <PrepareSection 
                  row={ROWS_CONFIG[0]} 
                  rowJobs={getJobsForColumn('PREPARE')} 
                  activeId={activeId} 
                  isAdmin={isAdmin} 
                  onSelectJob={onSelectJob} 
                  handleDelete={handleDelete} 
                  handleDuplicate={handleDuplicate} 
                  handleArchive={handleArchive} 
                  handlePaymentStatusChange={handlePaymentStatusChange} 
                  handleMoveToColumn={handleMoveToColumn} 
                  handleMoveLeft={handleMoveUp} 
                  handleMoveRight={handleMoveDown} 
                  handleJumpToStart={handleMoveLeft} 
                  handleJumpToEnd={handleMoveRight} 
                  getJobMoveLeftRightInfo={getJobMoveLeftRightInfo} 
                  jobMatchesPaymentFilter={jobMatchesPaymentFilter} 
                  handleContextMenu={handleContextMenu} 
                />
                <WeekColumnsSection showWeekend={showWeekend} setShowWeekend={setShowWeekend} ROWS_CONFIG={[...ROWS_CONFIG]} getJobsForColumn={getJobsForColumn} activeId={activeId} isAdmin={isAdmin} onSelectJob={onSelectJob} handleDelete={handleDelete} handleDuplicate={handleDuplicate} handleArchive={handleArchive} handleMoveUp={handleMoveUp} handleMoveDown={handleMoveDown} getJobMoveInfo={getJobMoveInfo} getJobMoveLeftRightInfo={getJobMoveLeftRightInfo} handleMoveLeft={handleMoveLeft} handleMoveRight={handleMoveRight} handleContextMenu={handleContextMenu} handlePaymentStatusChange={handlePaymentStatusChange} handleMoveToColumn={handleMoveToColumn} jobMatchesPaymentFilter={jobMatchesPaymentFilter} />
                <OmegaMap mapProvider={mapProvider} setMapProvider={setMapProvider} filteredJobs={filteredJobs} onSelectJob={onSelectJob} loadJobs={loadJobs} setJobs={setJobs} />
                <CompletedSection 
                  row={ROWS_CONFIG[8]} 
                  rowJobs={getJobsForColumn('COMPLETED')} 
                  activeId={activeId} 
                  isAdmin={isAdmin} 
                  onSelectJob={onSelectJob} 
                  handleDelete={handleDelete} 
                  handleDuplicate={(job) => handleDuplicate(job.id)} 
                  handlePaymentStatusChange={handlePaymentStatusChange} 
                  handleMoveToColumn={handleMoveToColumn} 
                  handleMoveLeft={handleMoveUp} 
                  handleMoveRight={handleMoveDown} 
                  handleMoveUp={handleMoveLeft} 
                  handleMoveDown={handleMoveRight} 
                  getJobMoveLeftRightInfo={getJobMoveLeftRightInfo} 
                  jobMatchesPaymentFilter={jobMatchesPaymentFilter} 
                  handleContextMenu={handleContextMenu} 
                />
              </div>
            </DndContext>
          )}

          {viewMode === 'BOARD' && (
            <BoardViewSection 
              sensors={sensors} 
              cardFirstCollision={cardFirstCollision} 
              handleDragStart={handleDragStart} 
              handleDragOver={handleDragOver} 
              handleDragEnd={handleDragEnd} 
              EXTENDED_ROWS_CONFIG={[...EXTENDED_ROWS_CONFIG]} 
              getJobsForColumn={getJobsForColumn} 
              activeId={activeId} 
              isAdmin={isAdmin} 
              onSelectJob={onSelectJob} 
              handleDelete={handleDelete} 
              handleDuplicate={handleDuplicate} 
              handleArchive={handleArchive} 
              handlePaymentStatusChange={handlePaymentStatusChange} 
              handleMoveToColumn={handleMoveToColumn} 
              handleMoveLeft={handleMoveUp} 
              handleMoveRight={handleMoveDown} 
              handleJumpToStart={handleMoveLeft} 
              handleJumpToEnd={handleMoveRight} 
              getJobMoveLeftRightInfo={getJobMoveLeftRightInfo} 
              jobMatchesPaymentFilter={jobMatchesPaymentFilter} 
              handleContextMenu={handleContextMenu} 
              jobs={jobs} 
            />
          )}

          {viewMode === 'KANBAN' && (
            <KanbanViewSection sensors={sensors} cardFirstCollision={cardFirstCollision} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragEnd={handleDragEnd} ROWS_CONFIG={[...ROWS_CONFIG]} getJobsForColumn={getJobsForColumn} activeId={activeId} isAdmin={isAdmin} onSelectJob={onSelectJob} handleDelete={handleDelete} handleDuplicate={handleDuplicate} handleArchive={handleArchive} handleMoveUp={handleMoveUp} handleMoveDown={handleMoveDown} getJobMoveInfo={getJobMoveInfo} getJobMoveLeftRightInfo={getJobMoveLeftRightInfo} handleMoveLeft={handleMoveLeft} handleMoveRight={handleMoveRight} handleContextMenu={handleContextMenu} handlePaymentStatusChange={handlePaymentStatusChange} handleMoveToColumn={handleMoveToColumn} jobMatchesPaymentFilter={jobMatchesPaymentFilter} jobs={jobs} />
          )}

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
        </>
      )}

      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 text-center"><h2 className="text-2xl font-bold">Wybierz typ zlecenia</h2><p className="text-slate-300 mt-1">Jak chcesz dodać nowe zlecenie?</p></div>
            <div className="p-6 space-y-4">
              <button onClick={() => { setShowTypeModal(false); if (onCreateNewSimple) onCreateNewSimple(); }} className="w-full p-5 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group text-left"><div className="flex items-center gap-4"><span className="text-4xl">📋</span><div><h3 className="text-xl font-bold text-green-700">Proste zlecenie</h3><p className="text-slate-600 text-sm mt-1">Ręczne wypełnianie pól</p></div></div></button>
              <button onClick={() => { setShowTypeModal(false); onCreateNew(); }} className="w-full p-5 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"><div className="flex items-center gap-4"><span className="text-4xl">🤖</span><div><h3 className="text-xl font-bold text-blue-700">Zlecenie AI</h3><p className="text-slate-600 text-sm mt-1">Gemini wypełni dane automatycznie</p></div></div></button>
            </div>
            <div className="px-6 pb-6"><button onClick={() => setShowTypeModal(false)} className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium">Anuluj</button></div>
          </div>
        </div>
      )}

      {contextMenu && (
        <JobContextMenu job={contextMenu.job} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onPaymentStatusChange={handlePaymentStatusChange} onMoveToColumn={handleMoveToColumn} onArchive={handleArchive} onDelete={handleDelete} isAdmin={isAdmin} />
      )}
    </div>
  );
};

export default DashboardOmega;
