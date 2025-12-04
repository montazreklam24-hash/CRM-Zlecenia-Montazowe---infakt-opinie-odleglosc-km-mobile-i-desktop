import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InputForm from './components/InputForm';
import JobCard from './components/JobCard';
import { parseGmailThread } from './services/geminiService';
import { apiService } from './services/apiService';
import { AppState, UserRole, Job } from './types';
import { AlertCircle, LogOut, Layout, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'LOGIN',
    currentUser: null,
    selectedJobId: null,
    inputText: '',
    selectedImages: [],
    isProcessing: false,
    tempJobData: null,
    error: null
  });

  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // --- SPRAWDZANIE AUTORYZACJI PRZY STARCIE ---
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      
      // Sprawdź czy jest zapisana sesja
      if (apiService.isAuthenticated()) {
        try {
          const user = await apiService.verifySession();
          if (user) {
            const role = user.role === 'admin' ? UserRole.ADMIN : UserRole.WORKER;
            setState(prev => ({ ...prev, currentUser: role, currentView: 'DASHBOARD' }));
          }
        } catch {
          // Sesja wygasła - zostaw na stronie logowania
        }
      }
      
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);

  // --- DEEP LINKING & INIT ---
  useEffect(() => {
    // Check for ?jobId=XYZ in URL
    const params = new URLSearchParams(window.location.search);
    const jobIdParam = params.get('jobId');
    if (jobIdParam) {
      setPendingJobId(jobIdParam);
    }
    
    // Load logo
    const loadLogo = async () => {
      const logo = await apiService.getDefaultLogo();
      if (logo) setAppLogo(logo);
    };
    loadLogo();
  }, [state.currentView]);

  // Handle pending job redirect after login
  useEffect(() => {
    const handlePendingRedirect = async () => {
      if (state.currentUser && pendingJobId) {
        const job = await apiService.getJobById(pendingJobId);
        if (job) {
          setCurrentJob(job);
          setState(prev => ({ ...prev, currentView: 'VIEW_JOB', selectedJobId: job.id }));
        }
        // Clear the param from URL without refresh to clean up
        window.history.replaceState({}, '', window.location.pathname);
        setPendingJobId(null);
      }
    };

    handlePendingRedirect();
  }, [state.currentUser, pendingJobId]);

  // --- NAVIGATION HELPERS ---
  const goToDashboard = () => {
    setState(prev => ({ ...prev, currentView: 'DASHBOARD', tempJobData: null, error: null, selectedJobId: null }));
    setCurrentJob(null);
  };

  const handleLogin = (role: UserRole) => {
    setState(prev => ({ ...prev, currentUser: role, currentView: 'DASHBOARD' }));
  };

  const handleLogout = async () => {
    await apiService.logout();
    setState(prev => ({ ...prev, currentUser: null, currentView: 'LOGIN' }));
  };

  // --- JOB CREATION FLOW (ADMIN) ---
  const handleStartCreate = () => {
    setState(prev => ({ ...prev, currentView: 'CREATE' }));
  };

  const handleGenerate = async (title: string, text: string, images: string[]) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const parsedData = await parseGmailThread(text, images);
      
      let finalTitle = title;
      if (parsedData.suggestedTitle && (title.includes('Do analizy') || title.length < 5)) {
        finalTitle = parsedData.suggestedTitle;
      }

      const jobData = {
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
        error: "Błąd AI: Nie udało się przetworzyć wiadomości."
      }));
    }
  };

  // --- VIEW EXISTING JOB ---
  const handleSelectJob = (job: Job) => {
    setCurrentJob(job);
    setState(prev => ({ ...prev, currentView: 'VIEW_JOB', selectedJobId: job.id }));
  };

  // --- LOADING SCREEN ---
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl shadow-2xl">
              <span className="text-4xl font-black text-white">M24</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 text-white/80">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Ładowanie...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 text-gray-900 pb-10 font-inter">
      
      {/* Top Bar (Only if logged in) */}
      {state.currentView !== 'LOGIN' && (
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 px-4 py-3 mb-6 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={goToDashboard}>
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-10 w-auto object-contain" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/40 transition-shadow">
                M
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-xl text-gray-900 hidden md:inline tracking-tight leading-none group-hover:text-orange-600 transition-colors">
                Montaż Reklam 24
              </span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hidden md:block">
                CRM v1.0
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Zalogowano jako</div>
              <div className="text-sm font-bold text-blue-600">
                {state.currentUser === UserRole.ADMIN ? 'Administrator' : 'Pracownik Terenowy'}
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="p-2.5 bg-gray-100 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all text-gray-600 group"
              title="Wyloguj"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4">
        
        {/* ERROR BANNER */}
        {state.error && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-800">Wystąpił błąd</h3>
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          </div>
        )}

        {/* --- VIEWS --- */}
        
        {state.currentView === 'LOGIN' && (
          <Login onLogin={handleLogin} />
        )}

        {state.currentView === 'DASHBOARD' && state.currentUser && (
          <Dashboard 
            role={state.currentUser} 
            onSelectJob={handleSelectJob}
            onCreateNew={handleStartCreate}
          />
        )}

        {state.currentView === 'CREATE' && (
          <div className="animate-fade-in">
            <button 
              onClick={goToDashboard} 
              className="mb-4 text-gray-500 hover:text-gray-900 flex items-center text-sm font-medium transition-colors bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow"
            >
              &larr; Anuluj i wróć
            </button>
            <InputForm onSubmit={handleGenerate} isProcessing={state.isProcessing} />
          </div>
        )}

        {state.currentView === 'VIEW_JOB' && state.currentUser && (
          <div className="animate-fade-in">
            <JobCard 
              role={state.currentUser}
              job={currentJob || undefined} 
              initialData={state.tempJobData || undefined}
              initialImages={state.selectedImages}
              onBack={goToDashboard}
              onJobSaved={() => {
                goToDashboard();
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
