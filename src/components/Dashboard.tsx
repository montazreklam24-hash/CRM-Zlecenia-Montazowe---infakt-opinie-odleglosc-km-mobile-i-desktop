import React, { useEffect, useState, useRef } from 'react';
import { Job, JobStatus, UserRole, JobColumnId, PaymentStatus } from '../types';
import { jobsService } from '../services/apiService';
import { 
  Plus, MapPin, CheckCircle2, Trash2, Box, LayoutList, Kanban, 
  Download, Copy, Upload, Map as MapIcon, RefreshCw, Search
} from 'lucide-react';
import MapBoard from './MapBoard';
import PaymentStatusBadge, { PaymentStatusBar, PaymentStatusIcon } from './PaymentStatusBadge';

interface DashboardProps {
  role: UserRole;
  onSelectJob: (job: Job) => void;
  onCreateNew: () => void;
}

const ROWS_CONFIG: { 
  id: JobColumnId; 
  title: string; 
  headerBg: string; 
  dotColor: string; 
  borderColor: string;
  bodyBg: string; 
  headerText: string; 
  badgeBg: string;
  badgeText: string;
}[] = [
  { id: 'PREPARE', title: 'DO PRZYGOTOWANIA', headerBg: 'bg-gradient-to-r from-slate-700 to-slate-800', headerText: 'text-white', dotColor: 'text-slate-600', bodyBg: 'bg-slate-50/50', borderColor: 'border-slate-600', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700' },
  { id: 'ANYTIME', title: 'DOWOLNY TERMIN', headerBg: 'bg-gradient-to-r from-slate-500 to-slate-600', headerText: 'text-white', dotColor: 'text-slate-500', bodyBg: 'bg-slate-50/30', borderColor: 'border-slate-400', badgeBg: 'bg-slate-100', badgeText: 'text-slate-600' },
  { id: 'MON', title: 'PONIEDZIAŁEK', headerBg: 'bg-gradient-to-r from-rose-500 to-rose-600', headerText: 'text-white', dotColor: 'text-rose-500', bodyBg: 'bg-rose-50/50', borderColor: 'border-rose-500', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700' },
  { id: 'TUE', title: 'WTOREK', headerBg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', headerText: 'text-white', dotColor: 'text-emerald-500', bodyBg: 'bg-emerald-50/50', borderColor: 'border-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  { id: 'WED', title: 'ŚRODA', headerBg: 'bg-gradient-to-r from-violet-500 to-violet-600', headerText: 'text-white', dotColor: 'text-violet-500', bodyBg: 'bg-violet-50/50', borderColor: 'border-violet-500', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  { id: 'THU', title: 'CZWARTEK', headerBg: 'bg-gradient-to-r from-amber-400 to-amber-500', headerText: 'text-amber-900', dotColor: 'text-amber-500', bodyBg: 'bg-amber-50/50', borderColor: 'border-amber-400', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
  { id: 'FRI', title: 'PIĄTEK', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-600', headerText: 'text-white', dotColor: 'text-blue-500', bodyBg: 'bg-blue-50/50', borderColor: 'border-blue-500', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  { id: 'SAT', title: 'SOBOTA', headerBg: 'bg-gradient-to-r from-orange-500 to-orange-600', headerText: 'text-white', dotColor: 'text-orange-500', bodyBg: 'bg-orange-50/50', borderColor: 'border-orange-500', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700' },
  { id: 'SUN', title: 'NIEDZIELA', headerBg: 'bg-gradient-to-r from-amber-700 to-amber-800', headerText: 'text-white', dotColor: 'text-amber-700', bodyBg: 'bg-amber-50/50', borderColor: 'border-amber-700', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
  { id: 'COMPLETED', title: 'WYKONANE', headerBg: 'bg-gradient-to-r from-green-600 to-green-700', headerText: 'text-white', dotColor: 'text-green-600', bodyBg: 'bg-green-50/50', borderColor: 'border-green-600', badgeBg: 'bg-green-100', badgeText: 'text-green-700' },
];

const Dashboard: React.FC<DashboardProps> = ({ role, onSelectJob, onCreateNew }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [viewMode, setViewMode] = useState<'LIST' | 'BOARD' | 'MAP'>('BOARD');
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await jobsService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Czy na pewno usunąć to zlecenie?')) {
      await jobsService.deleteJob(id);
      loadJobs();
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Zduplikować to zlecenie?')) {
      await jobsService.duplicateJob(id);
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

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('jobId', jobId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: JobColumnId) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('jobId');
    if (!jobId) return;

    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, columnId: targetColumnId } : j));
    await jobsService.updateJobColumn(jobId, targetColumnId);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesTab = activeTab === 'ACTIVE' 
      ? job.status !== JobStatus.ARCHIVED 
      : job.status === JobStatus.ARCHIVED;
    
    const matchesSearch = !searchQuery || 
      job.data.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.data.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.data.address?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  const getJobsForColumn = (colId: JobColumnId) => 
    filteredJobs.filter(j => (j.columnId || 'PREPARE') === colId);

  const isAdmin = role === UserRole.ADMIN;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Ładowanie zleceń...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        {/* Left: Tabs */}
        <div className="flex gap-2">
          <div className="flex bg-white/80 backdrop-blur p-1 rounded-xl shadow-sm border border-slate-200/50">
            <button 
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ACTIVE' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              AKTYWNE ({jobs.filter(j => j.status !== JobStatus.ARCHIVED).length})
            </button>
            <button 
              onClick={() => setActiveTab('ARCHIVED')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ARCHIVED' 
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ARCHIWUM
            </button>
          </div>
        </div>

        {/* Right: Search & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj zlecenia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/80 backdrop-blur border border-slate-200/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 w-48"
            />
          </div>
          
          {/* Refresh */}
          <button 
            onClick={loadJobs}
            className="p-2.5 bg-white/80 backdrop-blur border border-slate-200/50 text-slate-600 rounded-xl hover:bg-slate-50 shadow-sm transition-all"
            title="Odśwież"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {isAdmin && (
            <button 
              onClick={handleBackup} 
              className="p-2.5 bg-white/80 backdrop-blur border border-slate-200/50 text-slate-600 rounded-xl hover:bg-slate-50 shadow-sm" 
              title="Pobierz Kopię Zapasową"
            >
              <Download className="w-5 h-5" />
            </button>
          )}

          {/* View toggle */}
          <div className="flex bg-white/80 backdrop-blur p-1 rounded-xl shadow-sm border border-slate-200/50">
            <button 
              onClick={() => setViewMode('BOARD')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'BOARD' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} 
              title="Kanban"
            >
              <Kanban className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('LIST')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} 
              title="Lista"
            >
              <LayoutList className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('MAP')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'MAP' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} 
              title="Mapa"
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>

          {isAdmin && (
            <button 
              onClick={onCreateNew} 
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> 
              <span className="hidden sm:inline">NOWE ZLECENIE</span>
            </button>
          )}
        </div>
      </div>

      {/* MAP VIEW */}
      {viewMode === 'MAP' && (
        <MapBoard jobs={filteredJobs} onSelectJob={onSelectJob} onJobsUpdated={loadJobs} />
      )}

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'BOARD' && (
        <div className="space-y-4">
          {ROWS_CONFIG.map(row => {
            const rowJobs = getJobsForColumn(row.id);
            return (
              <div 
                key={row.id} 
                className="rounded-2xl border-l-4 shadow-sm overflow-hidden bg-white/60 backdrop-blur-sm transition-all hover:shadow-md"
                style={{ borderLeftColor: row.borderColor.replace('border-', '') }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, row.id)}
              >
                <div className={`${row.headerBg} ${row.headerText} px-4 py-3 flex justify-between items-center`}>
                  <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                    {row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}
                    {row.title}
                  </h3>
                  <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-bold">{rowJobs.length}</span>
                </div>

                <div className={`${row.bodyBg} p-4 flex gap-3 overflow-x-auto min-h-[140px] items-start`}>
                  {rowJobs.length === 0 ? (
                    <div className="text-slate-400 text-xs font-medium italic w-full text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                      Przeciągnij tutaj zlecenie
                    </div>
                  ) : (
                    rowJobs.map(job => (
                                      <div 
                                        key={job.id} 
                                        draggable 
                                        onDragStart={(e) => handleDragStart(e, job.id)}
                                        onClick={() => onSelectJob(job)}
                                        className="min-w-[140px] w-36 bg-white rounded-xl shadow-sm hover:shadow-lg border border-slate-100 cursor-pointer transition-all hover:-translate-y-1 group relative flex flex-col overflow-hidden"
                                      >
                                        {/* Payment Status Bar */}
                                        <PaymentStatusBar status={job.paymentStatus || PaymentStatus.NONE} />
                                        
                                        <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                                          {job.projectImages?.[0] ? (
                                            <img src={job.projectImages[0]} className="w-full h-full object-cover" alt="preview" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                              <Box className="w-10 h-10" />
                                            </div>
                                          )}
                                          <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                                            {job.friendlyId}
                                          </div>
                                          {/* Payment Status Icon overlay */}
                                          {job.paymentStatus && job.paymentStatus !== PaymentStatus.NONE && (
                                            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm">
                                              <PaymentStatusIcon status={job.paymentStatus} className="text-sm" />
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="p-3 flex-1 flex flex-col">
                                          <h4 className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight mb-2">
                                            {job.data.jobTitle}
                                          </h4>
                                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-2">
                                            <MapPin className="w-3 h-3 text-orange-500" />
                                            <span className="truncate">{job.data.address?.split(',')[0]}</span>
                                          </div>
                                          
                                          <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-auto">
                                            <div className="flex items-center gap-2">
                                              {/* Checklist progress */}
                                              {job.checklist && job.checklist.length > 0 && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600">
                                                  <CheckCircle2 className="w-3 h-3" />
                                                  {job.checklist.filter(i => i.isChecked).length}/{job.checklist.length}
                                                </div>
                                              )}
                                              {/* Payment amount */}
                                              {job.totalGross && job.totalGross > 0 && (
                                                <span className="text-[10px] font-bold text-slate-400">
                                                  {job.totalGross.toFixed(0)} zł
                                                </span>
                                              )}
                                            </div>
                                            {isAdmin && (
                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                  onClick={(e) => handleDuplicate(job.id, e)} 
                                                  className="text-violet-400 hover:text-violet-600 p-1"
                                                >
                                                  <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                  onClick={(e) => handleDelete(job.id, e)} 
                                                  className="text-slate-300 hover:text-red-500 p-1"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'LIST' && (
        <div className="space-y-6">
          {ROWS_CONFIG.map(row => {
            const rowJobs = getJobsForColumn(row.id);
            if (rowJobs.length === 0) return null;

            return (
              <div key={row.id}>
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide ${row.badgeBg} ${row.badgeText}`}>
                    {row.title}
                    <span className="bg-white/50 px-2 py-0.5 rounded-lg text-[10px]">{rowJobs.length}</span>
                  </span>
                </div>

                <div className="space-y-2">
                                  {rowJobs.map(job => (
                                    <div 
                                      key={job.id} 
                                      onClick={() => onSelectJob(job)} 
                                      className="bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md cursor-pointer group flex gap-4 transition-all items-center relative overflow-hidden"
                                    >
                                      {/* Payment Status Bar (left side) */}
                                      {job.paymentStatus && job.paymentStatus !== PaymentStatus.NONE && (
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                          job.paymentStatus === PaymentStatus.PAID ? 'bg-green-500' :
                                          job.paymentStatus === PaymentStatus.PROFORMA ? 'bg-orange-400' :
                                          job.paymentStatus === PaymentStatus.INVOICE ? 'bg-blue-500' :
                                          job.paymentStatus === PaymentStatus.PARTIAL ? 'bg-purple-500' :
                                          job.paymentStatus === PaymentStatus.CASH ? 'bg-yellow-400' :
                                          job.paymentStatus === PaymentStatus.OVERDUE ? 'bg-red-500' : ''
                                        }`} />
                                      )}
                                      
                                      <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl flex-shrink-0 overflow-hidden border border-slate-100 relative">
                                        {job.projectImages?.[0] ? (
                                          <img src={job.projectImages[0]} className="w-full h-full object-cover" alt="job" />
                                        ) : (
                                          <div className="flex items-center justify-center h-full">
                                            <Box className="w-7 h-7 text-slate-300" />
                                          </div>
                                        )}
                                        {/* Payment icon overlay */}
                                        {job.paymentStatus && job.paymentStatus !== PaymentStatus.NONE && (
                                          <div className="absolute bottom-1 right-1 bg-white/90 rounded-md px-1 shadow-sm">
                                            <PaymentStatusIcon status={job.paymentStatus} className="text-xs" />
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 text-sm truncate">{job.data.jobTitle || 'Bez Nazwy'}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{job.friendlyId}</span>
                                          <span className="flex items-center gap-1 truncate max-w-[250px]">
                                            <MapPin className="w-3 h-3 text-orange-500" /> 
                                            {job.data.address}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Payment Status Badge */}
                                      {job.paymentStatus && job.paymentStatus !== PaymentStatus.NONE && (
                                        <PaymentStatusBadge 
                                          status={job.paymentStatus} 
                                          amount={job.totalGross}
                                          paidAmount={job.paidAmount}
                                          size="sm"
                                          showAmount
                                        />
                                      )}

                                      {isAdmin && (
                                        <button 
                                          onClick={(e) => handleDelete(job.id, e)} 
                                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
              </div>
            );
          })}

          {filteredJobs.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Box className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Brak zleceń</p>
              <p className="text-sm mt-1">Dodaj nowe zlecenie klikając przycisk powyżej</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

