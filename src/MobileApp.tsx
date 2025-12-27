import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Job, JobColumnId, JobStatus, UserRole, PaymentStatus } from './types';
import { jobsService } from './services/apiService';
import MobileDashboard from './components/mobile/MobileDashboard';
import MobileJobDetail from './components/mobile/MobileJobDetail';
import { Loader2 } from 'lucide-react';

// Lazy load map component (uses Leaflet which is heavy)
const MobileMapView = lazy(() => import('./components/mobile/MobileMapView'));
const MobileGoogleMapView = lazy(() => import('./components/mobile/MobileGoogleMapView'));

type MobileView = 'DASHBOARD' | 'JOB_DETAIL' | 'MAP';

interface MobileAppProps {
  onCreateNew: () => void;
  onCreateNewSimple: () => void;
  role: UserRole;
  refreshTrigger?: number; // Trigger do odświeżania listy zleceń
}

const MobileApp: React.FC<MobileAppProps> = ({ onCreateNew, onCreateNewSimple, role, refreshTrigger }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<MobileView>('DASHBOARD');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [mapProvider, setMapProvider] = useState<'GOOGLE' | 'OSM'>('OSM');

  const isAdmin = role === UserRole.ADMIN;

  // Load jobs
  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobsService.getJobs();
      
      // DEBUG: Loguj ile zleceń otrzymaliśmy i jakie typy
      console.log('📱 MobileApp loadJobs:', {
        total: data.length,
        ai: data.filter(j => j.type === 'ai').length,
        simple: data.filter(j => j.type === 'simple').length,
        jobs: data.map(j => ({ id: j.id, type: j.type, title: j.data.jobTitle?.substring(0, 30) }))
      });
      
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

  // Odśwież listę zleceń gdy refreshTrigger się zmienia
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadJobs();
      setView('DASHBOARD');
      setSelectedJob(null);
    }
  }, [refreshTrigger, loadJobs]);

  // Navigation with History API support
  const handleOpenJob = (job: Job) => {
    setSelectedJob(job);
    setView('JOB_DETAIL');
    // Add entry to history stack
    window.history.pushState({ view: 'JOB_DETAIL', jobId: job.id }, '');
  };

  const handleOpenMap = (provider: 'GOOGLE' | 'OSM' = 'OSM') => {
    setMapProvider(provider);
    setView('MAP');
    window.history.pushState({ view: 'MAP' }, '');
  };

  const handleBack = () => {
    // If we have history state, go back
    if (window.history.state) {
      window.history.back();
    } else {
      // Fallback if accessed directly (though unlikely in this SPA flow)
      setView('DASHBOARD');
      setSelectedJob(null);
    }
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.view === 'JOB_DETAIL') {
        // If navigating forward to job detail (rare but possible)
        // We need to find the job from state if possible, or just stay
        setView('JOB_DETAIL');
      } else if (event.state?.view === 'MAP') {
        setView('MAP');
      } else {
        // Back to root/dashboard
        setView('DASHBOARD');
        setSelectedJob(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Job Actions - PRZEPISANE OD NOWA z poprawną logiką
  const handleMoveUp = useCallback(async (jobId: string) => {
    // Użyj funkcjonalnej aktualizacji stanu żeby mieć najnowsze dane
    let newOrderForCurrent: number | undefined;
    let newOrderForAbove: number | undefined;
    let jobAboveId: string | undefined;
    let columnId: JobColumnId | undefined;
    
    // Najpierw oblicz nowe wartości order
    setJobs(prevJobs => {
      const job = prevJobs.find(j => j.id === jobId);
      if (!job) return prevJobs;
      
      columnId = job.columnId || 'PREPARE';
      const columnJobs = prevJobs
        .filter(j => (j.columnId || 'PREPARE') === columnId && j.status !== JobStatus.ARCHIVED)
        .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
      
      const currentIndex = columnJobs.findIndex(j => j.id === jobId);
      if (currentIndex <= 0) return prevJobs; // Already at top
      
      // Swap with the job above
      const jobAbove = columnJobs[currentIndex - 1];
      jobAboveId = jobAbove.id;
      const currentOrder = job.order ?? currentIndex;
      const aboveOrder = jobAbove.order ?? (currentIndex - 1);
      
      newOrderForCurrent = aboveOrder;
      newOrderForAbove = currentOrder;
      
      // Zwróć zaktualizowany stan
      return prevJobs.map(j => {
        if (j.id === jobId) return { ...j, order: aboveOrder };
        if (j.id === jobAbove.id) return { ...j, order: currentOrder };
        return j;
      });
    });
    
    // Zapisz do backendu (tylko jeśli były zmiany)
    if (newOrderForCurrent !== undefined && newOrderForAbove !== undefined && jobAboveId && columnId) {
      try {
        await Promise.all([
          jobsService.updateJobColumn(jobId, columnId, newOrderForCurrent),
          jobsService.updateJobColumn(jobAboveId, columnId, newOrderForAbove)
        ]);
      } catch (err) {
        console.error('Failed to save order:', err);
        loadJobs(); // Reload on error
      }
    }
  }, [loadJobs]);

  const handleMoveDown = useCallback(async (jobId: string) => {
    // Użyj funkcjonalnej aktualizacji stanu żeby mieć najnowsze dane
    let newOrderForCurrent: number | undefined;
    let newOrderForBelow: number | undefined;
    let jobBelowId: string | undefined;
    let columnId: JobColumnId | undefined;
    
    // Najpierw oblicz nowe wartości order
    setJobs(prevJobs => {
      const job = prevJobs.find(j => j.id === jobId);
      if (!job) return prevJobs;
      
      columnId = job.columnId || 'PREPARE';
      const columnJobs = prevJobs
        .filter(j => (j.columnId || 'PREPARE') === columnId && j.status !== JobStatus.ARCHIVED)
        .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
      
      const currentIndex = columnJobs.findIndex(j => j.id === jobId);
      if (currentIndex < 0 || currentIndex >= columnJobs.length - 1) return prevJobs; // Already at bottom
      
      // Swap with the job below
      const jobBelow = columnJobs[currentIndex + 1];
      jobBelowId = jobBelow.id;
      const currentOrder = job.order ?? currentIndex;
      const belowOrder = jobBelow.order ?? (currentIndex + 1);
      
      newOrderForCurrent = belowOrder;
      newOrderForBelow = currentOrder;
      
      // Zwróć zaktualizowany stan
      return prevJobs.map(j => {
        if (j.id === jobId) return { ...j, order: belowOrder };
        if (j.id === jobBelow.id) return { ...j, order: currentOrder };
        return j;
      });
    });
    
    // Zapisz do backendu (tylko jeśli były zmiany)
    if (newOrderForCurrent !== undefined && newOrderForBelow !== undefined && jobBelowId && columnId) {
      try {
        await Promise.all([
          jobsService.updateJobColumn(jobId, columnId, newOrderForCurrent),
          jobsService.updateJobColumn(jobBelowId, columnId, newOrderForBelow)
        ]);
      } catch (err) {
        console.error('Failed to save order:', err);
        loadJobs(); // Reload on error
      }
    }
  }, [loadJobs]);

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
    
    try {
      await jobsService.deleteJob(jobId);
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
    
    const now = Date.now();
    
    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, status: JobStatus.ARCHIVED, completedAt: now, columnId: 'ARCHIVE' as JobColumnId } : j
    ));
    
    try {
      await jobsService.updateJob(jobId, {
        status: JobStatus.ARCHIVED,
        completedAt: now,
        columnId: 'ARCHIVE' as JobColumnId
      });
      if (selectedJob?.id === jobId) handleBack();
    } catch (err) {
      loadJobs();
    }
  }, [jobs, selectedJob, loadJobs]);

  const handleSaveJob = useCallback(async (jobId: string, updates: Partial<Job>) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    try {
      await jobsService.updateJob(jobId, updates);
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
    
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, paymentStatus: status } : j));
    
    try {
      await jobsService.updateJob(jobId, { paymentStatus: status });
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
          refreshTrigger={refreshTrigger}
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
          {mapProvider === 'GOOGLE' ? (
            <MobileGoogleMapView
              jobs={jobs}
              onBack={handleBack}
              onOpenJob={handleOpenJob}
            />
          ) : (
            <MobileMapView
              jobs={jobs}
              onBack={handleBack}
              onOpenJob={handleOpenJob}
            />
          )}
        </Suspense>
      )}
    </div>
  );
};

export default MobileApp;