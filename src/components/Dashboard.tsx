import React, { useEffect, useState, useRef } from 'react';
import { Job, JobStatus, UserRole, JobColumnId, PaymentStatus } from '../types';
import { jobsService } from '../services/apiService';
import { 
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import JobContextMenu from './JobContextMenu';

// Refactored components and utils
import { 
  ROWS_CONFIG, 
} from './Dashboard/DashboardConstants';
import { 
  cardFirstCollision, 
} from './Dashboard/DroppableContainers';
import { DashboardHeader } from './Dashboard/DashboardHeader';
import { DashboardMixedView } from './Dashboard/DashboardMixedView';
import { DashboardBoardView } from './Dashboard/DashboardBoardView';
import { DashboardKanbanView } from './Dashboard/DashboardKanbanView';
import { DashboardArchive } from './Dashboard/DashboardArchive';
import { JobTypeModal } from './Dashboard/JobTypeModal';

interface DashboardProps {
  role: UserRole;
  onSelectJob: (job: Job, fromArchive?: boolean) => void;
  onCreateNew: () => void;
  onCreateNewSimple?: () => void;
  initialTab?: 'ACTIVE' | 'ARCHIVED';
  refreshTrigger?: number; // Trigger do odświeżania listy zleceń
}

const Dashboard: React.FC<DashboardProps> = ({ role, onSelectJob, onCreateNew, onCreateNewSimple, initialTab, refreshTrigger }) => {
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

  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode);
  }, [viewMode]);
  
  useEffect(() => {
    localStorage.setItem('dashboard_active_tab', activeTab);
  }, [activeTab]);
  
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  const [mapProvider, setMapProvider] = useState<'GOOGLE' | 'OSM'>(() => {
    return (localStorage.getItem('dashboard_map_provider') as 'GOOGLE' | 'OSM') || 'OSM';
  });
  
  useEffect(() => {
    localStorage.setItem('dashboard_map_provider', mapProvider);
  }, [mapProvider]);

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

  // Auto-Heal geolokalizacji
  useEffect(() => {
    if (healingDoneRef.current) return;
    
    const healJobs = async () => {
      healingDoneRef.current = true;
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
            await jobsService.updateJob(job.id, {
              data: {
                ...job.data,
                address: bestMatch.formattedAddress,
                coordinates: bestMatch.coordinates
              }
            });
            fixedCount++;
          }
        } catch (e) {
          console.error(`❌ Auto-Heal błąd dla ${job.friendlyId}:`, e);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      if (fixedCount > 0) {
        loadJobs(true);
      }
    };

    if (!loading && jobs.length > 0) {
      const timer = setTimeout(healJobs, 3000);
      return () => clearTimeout(timer);
    }
  }, [loading, jobs.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadJobs();
    }
  }, [refreshTrigger]);

  const broadcastChange = () => {
    localStorage.setItem('crm_last_change', Date.now().toString());
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crm_last_change' && e.newValue) {
        loadJobs(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!liveRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadJobs(true);
      }
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === id);
    const jobName = job?.data.jobTitle || job?.friendlyId || 'to zlecenie';
    if (window.confirm(`🗑️ Czy na pewno chcesz USUNĄĆ zlecenie?\n\n"${jobName}"\n\nTej operacji nie można cofnąć!`)) {
      const previousJobs = [...jobs];
      setJobs(prevJobs => prevJobs.filter(j => j.id !== id));
      try {
        await jobsService.deleteJob(id);
        broadcastChange();
      } catch (err) {
        console.error('❌ Błąd usuwania zlecenia:', err);
        setJobs(previousJobs);
        alert('Nie udało się usunąć zlecenia.');
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
      } catch (err) {
        console.error('❌ Błąd archiwizacji:', err);
        alert('Nie udało się zarchiwizować zlecenia.');
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, job: Job) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, job });
  };

  const handleToggleReviewRequest = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const currentlySent = !!job.reviewRequestSentAt;
    const newStatus = currentlySent ? undefined : Date.now();
    try {
      await jobsService.updateJob(jobId, { reviewRequestSentAt: newStatus });
      loadJobs();
    } catch (err) {
      console.error('Błąd zmiany statusu opinii:', err);
    }
  };

  const handleMoveUp = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => (a.order ?? a.columnOrder ?? 0) - (b.order ?? b.columnOrder ?? 0));
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex <= 0) return;
    const jobAbove = columnJobs[currentIndex - 1];
    const currentOrder = job.order || currentIndex;
    const aboveOrder = jobAbove.order || (currentIndex - 1);
    setJobs(prevJobs => prevJobs.map(j => {
      if (j.id === jobId) return { ...j, order: aboveOrder };
      if (j.id === jobAbove.id) return { ...j, order: currentOrder };
      return j;
    }));
    try {
      await jobsService.updateJobColumn(jobId, columnId, aboveOrder);
      await jobsService.updateJobColumn(jobAbove.id, columnId, currentOrder);
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
      .sort((a, b) => (a.order ?? a.columnOrder ?? 0) - (b.order ?? b.columnOrder ?? 0));
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex >= columnJobs.length - 1) return;
    const jobBelow = columnJobs[currentIndex + 1];
    const currentOrder = job.order || currentIndex;
    const belowOrder = jobBelow.order || (currentIndex + 1);
    setJobs(prevJobs => prevJobs.map(j => {
      if (j.id === jobId) return { ...j, order: belowOrder };
      if (j.id === jobBelow.id) return { ...j, order: currentOrder };
      return j;
    }));
    try {
      await jobsService.updateJobColumn(jobId, columnId, belowOrder);
      await jobsService.updateJobColumn(jobBelow.id, columnId, currentOrder);
    } catch (err) {
      loadJobs();
    }
  };

  const getJobMoveInfo = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { canMoveUp: false, canMoveDown: false };
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId)
      .sort((a, b) => (a.order ?? a.columnOrder ?? 0) - (b.order ?? b.columnOrder ?? 0));
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    return { canMoveUp: currentIndex > 0, canMoveDown: currentIndex < columnJobs.length - 1 };
  };

  const getColumnOrder = () => {
    const base = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    if (showWeekend) base.push('SAT', 'SUN');
    base.push('COMPLETED');
    return base as JobColumnId[];
  };
  
  const getJobMoveLeftRightInfo = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { canMoveLeft: false, canMoveRight: false };
    const columnId = job.columnId || 'PREPARE';
    if (columnId === 'PREPARE') {
        const colJobs = getPrepareJobsSorted();
        const index = colJobs.findIndex(j => j.id === jobId);
        if (index === -1) return { canMoveLeft: false, canMoveRight: false };
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
    return { canMoveLeft: currentIndex > 0, canMoveRight: currentIndex < order.length - 1 };
  };

  const getPrepareJobsSorted = () => {
    return jobs
      .filter(j => (j.columnId || 'PREPARE') === 'PREPARE')
      .map((job, idx) => ({ ...job, normalizedOrder: job.sortOrder ?? job.order ?? job.columnOrder ?? idx }))
      .sort((a, b) => {
        if (a.sortOrder !== null && a.sortOrder !== undefined && b.sortOrder !== null && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        if (a.normalizedOrder === b.normalizedOrder) {
          return jobs.findIndex(j => j.id === a.id) - jobs.findIndex(j => j.id === b.id);
        }
        return a.normalizedOrder - b.normalizedOrder;
      });
  };

  const handleJumpToStart = async (jobId: string) => {
    const sortedJobs = getPrepareJobsSorted();
    const index = sortedJobs.findIndex(j => j.id === jobId);
    if (index <= 0) return;
    const jobsToUpdate = sortedJobs.slice(0, index).map((j, idx) => ({ id: j.id, newOrder: idx + 1 }));
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) return { ...j, order: 0, columnOrder: 0 };
      const update = jobsToUpdate.find(u => u.id === j.id);
      if (update) return { ...j, order: update.newOrder, columnOrder: update.newOrder };
      return j;
    }));
    try {
      await jobsService.updateJob(jobId, { sortOrder: 0 });
      await Promise.all(jobsToUpdate.map(u => jobsService.updateJob(u.id, { sortOrder: u.newOrder * 10 })));
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleJumpToEnd = async (jobId: string) => {
    const sortedJobs = getPrepareJobsSorted();
    const index = sortedJobs.findIndex(j => j.id === jobId);
    if (index === -1 || index === sortedJobs.length - 1) return;
    const maxOrder = Math.max(...sortedJobs.map(j => j.normalizedOrder), -1);
    const newOrder = maxOrder + 1;
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, order: newOrder, columnOrder: newOrder } : j));
    try {
      await jobsService.updateJob(jobId, { sortOrder: newOrder * 10 });
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const moveJobInPrepareList = async (jobId: string, direction: -1 | 1) => {
    const sortedJobs = getPrepareJobsSorted();
    const currentIndex = sortedJobs.findIndex(j => j.id === jobId);
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= sortedJobs.length) return;
    const newOrderIds = sortedJobs.map(j => j.id);
    const [movedId] = newOrderIds.splice(currentIndex, 1);
    newOrderIds.splice(newIndex, 0, movedId);
    setJobs(prevJobs => {
        const indexMap = new Map<string, number>();
        newOrderIds.forEach((id, idx) => indexMap.set(id, idx));
        return prevJobs.map(job => {
            if ((job.columnId || 'PREPARE') === 'PREPARE' && indexMap.has(job.id)) {
                const newIdx = indexMap.get(job.id)!;
                const ord = (newIdx + 1) * 10;
                return { ...job, sortOrder: ord, order: ord, columnOrder: ord, normalizedOrder: ord };
            }
            return job;
        });
    });
    try {
        await jobsService.reorderJobs('PREPARE', newOrderIds);
        broadcastChange();
    } catch (err) {
        loadJobs();
    }
  };

  const handleMoveLeft = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const columnId = job.columnId || 'PREPARE';
    if (columnId === 'PREPARE') {
      await moveJobInPrepareList(jobId, -1);
      return;
    }
    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    if (currentIndex <= 0) return;
    const newColumnId = order[currentIndex - 1];
    setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? { ...j, columnId: newColumnId } : j));
    try {
      await jobsService.updateJobColumn(jobId, newColumnId, undefined);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handleMoveRight = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const columnId = job.columnId || 'PREPARE';
    if (columnId === 'PREPARE') {
      await moveJobInPrepareList(jobId, 1);
      return;
    }
    const order = getColumnOrder();
    const currentIndex = order.indexOf(columnId);
    if (currentIndex >= order.length - 1 || currentIndex === -1) return;
    const newColumnId = order[currentIndex + 1];
    setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? { ...j, columnId: newColumnId } : j));
    try {
      await jobsService.updateJobColumn(jobId, newColumnId, undefined);
      broadcastChange();
    } catch (err) {
      loadJobs();
    }
  };

  const handlePaymentStatusChange = async (jobId: string, newStatus: PaymentStatus) => {
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
    if (!job) return;
    const sourceColumnId = job.columnId || 'PREPARE';
    if (sourceColumnId === targetColumnId) return;
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

  const findColumnForJob = (jobId: string): JobColumnId | null => {
    const job = jobs.find(j => j.id === jobId);
    return job ? (job.columnId || 'PREPARE') : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const jobId = (event.active.data?.current as any)?.jobId || event.active.id.toString().split('-')[0];
    setActiveId(jobId);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    let overIdValue = event.over?.id as string || null;
    if (!overIdValue) {
      setOverId(null);
      return;
    }

    const overData = event.over?.data?.current as any;
    if (overData?.jobId) {
      overIdValue = overData.jobId;
    } else if (overIdValue.startsWith('card-')) {
      overIdValue = overIdValue.replace('card-', '').split('-')[0];
    } else if (overIdValue.includes('-')) {
      overIdValue = overIdValue.split('-')[0];
    }
    
    setOverId(overIdValue);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over) return;

    // Pobierz czyste ID zlecenia (bez timestampu lub prefiksu)
    const draggedId = (active.data?.current as any)?.jobId || active.id.toString().split('-')[0];
    let droppedOnId = over.id as string;
    
    // Obsługa różnych formatów ID (card-ID, ID-timestamp, lub samo ID)
    const overData = over.data?.current as any;
    if (overData?.jobId) {
      droppedOnId = overData.jobId;
    } else if (droppedOnId.startsWith('card-')) {
      droppedOnId = droppedOnId.replace('card-', '').split('-')[0];
    } else if (droppedOnId.includes('-')) {
      droppedOnId = droppedOnId.split('-')[0];
    }

    if (draggedId === droppedOnId) return;

    const allColumnIds = ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'COMPLETED'];
    const sourceColumn = findColumnForJob(draggedId);
    if (!sourceColumn) return;

    let targetColumn: JobColumnId;
    let insertBeforeJobId: string | null = null;

    if (allColumnIds.includes(droppedOnId)) {
      targetColumn = droppedOnId as JobColumnId;
    } else {
      const overJobColumn = findColumnForJob(droppedOnId);
      if (!overJobColumn) return;
      targetColumn = overJobColumn;
      insertBeforeJobId = droppedOnId;
    }

    if (sourceColumn === targetColumn) {
      const sourceJobs = getJobsForColumn(sourceColumn);
      const jobIds = sourceJobs.map(j => j.id);
      const oldIndex = jobIds.indexOf(draggedId);
      if (oldIndex === -1) return;

      let newIndex = oldIndex;
      if (insertBeforeJobId) {
        newIndex = jobIds.indexOf(insertBeforeJobId);
        if (newIndex === -1) newIndex = oldIndex;
      } else {
        // Jeśli nie upuszczono na konkretną kartę (insertBeforeJobId jest null),
        // ale jesteśmy w tej samej kolumnie, to nie zmieniajmy pozycji.
        // Zapobiega to "uciekaniu na koniec" przy upuszczeniu między kafelkami.
        return;
      }

      if (oldIndex === newIndex) return;

      const newOrder = arrayMove(jobIds, oldIndex, newIndex);

      const orderMap = new Map<string, number>();
      newOrder.forEach((id, idx) => orderMap.set(id, (idx + 1) * 10));

      setJobs(prev => prev.map(job => 
        orderMap.has(job.id) ? { ...job, sortOrder: orderMap.get(job.id)! } : job
      ));

      await jobsService.reorderJobs(targetColumn, newOrder);
      broadcastChange();
    } else {
      // Pobierz zlecenia już będące w kolumnie docelowej (bez tego przeciąganego)
      const targetJobs = jobs.filter(j => (j.columnId || 'PREPARE') === targetColumn && j.id !== draggedId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt || 0) - (b.createdAt || 0));
      
      const targetIds = targetJobs.map(j => j.id);
      
      let insertIndex = targetIds.length;
      if (insertBeforeJobId) {
        insertIndex = targetIds.indexOf(insertBeforeJobId);
        if (insertIndex === -1) insertIndex = targetIds.length;
      }
      
      targetIds.splice(insertIndex, 0, draggedId);

      const orderMap = new Map<string, number>();
      targetIds.forEach((id, idx) => orderMap.set(id, (idx + 1) * 10));

      setJobs(prev => prev.map(job => {
        if (job.id === draggedId) return { ...job, columnId: targetColumn, sortOrder: orderMap.get(job.id)! };
        if (orderMap.has(job.id)) return { ...job, sortOrder: orderMap.get(job.id)! };
        return job;
      }));

      await jobsService.reorderJobs(targetColumn, targetIds);
      broadcastChange();
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesTab = activeTab === 'ACTIVE' ? job.status !== JobStatus.ARCHIVED : job.status === JobStatus.ARCHIVED;
    const matchesSearch = !searchQuery || 
      job.data.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.data.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.data.address?.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesArchiveFilters = true;
    if (activeTab === 'ARCHIVED') {
      if (archivePaymentFilter !== 'all') matchesArchiveFilters = matchesArchiveFilters && (job.paymentStatus || PaymentStatus.NONE) === archivePaymentFilter;
      if (archiveReviewFilter !== 'all') {
        const reviewSent = !!job.reviewRequestSentAt;
        if (archiveReviewFilter === 'sent') matchesArchiveFilters = matchesArchiveFilters && reviewSent;
        else if (archiveReviewFilter === 'not_sent') matchesArchiveFilters = matchesArchiveFilters && !reviewSent;
      }
    }
    return matchesTab && matchesSearch && matchesArchiveFilters;
  });

  const getJobsForColumn = (colId: JobColumnId) => {
    return filteredJobs.filter(j => (j.columnId || 'PREPARE') === colId)
      .map((job, idx) => ({ ...job, normalizedOrder: job.sortOrder ?? job.order ?? job.columnOrder ?? idx }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt || 0) - (b.createdAt || 0));
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
      <DashboardHeader 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeJobsCount={jobs.filter(j => j.status !== JobStatus.ARCHIVED).length}
        liveRefresh={liveRefresh}
        setLiveRefresh={setLiveRefresh}
        loadJobs={loadJobs}
        isAdmin={isAdmin}
        onCreateNew={() => setShowTypeModal(true)}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        archivePaymentFilter={archivePaymentFilter}
        setArchivePaymentFilter={setArchivePaymentFilter}
        archiveReviewFilter={archiveReviewFilter}
        setArchiveReviewFilter={setArchiveReviewFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        handleBackup={handleBackup}
      />

      {activeTab === 'ACTIVE' ? (
        <>
          {viewMode === 'MIXED' && (
            <DashboardMixedView 
              sensors={sensors}
              collisionDetection={cardFirstCollision}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDragEnd={handleDragEnd}
              getJobsForColumn={getJobsForColumn}
              activeId={activeId}
              isAdmin={isAdmin}
              onSelectJob={onSelectJob}
              handleDelete={handleDelete}
              handleDuplicate={handleDuplicate}
              handleArchive={handleArchive}
              handlePaymentStatusChange={handlePaymentStatusChange}
              handleMoveToColumn={handleMoveToColumn}
              handleMoveLeft={handleMoveLeft}
              handleMoveRight={handleMoveRight}
              handleJumpToStart={handleJumpToStart}
              handleJumpToEnd={handleJumpToEnd}
              handleMoveUp={handleMoveUp}
              handleMoveDown={handleMoveDown}
              getJobMoveInfo={getJobMoveInfo}
              getJobMoveLeftRightInfo={getJobMoveLeftRightInfo}
              handleContextMenu={handleContextMenu}
              showWeekend={showWeekend}
              setShowWeekend={setShowWeekend}
              mapProvider={mapProvider}
              setMapProvider={setMapProvider}
              filteredJobs={filteredJobs}
              loadJobs={loadJobs}
              setJobs={setJobs}
              jobs={jobs}
            />
          )}
          {viewMode === 'BOARD' && (
            <DashboardBoardView 
              sensors={sensors}
              collisionDetection={cardFirstCollision}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDragEnd={handleDragEnd}
              getJobsForColumn={getJobsForColumn}
              activeId={activeId}
              isAdmin={isAdmin}
              onSelectJob={onSelectJob}
              handleDelete={handleDelete}
              handleDuplicate={handleDuplicate}
              handleArchive={handleArchive}
              handlePaymentStatusChange={handlePaymentStatusChange}
              handleMoveToColumn={handleMoveToColumn}
              handleMoveLeft={handleMoveLeft}
              handleMoveRight={handleMoveRight}
              handleJumpToStart={handleJumpToStart}
              handleJumpToEnd={handleJumpToEnd}
              getJobMoveLeftRightInfo={getJobMoveLeftRightInfo}
              handleContextMenu={handleContextMenu}
              mapProvider={mapProvider}
              setMapProvider={setMapProvider}
              filteredJobs={filteredJobs}
              loadJobs={loadJobs}
              setJobs={setJobs}
              jobs={jobs}
            />
          )}
          {viewMode === 'KANBAN' && (
            <DashboardKanbanView 
              sensors={sensors}
              collisionDetection={cardFirstCollision}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDragEnd={handleDragEnd}
              getJobsForColumn={getJobsForColumn}
              activeId={activeId}
              isAdmin={isAdmin}
              onSelectJob={onSelectJob}
              handleDelete={handleDelete}
              handleDuplicate={handleDuplicate}
              handleArchive={handleArchive}
              handlePaymentStatusChange={handlePaymentStatusChange}
              handleMoveToColumn={handleMoveToColumn}
              handleMoveLeft={handleMoveLeft}
              handleMoveRight={handleMoveRight}
              handleMoveUp={handleMoveUp}
              handleMoveDown={handleMoveDown}
              getJobMoveInfo={getJobMoveInfo}
              getJobMoveLeftRightInfo={getJobMoveLeftRightInfo}
              handleContextMenu={handleContextMenu}
              mapProvider={mapProvider}
              setMapProvider={setMapProvider}
              filteredJobs={filteredJobs}
              loadJobs={loadJobs}
              setJobs={setJobs}
              jobs={jobs}
            />
          )}
        </>
      ) : (
        <DashboardArchive 
          jobs={filteredJobs}
          onSelectJob={onSelectJob}
          handleToggleReviewRequest={handleToggleReviewRequest}
          handlePaymentStatusChange={handlePaymentStatusChange}
          handleDelete={handleDelete}
          isAdmin={isAdmin}
          archivePaymentMenuOpen={archivePaymentMenuOpen}
          setArchivePaymentMenuOpen={setArchivePaymentMenuOpen}
        />
      )}

      {showTypeModal && (
        <JobTypeModal 
          onClose={() => setShowTypeModal(false)}
          onCreateNewSimple={onCreateNewSimple || (() => {})}
          onCreateNewAI={onCreateNew}
        />
      )}

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
              const previousJobs = [...jobs];
              setJobs(prevJobs => prevJobs.filter(j => j.id !== id));
              setContextMenu(null);
              try {
                await jobsService.deleteJob(id);
                broadcastChange();
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
