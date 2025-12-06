import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InputForm from './components/InputForm';
import JobCard from './components/JobCard';
import ThemeSwitcher from './components/ThemeSwitcher';
import { geminiService, authService, settingsService } from './services/apiService';
import { User, UserRole, Job, JobOrderData } from './types';
import { AlertCircle, LogOut, Loader2 } from 'lucide-react';

interface AppState {
  currentView: 'LOGIN' | 'DASHBOARD' | 'CREATE' | 'VIEW_JOB';
  user: User | null;
  selectedJob: Job | null;
  tempJobData: JobOrderData | null;
  selectedImages: string[];
  isProcessing: boolean;
  error: string | null;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'LOGIN',
    user: null,
    selectedJob: null,
    tempJobData: null,
    selectedImages: [],
    isProcessing: false,
    error: null
  });

  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setState(prev => ({ ...prev, user, currentView: 'DASHBOARD' }));
        }
        
        // Load logo
        try {
          const logo = await settingsService.getDefaultLogo();
          if (logo) setAppLogo(logo);
        } catch {}
      } catch {
        authService.clearToken();
      } finally {
        setIsInitializing(false);
      }
    };
    
    initApp();
  }, []);

  // Navigation helpers
  const goToDashboard = () => {
    setState(prev => ({ 
      ...prev, 
      currentView: 'DASHBOARD', 
      tempJobData: null, 
      error: null, 
      selectedJob: null,
      selectedImages: []
    }));
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

  const handleSelectJob = (job: Job) => {
    setState(prev => ({ ...prev, currentView: 'VIEW_JOB', selectedJob: job }));
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
                CRM v2.0
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
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
            <InputForm onSubmit={handleGenerate} isProcessing={state.isProcessing} />
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
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

