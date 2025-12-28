import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Login from './components/Login';
import DashboardLegacy from './components/DashboardLegacy';
import DashboardOmega from './components/OmegaDashboard/DashboardOmega';
import InputForm from './components/InputForm';
import JobCard from './components/JobCard';
import { SimpleJobCard } from './components/SimpleJobCard';
import Layout from './components/Layout';
import InvoiceModule from './components/InvoiceModule';
import ClientModule from './components/ClientModule';
import MapPage from './pages/MapPage';
import InvoicingPage from './pages/InvoicingPage';
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
  // Przywróć returnToArchive z localStorage przy inicjalizacji
  const savedTab = localStorage.getItem('dashboard_active_tab');
  const initialReturnToArchive = savedTab === 'ARCHIVED';
  
  const [state, setState] = useState<AppState>({
    currentView: 'APP',
    user: AUTO_USER,
    activeModal: 'NONE',
    selectedJob: null,
    tempJobData: null,
    selectedImages: [],
    isProcessing: false,
    error: null,
    returnToArchive: initialReturnToArchive
  });

  useEffect(() => {
    // Obsługa przycisku wstecz w przeglądarce
    const handlePopState = (e: PopStateEvent) => {
      // Sprawdź czy w URL jest jobId
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('job');
      
      // Jeśli modal jest otwarty i nie ma jobId w URL (lub state nie ma modal), zamknij modal
      if (state.activeModal !== 'NONE') {
        // Sprawdź czy state ma informację o modalu
        const stateHasModal = e.state && (e.state as any).modal;
        
        // Jeśli nie ma jobId w URL lub state nie ma modala, zamknij modal
        if (!jobId || !stateHasModal) {
          setState(prev => ({
            ...prev,
            activeModal: 'NONE',
            selectedJob: null,
            tempJobData: null,
            selectedImages: [],
            error: null
          }));
          setDashboardRefreshTrigger(prev => prev + 1);
          
          // Jeśli URL nadal ma jobId, usuń go
          if (jobId) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Sprawdź czy jest token z Google OAuth
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const googleLogin = params.get('google_login');
    const error = params.get('error');
    
    if (error) {
      setState(prev => ({ ...prev, error, currentView: 'LOGIN' }));
      // Usuń error z URL
      window.history.replaceState({}, '', window.location.pathname);
      return () => window.removeEventListener('popstate', handlePopState);
    }
    
    if (token && googleLogin === '1') {
      // Zapisz token
      localStorage.setItem('crm_auth_token', token);
      
      // Pobierz dane użytkownika
      authService.getCurrentUser().then(user => {
        if (user) {
          setState(prev => ({ ...prev, user, currentView: 'APP' }));
          // Usuń token z URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }).catch(() => {
        // Jeśli błąd, przekieruj do logowania
        localStorage.removeItem('crm_auth_token');
        setState(prev => ({ ...prev, currentView: 'LOGIN' }));
      });
      return () => window.removeEventListener('popstate', handlePopState);
    }
    
    // Oryginalny kod dla jobId z URL - tylko jeśli nie ma już otwartego modala
    const jobId = params.get('job');
    if (jobId && state.user && state.activeModal === 'NONE') {
      // Sprawdź czy zlecenie jest z archiwum
      jobsService.getJob(jobId).then(job => {
        if (job) {
          const fromArchive = job.status === JobStatus.ARCHIVED;
          handleSelectJob(job, fromArchive);
        }
      }).catch(err => console.error('Failed to load job from URL:', err));
    }
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.user, state.activeModal]);

  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);
  
  // Dashboard Variant logic (Legacy vs Omega)
  const [dashVariant, setDashVariant] = useState<'legacy' | 'omega'>(() => {
    const saved = localStorage.getItem('crm_dashboard_variant');
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('dash');
    
    if (fromUrl === 'omega') return 'omega';
    if (fromUrl === 'legacy') return 'legacy';
    return (saved as 'legacy' | 'omega') || 'legacy';
  });

  useEffect(() => {
    localStorage.setItem('crm_dashboard_variant', dashVariant);
  }, [dashVariant]);
  
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

  const handleLogoClick = () => {
    localStorage.setItem('dashboard_active_tab', 'ACTIVE');
    setState(prev => ({ ...prev, returnToArchive: false }));
    setDashboardRefreshTrigger(prev => prev + 1);
  };

  const closeModal = () => {
    // Usuń jobId z URL jeśli jest
    const params = new URLSearchParams(window.location.search);
    if (params.get('job')) {
      // Usuń jobId z URL bez zmiany historii (replaceState)
      window.history.replaceState({}, '', window.location.pathname);
    }
    
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
    // Zapisz informację o archiwum w localStorage
    if (fromArchive) {
      localStorage.setItem('dashboard_active_tab', 'ARCHIVED');
    } else {
      localStorage.setItem('dashboard_active_tab', 'ACTIVE');
    }
    
    // Dodaj wpis do historii przeglądarki dla modala
    window.history.pushState({ modal: 'VIEW_JOB', jobId: job.id }, '', `?job=${job.id}`);
    
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
        await jobsService.updateJob(jobData.id, jobData);
      } else {
        await jobsService.createJob(
          jobData.data!, 
          jobData.projectImages || [], 
          jobData.adminNotes
        );
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
             onPaymentStatusChange={async (jobId, status, source) => {
               const job = state.selectedJob;
               if (!job) return;
               
               const { checkPaymentStatusChange } = await import('./utils/paymentStatusGuard');
               const canChange = checkPaymentStatusChange(job, status, source);
               if (!canChange) return;

               try {
                 await jobsService.updateJob(jobId, { paymentStatus: status });
                 setState(prev => ({
                   ...prev,
                   selectedJob: prev.selectedJob?.id === jobId 
                     ? { ...prev.selectedJob, paymentStatus: status } 
                     : prev.selectedJob
                 }));
                 setDashboardRefreshTrigger(prev => prev + 1);
               } catch (error) {
                 console.error('Failed to update payment status:', error);
               }
             }}
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
        <Route element={
          <Layout 
            onLogout={handleLogout} 
            onLogoClick={handleLogoClick} 
            user={state.user || undefined} 
            dashVariant={dashVariant}
            onDashVariantChange={setDashVariant}
          />
        }>
          <Route path="/" element={
            dashVariant === 'omega' ? (
              <DashboardOmega 
                role={userRole} 
                onSelectJob={handleSelectJob}
                onCreateNew={handleStartCreate}
                onCreateNewSimple={handleStartCreateSimple}
                initialTab={state.returnToArchive ? 'ARCHIVED' : 'ACTIVE'}
                refreshTrigger={dashboardRefreshTrigger}
              />
            ) : (
              <DashboardLegacy 
                role={userRole} 
                onSelectJob={handleSelectJob}
                onCreateNew={handleStartCreate}
                onCreateNewSimple={handleStartCreateSimple}
                initialTab={state.returnToArchive ? 'ARCHIVED' : 'ACTIVE'}
                refreshTrigger={dashboardRefreshTrigger}
              />
            )
          } />
          <Route path="/map" element={<MapPage onSelectJob={handleSelectJob} />} />
          <Route path="/invoices" element={<InvoicingPage />} />
          <Route path="/clients" element={<ClientModule onSelectJob={handleSelectJob} refreshTrigger={dashboardRefreshTrigger} />} />
        </Route>
      </Routes>

      {/* GLOBAL MODALS (Overlay) */}
      {state.activeModal !== 'NONE' && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
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
                    await jobsService.updateJob(id, { status: JobStatus.ARCHIVED, completedAt: Date.now(), columnId: 'ARCHIVE' as const });
                    closeModal();
                 }}
                 onDelete={async (id) => {
                    await jobsService.deleteJob(id);
                    closeModal();
                 }}
                 onPaymentStatusChange={async (jobId, status, source) => {
                   const job = state.selectedJob;
                   if (!job) return;
                   
                   const { checkPaymentStatusChange } = await import('./utils/paymentStatusGuard');
                   const canChange = checkPaymentStatusChange(job, status, source);
                   if (!canChange) return;

                   try {
                     await jobsService.updateJob(jobId, { paymentStatus: status });
                     setState(prev => ({
                       ...prev,
                       selectedJob: prev.selectedJob?.id === jobId 
                         ? { ...prev.selectedJob, paymentStatus: status } 
                         : prev.selectedJob
                     }));
                     setDashboardRefreshTrigger(prev => prev + 1);
                   } catch (error) {
                     console.error('Failed to update payment status:', error);
                   }
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
