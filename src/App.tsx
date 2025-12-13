import React, { useState, useEffect, lazy, Suspense } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InputForm from './components/InputForm';
import JobCard from './components/JobCard';
import { SimpleJobCard } from './components/SimpleJobCard';
import ThemeSwitcher from './components/ThemeSwitcher';
import { geminiService, authService, settingsService, jobsService } from './services/apiService';
import { User, UserRole, Job, JobOrderData, JobStatus } from './types';
import { AlertCircle, LogOut, Loader2, Monitor, Smartphone } from 'lucide-react';
import { useDeviceType } from './hooks/useDeviceType';

// Lazy load MobileApp for better desktop performance
const MobileApp = lazy(() => import('./MobileApp'));

interface AppState {
  currentView: 'LOGIN' | 'DASHBOARD' | 'CREATE' | 'VIEW_JOB' | 'CREATE_SIMPLE';
  user: User | null;
  selectedJob: Job | null;
  tempJobData: JobOrderData | null;
  selectedImages: string[];
  isProcessing: boolean;
  error: string | null;
  returnToArchive?: boolean; // Flaga - wróć do archiwum po zamknięciu karty
}

// Automatyczny użytkownik - bez logowania
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
    currentView: 'DASHBOARD', // Od razu Dashboard
    user: AUTO_USER, // Automatycznie zalogowany
    selectedJob: null,
    tempJobData: null,
    selectedImages: [],
    isProcessing: false,
    error: null
  });

  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false); // Start as false - no loading screen
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0); // Trigger do odświeżania Dashboard

  // Mobile detection
  const { isMobile, isTablet, isTouchDevice } = useDeviceType();
  
  // Allow forcing mobile/desktop view via URL param ?mobile=1 or ?desktop=1
  const urlParams = new URLSearchParams(window.location.search);
  const forceMobile = urlParams.get('mobile') === '1';
  const forceDesktop = urlParams.get('desktop') === '1';
  const showMobileView = forceDesktop ? false : (forceMobile || isMobile || (isTablet && isTouchDevice));

  // Navigation helpers
  const goToDashboard = () => {
    setState(prev => ({ 
      ...prev, 
      currentView: 'DASHBOARD', 
      tempJobData: null, 
      error: null, 
      selectedJob: null,
      selectedImages: []
      // returnToArchive zostaje zachowane z poprzedniego stanu
    }));
    // Odśwież Dashboard gdy wracamy do niego (np. po utworzeniu zlecenia)
    setDashboardRefreshTrigger(prev => prev + 1);
  };

  const handleLogin = (user: User) => {
    setState(prev => ({ ...prev, user, currentView: 'DASHBOARD' }));
  };

  const handleLogout = async () => {
    await authService.logout();
    setState(prev => ({ ...prev, user: null, currentView: 'LOGIN' }));
  };

  const handleStartCreate = () => {
    setState(prev => ({ ...prev, currentView: 'CREATE' }));
  };

  const handleStartCreateSimple = () => {
    setState(prev => ({ ...prev, currentView: 'CREATE_SIMPLE', selectedJob: null }));
  };

  const handleSaveSimpleJob = async (jobData: Partial<Job>) => {
    try {
      if (jobData.id) {
        // Update existing
        await fetch('/api/jobs-simple/' + jobData.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobData)
        });
      } else {
        // Create new
        await fetch('/api/jobs-simple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobData)
        });
      }
      // Odśwież Dashboard po utworzeniu/aktualizacji zlecenia
      setDashboardRefreshTrigger(prev => prev + 1);
      goToDashboard();
    } catch (error) {
      console.error('Error saving simple job:', error);
      alert('Błąd zapisu zlecenia');
    }
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
        currentView: 'VIEW_JOB'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : "Błąd AI: Nie udało się przetworzyć wiadomości."
      }));
    }
  };

  const handleSelectJob = (job: Job, fromArchive?: boolean) => {
    setState(prev => ({ 
      ...prev, 
      currentView: 'VIEW_JOB', 
      selectedJob: job,
      returnToArchive: fromArchive ?? false
    }));
  };

  // Loading screen
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-2xl shadow-orange-500/20">
            <span className="text-3xl font-black text-white">M24</span>
          </div>
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-slate-400 text-sm">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // Login view
  if (state.currentView === 'LOGIN' || !state.user) {
    return <Login onLogin={handleLogin} />;
  }

  const userRole = state.user.role as UserRole;

  // Mobile View - completely different layout optimized for touch
  if (showMobileView) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-2xl shadow-orange-500/20">
              <span className="text-2xl font-black text-white">M24</span>
            </div>
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-slate-400 text-sm">Ładowanie widoku mobilnego...</p>
          </div>
        </div>
      }>
        {/* Mobile views that need desktop forms */}
        {state.currentView === 'CREATE' && (
          <div className="min-h-screen bg-white p-4">
            <button 
              onClick={goToDashboard} 
              className="mb-4 text-slate-500 flex items-center text-sm font-medium"
            >
              ← Anuluj i wróć
            </button>
            <InputForm 
              onSubmit={handleGenerate} 
              isProcessing={state.isProcessing} 
              onSwitchToManual={handleStartCreateSimple}
            />
          </div>
        )}
        
        {state.currentView === 'CREATE_SIMPLE' && (
          <SimpleJobCard
            job={state.selectedJob || undefined}
            onClose={goToDashboard}
            onSave={handleSaveSimpleJob}
          />
        )}
        
        {state.currentView === 'VIEW_JOB' && (
          <JobCard 
            role={userRole}
            job={state.selectedJob || undefined}
            initialData={state.tempJobData || undefined}
            initialImages={state.selectedImages}
            onBack={goToDashboard}
            onJobSaved={goToDashboard}
            onArchive={async (id) => {
              const job = state.selectedJob;
              const jobType = job?.type === 'simple' ? 'simple' : 'ai';
              try {
                await jobsService.updateJob(id, { 
                  status: JobStatus.ARCHIVED,
                  completedAt: Date.now(),
                  columnId: 'ARCHIVE' as const
                }, jobType);
                goToDashboard();
              } catch (error) {
                console.error('Failed to archive:', error);
              }
            }}
            onDelete={async (id) => {
              const job = state.selectedJob;
              const jobType = job?.type === 'simple' ? 'simple' : 'ai';
              try {
                await jobsService.deleteJob(id, jobType);
                goToDashboard();
              } catch (error) {
                console.error('Failed to delete:', error);
              }
            }}
          />
        )}
        
        {(state.currentView === 'DASHBOARD') && (
          <MobileApp 
            role={userRole}
            onCreateNew={handleStartCreate}
            onCreateNewSimple={handleStartCreateSimple}
          />
        )}
      </Suspense>
    );
  }

  // Desktop View
  return (
    <div className="min-h-screen pb-10 transition-colors duration-300" style={{ color: 'var(--text-primary)' }}>
      
      {/* Top Bar */}
      <div className="theme-header sticky top-0 z-50 px-2 sm:px-4 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0" onClick={goToDashboard}>
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-8 sm:h-10 w-auto object-contain" />
            ) : (
              <div className="p-1.5 sm:p-2 shadow-lg" style={{ background: 'var(--accent-orange)', borderRadius: 'var(--radius-md)' }}>
                <span className="text-sm sm:text-lg font-black text-white">M24</span>
              </div>
            )}
            <div className="flex flex-col hidden sm:flex">
              <span className="font-bold text-lg hidden md:inline tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                Montaż Reklam 24
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider hidden md:block" style={{ color: 'var(--accent-orange)' }}>
                CRM 5.0 PC + Mobile
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* PC/Mobile Switcher */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
              <button
                onClick={() => {
                  window.location.href = window.location.pathname + '?desktop=1';
                }}
                className="p-2 rounded-md transition-all flex items-center gap-1"
                style={{ 
                  background: !showMobileView ? 'var(--accent-primary)' : 'transparent',
                  color: !showMobileView ? 'white' : 'var(--text-muted)'
                }}
                title="Wersja PC"
              >
                <Monitor className="w-4 h-4" />
                <span className="text-xs font-bold hidden sm:inline">PC</span>
              </button>
              <button
                onClick={() => {
                  window.location.href = window.location.pathname + '?mobile=1';
                }}
                className="p-2 rounded-md transition-all flex items-center gap-1"
                style={{ 
                  background: showMobileView ? 'var(--accent-primary)' : 'transparent',
                  color: showMobileView ? 'white' : 'var(--text-muted)'
                }}
                title="Wersja Mobile"
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-xs font-bold hidden sm:inline">Mobile</span>
              </button>
            </div>
            
            {/* Theme Switcher */}
            <ThemeSwitcher />
            
            <div className="text-right hidden md:block">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Zalogowano jako</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {state.user.name}
                <span 
                  className="ml-2 text-[10px] px-2 py-0.5"
                  style={{ 
                    background: userRole === UserRole.ADMIN ? 'var(--accent-primary)' : 'var(--accent-orange)',
                    color: 'var(--text-inverse)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  {userRole === UserRole.ADMIN ? 'Admin' : 'Pracownik'}
                </span>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="p-2 sm:p-2.5 transition-colors"
              style={{ 
                background: 'var(--bg-surface)', 
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)'
              }}
              title="Wyloguj"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        
        {/* Error Banner */}
        {state.error && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-800">Wystąpił błąd</h3>
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
            <button 
              onClick={() => setState(prev => ({ ...prev, error: null }))}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Views */}
        {state.currentView === 'DASHBOARD' && (
          <Dashboard 
            role={userRole} 
            onSelectJob={handleSelectJob}
            onCreateNew={handleStartCreate}
            onCreateNewSimple={handleStartCreateSimple}
            initialTab={state.returnToArchive ? 'ARCHIVED' : 'ACTIVE'}
            refreshTrigger={dashboardRefreshTrigger}
          />
        )}

        {state.currentView === 'CREATE' && (
          <div className="animate-fade-in">
            <button 
              onClick={goToDashboard} 
              className="mb-4 text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors"
            >
              ← Anuluj i wróć
            </button>
            <InputForm 
              onSubmit={handleGenerate} 
              isProcessing={state.isProcessing} 
              onSwitchToManual={handleStartCreateSimple}
            />
          </div>
        )}

        {state.currentView === 'VIEW_JOB' && (
          <div className="animate-fade-in">
            <JobCard 
              role={userRole}
              job={state.selectedJob || undefined}
              initialData={state.tempJobData || undefined}
              initialImages={state.selectedImages}
              onBack={goToDashboard}
              onJobSaved={goToDashboard}
              onArchive={async (id) => {
                const job = state.selectedJob;
                const jobType = job?.type === 'simple' ? 'simple' : 'ai';
                try {
                  await jobsService.updateJob(id, { 
                    status: JobStatus.ARCHIVED,
                    completedAt: Date.now(),
                    columnId: 'ARCHIVE' as const
                  }, jobType);
                } catch (error) {
                  console.error('Failed to archive:', error);
                }
              }}
              onDelete={async (id) => {
                const job = state.selectedJob;
                const jobType = job?.type === 'simple' ? 'simple' : 'ai';
                try {
                  await jobsService.deleteJob(id, jobType);
                } catch (error) {
                  console.error('Failed to delete:', error);
                }
              }}
            />
          </div>
        )}

        {state.currentView === 'CREATE_SIMPLE' && (
          <SimpleJobCard
            job={state.selectedJob || undefined}
            onClose={goToDashboard}
            onSave={handleSaveSimpleJob}
          />
        )}
      </div>
    </div>
  );
};

export default App;