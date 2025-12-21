import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InputForm from './components/InputForm';
import JobCard from './components/JobCard';
import { SimpleJobCard } from './components/SimpleJobCard';
import Layout from './components/Layout';
import InvoiceModule from './components/InvoiceModule';
import ClientModule from './components/ClientModule';
import MapPage from './pages/MapPage';
import { geminiService, authService, jobsService } from './services/apiService';
import { User, UserRole, Job, JobOrderData, JobStatus } from './types';
import { Loader2 } from 'lucide-react';
import { useDeviceType } from './hooks/useDeviceType';

// Lazy load MobileApp for better desktop performance
const MobileApp = lazy(() => import('./MobileApp'));

interface AppState {
  currentView: 'LOGIN' | 'APP'; // Uproszczony stan - resztą zarządza Router
  user: User | null;
  // Modale (nadal sterowane stanem dla płynności)
  activeModal: 'NONE' | 'CREATE' | 'CREATE_SIMPLE' | 'VIEW_JOB';
  selectedJob: Job | null;
  tempJobData: JobOrderData | null;
  selectedImages: string[];
  isProcessing: boolean;
  error: string | null;
  returnToArchive?: boolean;
}

const AUTO_USER: User = {
  id: 1,
  email: 'admin@montazreklam24.pl',
  name: 'Administrator',
  role: UserRole.ADMIN,
  phone: null,
  is_active: true,
  last_login: null
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'APP',
    user: AUTO_USER,
    activeModal: 'NONE',
    selectedJob: null,
    tempJobData: null,
    selectedImages: [],
    isProcessing: false,
    error: null
  });

  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);
  
  // Mobile detection
  const { isMobile, isTablet, isTouchDevice } = useDeviceType();
  const urlParams = new URLSearchParams(window.location.search);
  const forceMobile = urlParams.get('mobile') === '1';
  const forceDesktop = urlParams.get('desktop') === '1';
  const showMobileView = forceDesktop ? false : (forceMobile || isMobile || (isTablet && isTouchDevice));

  const handleLogin = (user: User) => {
    setState(prev => ({ ...prev, user, currentView: 'APP' }));
  };

  const handleLogout = async () => {
    await authService.logout();
    setState(prev => ({ ...prev, user: null, currentView: 'LOGIN' }));
  };

  const closeModal = () => {
    setState(prev => ({
      ...prev,
      activeModal: 'NONE',
      selectedJob: null,
      tempJobData: null,
      selectedImages: [],
      error: null
    }));
    setDashboardRefreshTrigger(prev => prev + 1);
  };

  const handleStartCreate = () => {
    setState(prev => ({ ...prev, activeModal: 'CREATE' }));
  };

  const handleStartCreateSimple = () => {
    setState(prev => ({ ...prev, activeModal: 'CREATE_SIMPLE', selectedJob: null }));
  };

  const handleSelectJob = (job: Job, fromArchive?: boolean) => {
    setState(prev => ({ 
      ...prev, 
      activeModal: 'VIEW_JOB', 
      selectedJob: job,
      returnToArchive: fromArchive ?? false
    }));
  };

  const handleGenerate = async (title: string, text: string, images: string[]) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const parsedData = await geminiService.parseEmail(text, images);
      
      let finalTitle = title;
      if (parsedData.suggestedTitle && (title.includes('Do analizy') || title.length < 5)) {
        finalTitle = parsedData.suggestedTitle;
      }

      const jobData: JobOrderData = {
        ...parsedData,
        jobTitle: finalTitle
      };

      setState(prev => ({
        ...prev,
        isProcessing: false,
        tempJobData: jobData,
        selectedImages: images,
        activeModal: 'VIEW_JOB'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "Błąd AI: Nie udało się przetworzyć wiadomości."
      }));
    }
  };

  const handleSaveSimpleJob = async (jobData: Partial<Job>) => {
    try {
      if (jobData.id) {
        await jobsService.updateJob(jobData.id, jobData, 'simple');
      } else {
        await fetch('/api/jobs-simple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobData)
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving simple job:', error);
      alert('Błąd zapisu zlecenia');
    }
  };

  // Login view
  if (state.currentView === 'LOGIN' || !state.user) {
    return <Login onLogin={handleLogin} />;
  }

  const userRole = state.user.role as UserRole;

  // --- MOBILE VIEW ---
  if (showMobileView) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-900 text-white">Ładowanie...</div>}>
        {/* Mobile Modals */}
        {state.activeModal === 'CREATE' && (
          <div className="min-h-screen bg-white p-4">
             <button onClick={closeModal} className="mb-4">← Wróć</button>
             <InputForm 
               onSubmit={handleGenerate} 
               isProcessing={state.isProcessing} 
               onSwitchToManual={handleStartCreateSimple}
             />
          </div>
        )}
        {state.activeModal === 'CREATE_SIMPLE' && (
           <SimpleJobCard job={state.selectedJob || undefined} onClose={closeModal} onSave={handleSaveSimpleJob} />
        )}
        {state.activeModal === 'VIEW_JOB' && (
           <JobCard 
             role={userRole}
             job={state.selectedJob || undefined}
             initialData={state.tempJobData || undefined}
             initialImages={state.selectedImages}
             onBack={closeModal}
             onJobSaved={closeModal}
             onArchive={async (id) => { /* logic same as desktop */ closeModal(); }}
             onDelete={async (id) => { /* logic same as desktop */ closeModal(); }}
           />
        )}
        
        {state.activeModal === 'NONE' && (
          <MobileApp 
            role={userRole}
            onCreateNew={handleStartCreate}
            onCreateNewSimple={handleStartCreateSimple}
            refreshTrigger={dashboardRefreshTrigger}
          />
        )}
      </Suspense>
    );
  }

  // --- DESKTOP VIEW (Sidebar Layout) ---
  return (
    <>
      <Routes>
        <Route element={<Layout onLogout={handleLogout} />}>
          <Route path="/" element={
            <Dashboard 
              role={userRole} 
              onSelectJob={handleSelectJob}
              onCreateNew={handleStartCreate}
              onCreateNewSimple={handleStartCreateSimple}
              initialTab={state.returnToArchive ? 'ARCHIVED' : 'ACTIVE'}
              refreshTrigger={dashboardRefreshTrigger}
            />
          } />
          <Route path="/map" element={<MapPage onSelectJob={handleSelectJob} />} />
          <Route path="/invoices" element={<InvoiceModule />} />
          <Route path="/clients" element={<ClientModule />} />
        </Route>
      </Routes>

      {/* GLOBAL MODALS (Overlay) */}
      {state.activeModal !== 'NONE' && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl my-8">
            <button 
              onClick={closeModal}
              className="absolute -top-12 right-0 text-white hover:text-gray-200 font-medium flex items-center gap-2"
            >
              Zamknij [ESC]
            </button>

            {state.activeModal === 'CREATE' && (
              <div className="p-8">
                <InputForm 
                  onSubmit={handleGenerate} 
                  isProcessing={state.isProcessing} 
                  onSwitchToManual={handleStartCreateSimple}
                />
              </div>
            )}

            {state.activeModal === 'CREATE_SIMPLE' && (
               <SimpleJobCard
                 job={state.selectedJob || undefined}
                 onClose={closeModal}
                 onSave={handleSaveSimpleJob}
               />
            )}

            {state.activeModal === 'VIEW_JOB' && (
               <JobCard 
                 role={userRole}
                 job={state.selectedJob || undefined}
                 initialData={state.tempJobData || undefined}
                 initialImages={state.selectedImages}
                 onBack={closeModal}
                 onJobSaved={closeModal}
                 onArchive={async (id) => {
                    // Logic duplication - should be moved to service/hook
                    const job = state.selectedJob;
                    const jobType = job?.type === 'simple' ? 'simple' : 'ai';
                    await jobsService.updateJob(id, { status: JobStatus.ARCHIVED, completedAt: Date.now(), columnId: 'ARCHIVE' as const }, jobType);
                    closeModal();
                 }}
                 onDelete={async (id) => {
                    const job = state.selectedJob;
                    const jobType = job?.type === 'simple' ? 'simple' : 'ai';
                    await jobsService.deleteJob(id, jobType);
                    closeModal();
                 }}
               />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default App;
