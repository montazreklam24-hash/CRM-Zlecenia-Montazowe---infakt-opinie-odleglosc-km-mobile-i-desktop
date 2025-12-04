import React, { useEffect, useState, useRef } from 'react';
import { Job, JobStatus, UserRole, JobColumnId } from '../types';
import { apiService } from '../services/apiService';
import { Plus, MapPin, CheckCircle2, Trash2, User, Box, LayoutList, Kanban, HardDrive, Download, Copy, Upload, Map as MapIcon, Calendar, Clock, Phone } from 'lucide-react';
import MapBoard from './MapBoard';

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
  gradient: string;
}[] = [
  { id: 'PREPARE', title: 'DO PRZYGOTOWANIA', headerBg: 'bg-slate-700', headerText: 'text-white', dotColor: 'text-slate-700', bodyBg: 'bg-slate-50/50', borderColor: 'border-slate-300', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', gradient: 'from-slate-500 to-slate-700' },
  { id: 'ANYTIME', title: 'DOWOLNY TERMIN', headerBg: 'bg-gray-500', headerText: 'text-white', dotColor: 'text-gray-500', bodyBg: 'bg-gray-50/50', borderColor: 'border-gray-300', badgeBg: 'bg-gray-100', badgeText: 'text-gray-600', gradient: 'from-gray-400 to-gray-600' },
  { id: 'MON', title: 'PONIEDZIAŁEK', headerBg: 'bg-rose-600', headerText: 'text-white', dotColor: 'text-rose-600', bodyBg: 'bg-rose-50/50', borderColor: 'border-rose-200', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700', gradient: 'from-rose-500 to-rose-700' },
  { id: 'TUE', title: 'WTOREK', headerBg: 'bg-emerald-600', headerText: 'text-white', dotColor: 'text-emerald-600', bodyBg: 'bg-emerald-50/50', borderColor: 'border-emerald-200', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700', gradient: 'from-emerald-500 to-emerald-700' },
  { id: 'WED', title: 'ŚRODA', headerBg: 'bg-violet-600', headerText: 'text-white', dotColor: 'text-violet-600', bodyBg: 'bg-violet-50/50', borderColor: 'border-violet-200', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700', gradient: 'from-violet-500 to-violet-700' },
  { id: 'THU', title: 'CZWARTEK', headerBg: 'bg-amber-500', headerText: 'text-amber-900', dotColor: 'text-amber-600', bodyBg: 'bg-amber-50/50', borderColor: 'border-amber-200', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800', gradient: 'from-amber-400 to-amber-600' },
  { id: 'FRI', title: 'PIĄTEK', headerBg: 'bg-blue-600', headerText: 'text-white', dotColor: 'text-blue-600', bodyBg: 'bg-blue-50/50', borderColor: 'border-blue-200', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', gradient: 'from-blue-500 to-blue-700' },
  { id: 'SAT', title: 'SOBOTA', headerBg: 'bg-orange-500', headerText: 'text-white', dotColor: 'text-orange-600', bodyBg: 'bg-orange-50/50', borderColor: 'border-orange-200', badgeBg: 'bg-orange-100', badgeText: 'text-orange-800', gradient: 'from-orange-400 to-orange-600' },
  { id: 'SUN', title: 'NIEDZIELA', headerBg: 'bg-amber-800', headerText: 'text-white', dotColor: 'text-amber-800', bodyBg: 'bg-amber-50/50', borderColor: 'border-amber-300', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800', gradient: 'from-amber-700 to-amber-900' },
  { id: 'COMPLETED', title: 'WYKONANE', headerBg: 'bg-green-700', headerText: 'text-white', dotColor: 'text-green-700', bodyBg: 'bg-green-50/50', borderColor: 'border-green-200', badgeBg: 'bg-green-100', badgeText: 'text-green-800', gradient: 'from-green-600 to-green-800' },
];

const Dashboard: React.FC<DashboardProps> = ({ role, onSelectJob, onCreateNew }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [viewMode, setViewMode] = useState<'LIST' | 'BOARD' | 'MAP'>('BOARD');
  const [storageStats, setStorageStats] = useState({ usedMB: '0', percent: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Błąd ładowania zleceń:', error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Czy na pewno usunąć to zlecenie?')) {
      await apiService.deleteJob(id);
      loadJobs();
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Zduplikować to zlecenie?')) {
      await apiService.duplicateJob(id);
      loadJobs();
    }
  };

  const handleBackup = async () => {
    const json = await apiService.createBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_montaz24_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const json = event.target?.result as string;
      if (window.confirm("UWAGA: Wgranie kopii doda zlecenia do obecnych. Kontynuować?")) {
        await apiService.restoreBackup(json);
        alert("Kopia wgrana pomyślnie!");
        loadJobs();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- DRAG & DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('jobId', jobId);
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: JobColumnId) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('jobId');
    if (!jobId) return;

    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, columnId: targetColumnId } : j));
    await apiService.updateJobColumn(jobId, targetColumnId);
  };

  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'ACTIVE') return job.status !== JobStatus.ARCHIVED;
    return job.status === JobStatus.ARCHIVED;
  });

  const getJobsForColumn = (colId: JobColumnId) => filteredJobs.filter(j => (j.columnId || 'PREPARE') === colId);

  const isAdmin = role === UserRole.ADMIN;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Box className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-200/50">
          <button 
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'ACTIVE' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            AKTYWNE ({jobs.filter(j => j.status !== JobStatus.ARCHIVED).length})
          </button>
          <button 
            onClick={() => setActiveTab('ARCHIVED')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'ARCHIVED' 
                ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-lg' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            ARCHIWUM
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex gap-1.5">
              <button 
                onClick={handleBackup} 
                className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all" 
                title="Pobierz Kopię Zapasową"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-2.5 bg-white border border-gray-200 text-blue-500 rounded-xl hover:bg-blue-50 shadow-sm transition-all" 
                title="Wgraj Kopię Zapasową"
              >
                <Upload className="w-5 h-5" />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleRestoreBackup} className="hidden" accept="application/json" />
            </div>
          )}

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200/50">
            <button 
              onClick={() => setViewMode('BOARD')} 
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'BOARD' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
              title="Kanban"
            >
              <Kanban className="w-5 h-5"/>
            </button>
            <button 
              onClick={() => setViewMode('LIST')} 
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
              title="Lista"
            >
              <LayoutList className="w-5 h-5"/>
            </button>
            <button 
              onClick={() => setViewMode('MAP')} 
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'MAP' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
              title="Mapa"
            >
              <MapIcon className="w-5 h-5"/>
            </button>
          </div>

          {isAdmin && (
            <button 
              onClick={onCreateNew} 
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-95 hover:shadow-orange-500/40"
            >
              <Plus className="w-5 h-5" /> 
              <span className="hidden sm:inline">NOWE ZLECENIE</span>
            </button>
          )}
        </div>
      </div>

      {/* --- MAP VIEW --- */}
      {viewMode === 'MAP' && (
        <MapBoard jobs={filteredJobs} onSelectJob={onSelectJob} onJobsUpdated={loadJobs} />
      )}

      {/* --- KANBAN BOARD VIEW (SWIMLANES) --- */}
      {viewMode === 'BOARD' && (
        <div className="space-y-4">
          {ROWS_CONFIG.map(row => {
            const rowJobs = getJobsForColumn(row.id);
            return (
              <div 
                key={row.id} 
                className={`rounded-2xl border shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm transition-all hover:shadow-md ${row.borderColor}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, row.id)}
              >
                <div className={`bg-gradient-to-r ${row.gradient} ${row.headerText} px-5 py-3 flex justify-between items-center`}>
                  <h3 className="font-bold tracking-wide text-sm flex items-center gap-2">
                    {row.id === 'COMPLETED' && <CheckCircle2 className="w-4 h-4"/>}
                    {row.title}
                  </h3>
                  <span className="bg-white/25 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold">
                    {rowJobs.length}
                  </span>
                </div>

                <div className={`${row.bodyBg} p-4 flex gap-4 overflow-x-auto min-h-[140px] items-start`}>
                  {rowJobs.length === 0 ? (
                    <div className="text-gray-400 text-xs font-medium italic w-full text-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                      Przeciągnij tutaj zlecenie
                    </div>
                  ) : (
                    rowJobs.map(job => (
                      <div 
                        key={job.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectJob(job)}
                        className="min-w-[140px] w-36 bg-white rounded-xl shadow-sm hover:shadow-lg border border-gray-100 cursor-pointer transition-all hover:-translate-y-1 group relative flex flex-col"
                      >
                        {/* Miniatura */}
                        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden rounded-t-xl">
                          {job.projectImages?.[0] ? (
                            <img src={typeof job.projectImages[0] === 'string' ? job.projectImages[0] : (job.projectImages[0] as any).path} className="w-full h-full object-cover" alt="preview" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Box className="w-10 h-10"/>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-[9px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                            {job.friendlyId}
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="p-3 flex-1 flex flex-col">
                          <h4 className="font-bold text-gray-800 text-[11px] line-clamp-2 leading-tight mb-2">
                            {job.data.jobTitle}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-2">
                            <MapPin className="w-3 h-3 text-orange-500" />
                            <span className="truncate">{job.data.address?.split(',')[0] || 'Brak adresu'}</span>
                          </div>
                          
                          {/* Footer */}
                          <div className="flex justify-between items-center border-t border-gray-100 pt-2 mt-auto">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              {job.checklist && job.checklist.length > 0 && (
                                <>
                                  <CheckCircle2 className="w-3 h-3"/>
                                  {job.checklist.filter(i => i.isChecked).length}/{job.checklist.length}
                                </>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => handleDuplicate(job.id, e)} className="text-violet-400 hover:text-violet-600 p-1 hover:bg-violet-50 rounded">
                                  <Copy className="w-3.5 h-3.5"/>
                                </button>
                                <button onClick={(e) => handleDelete(job.id, e)} className="text-gray-300 hover:text-red-500 p-1 hover:bg-red-50 rounded">
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

      {/* --- LIST VIEW --- */}
      {viewMode === 'LIST' && (
        <div className="space-y-6">
          {ROWS_CONFIG.map(row => {
            const rowJobs = getJobsForColumn(row.id);
            if (rowJobs.length === 0) return null;

            return (
              <div key={row.id}>
                {/* Nagłówek */}
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide bg-gradient-to-r ${row.gradient} text-white shadow-sm`}>
                    {row.title}
                    <span className="bg-white/25 px-2 py-0.5 rounded-lg text-[10px]">{rowJobs.length}</span>
                  </span>
                </div>

                {/* List Items */}
                <div className="space-y-2">
                  {rowJobs.map(job => (
                    <div 
                      key={job.id} 
                      onClick={() => onSelectJob(job)} 
                      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md cursor-pointer group flex gap-4 transition-all items-center"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100">
                        {job.projectImages?.[0] ? (
                          <img src={typeof job.projectImages[0] === 'string' ? job.projectImages[0] : (job.projectImages[0] as any).path} className="w-full h-full object-cover" alt="job"/>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Box className="w-7 h-7 text-gray-300"/>
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate">{job.data.jobTitle || 'Bez Nazwy'}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{job.friendlyId}</span>
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-orange-500" /> 
                            {job.data.address || 'Brak adresu'}
                          </span>
                          {job.data.phoneNumber && (
                            <span className="flex items-center gap-1 hidden md:flex">
                              <Phone className="w-3 h-3 text-blue-500" /> 
                              {job.data.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {isAdmin && (
                        <button 
                          onClick={(e) => handleDelete(job.id, e)} 
                          className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
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
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-gray-100 rounded-2xl mb-4">
                <Box className="w-12 h-12 text-gray-300"/>
              </div>
              <p className="text-gray-400 font-medium">Brak zleceń w tym widoku.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
