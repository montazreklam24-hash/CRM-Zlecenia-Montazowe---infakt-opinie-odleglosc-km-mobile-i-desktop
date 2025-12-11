import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Job, JobColumnId, JobStatus, UserRole, PaymentStatus } from './types';
import { jobsService } from './services/apiService';
import MobileDashboard from './components/mobile/MobileDashboard';
import MobileJobDetail from './components/mobile/MobileJobDetail';
import { Loader2 } from 'lucide-react';

// Lazy load map component (uses Leaflet which is heavy)
const MobileMapView = lazy(() => import('./components/mobile/MobileMapView'));

type MobileView = 'DASHBOARD' | 'JOB_DETAIL' | 'MAP';

interface MobileAppProps {
  onCreateNew: () => void;
  onCreateNewSimple: () => void;
  role: UserRole;
}

const MobileApp: React.FC<MobileAppProps> = ({ onCreateNew, onCreateNewSimple, role }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<MobileView>('DASHBOARD');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const isAdmin = role === UserRole.ADMIN;

  // Load jobs
  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobsService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Navigation
  const handleOpenJob = (job: Job) => {
    setSelectedJob(job);
    setView('JOB_DETAIL');
  };

  const handleBack = () => {
    setView('DASHBOARD');
    setSelectedJob(null);
  };

  const handleOpenMap = () => {
    setView('MAP');
  };

  // Job Actions
  const handleMoveUp = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId && j.status !== JobStatus.ARCHIVED)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex <= 0) return; // Already at top
    
    // Swap with the job above
    const jobAbove = columnJobs[currentIndex - 1];
    const currentOrder = job.order || currentIndex;
    const aboveOrder = jobAbove.order || (currentIndex - 1);
    
    // Update orders
    setJobs(prev => prev.map(j => {
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
  }, [jobs, loadJobs]);

  const handleMoveDown = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const columnId = job.columnId || 'PREPARE';
    const columnJobs = jobs
      .filter(j => (j.columnId || 'PREPARE') === columnId && j.status !== JobStatus.ARCHIVED)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const currentIndex = columnJobs.findIndex(j => j.id === jobId);
    if (currentIndex < 0 || currentIndex >= columnJobs.length - 1) return; // Already at bottom
    
    // Swap with the job below
    const jobBelow = columnJobs[currentIndex + 1];
    const currentOrder = job.order || currentIndex;
    const belowOrder = jobBelow.order || (currentIndex + 1);
    
    // Update orders
    setJobs(prev => prev.map(j => {
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
  }, [jobs, loadJobs]);

  const handleMoveToColumn = useCallback(async (jobId: string, targetColumnId: JobColumnId) => {
    const newOrder = jobs.filter(j => (j.columnId || 'PREPARE') === targetColumnId).length;
    
    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, columnId: targetColumnId, order: newOrder } : j
    ));
    
    try {
      await jobsService.updateJobPosition(jobId, targetColumnId, newOrder);
    } catch (err) {
      loadJobs();
    }
  }, [jobs, loadJobs]);

  const handleDelete = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    if (!window.confirm('Usunąć zlecenie?')) return;
    
    const jobType = job.type === 'simple' ? 'simple' : 'ai';
    
    try {
      await jobsService.deleteJob(jobId, jobType);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJob?.id === jobId) handleBack();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }, [jobs, selectedJob]);

  const handleDuplicate = useCallback(async (jobId: string) => {
    if (!window.confirm('Duplikować?')) return;
    try {
      await jobsService.duplicateJob(jobId);
      loadJobs();
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  }, [loadJobs]);

  const handleArchive = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    if (!window.confirm('Archiwizować?')) return;
    
    const jobType = job.type === 'simple' ? 'simple' : 'ai';
    const now = Date.now();
    
    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, status: JobStatus.ARCHIVED, completedAt: now, columnId: 'ARCHIVE' as JobColumnId } : j
    ));
    
    try {
      await jobsService.updateJob(jobId, {
        status: JobStatus.ARCHIVED,
        completedAt: now,
        columnId: 'ARCHIVE' as JobColumnId
      }, jobType);
      if (selectedJob?.id === jobId) handleBack();
    } catch (err) {
      loadJobs();
    }
  }, [jobs, selectedJob, loadJobs]);

  const handleSaveJob = useCallback(async (jobId: string, updates: Partial<Job>) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const jobType = job.type === 'simple' ? 'simple' : 'ai';
    
    try {
      await jobsService.updateJob(jobId, updates, jobType);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, ...updates });
      }
    } catch (err) {
      console.error('Failed to save:', err);
      throw err;
    }
  }, [jobs, selectedJob]);

  const handlePaymentStatusChange = useCallback(async (jobId: string, status: PaymentStatus) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    const jobType = job.type === 'simple' ? 'simple' : 'ai';
    
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, paymentStatus: status } : j));
    
    try {
      await jobsService.updateJob(jobId, { paymentStatus: status }, jobType);
    } catch (err) {
      console.error('Failed to update payment status:', err);
      loadJobs(); // Rollback on error
    }
  }, [jobs, loadJobs]);

  // Loading state
  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-orange-500 rounded-xl">
            <span className="text-xl font-black text-white">M24</span>
          </div>
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-slate-400 text-sm">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // Check for demo mode via URL param
  const urlParams = new URLSearchParams(window.location.search);
  const showDemo = urlParams.get('demo') === '1';

  return (
    <div className="mobile-app h-screen overflow-hidden">
      {view === 'DASHBOARD' && (
        <MobileDashboard
          jobs={jobs}
          onCreateNew={onCreateNew}
          onOpenJob={handleOpenJob}
          onOpenMap={handleOpenMap}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onMoveToColumn={handleMoveToColumn}
          onPaymentStatusChange={handlePaymentStatusChange}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          isAdmin={isAdmin}
          showDemo={showDemo}
        />
      )}

      {view === 'JOB_DETAIL' && selectedJob && (
        <MobileJobDetail
          job={selectedJob}
          onBack={handleBack}
          onSave={handleSaveJob}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          isAdmin={isAdmin}
        />
      )}

      {view === 'MAP' && (
        <Suspense fallback={
          <div className="h-screen bg-slate-900 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        }>
          <MobileMapView
            jobs={jobs}
            onBack={handleBack}
            onOpenJob={handleOpenJob}
          />
        </Suspense>
      )}
    </div>
  );
};

export default MobileApp;