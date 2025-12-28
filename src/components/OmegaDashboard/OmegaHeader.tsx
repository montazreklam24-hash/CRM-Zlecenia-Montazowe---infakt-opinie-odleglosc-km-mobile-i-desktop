import React from 'react';
import { 
  Plus, Radio, RefreshCw, Search, Download, 
  LayoutDashboard, Kanban, StretchHorizontal, 
  ThumbsUp, ThumbsDown 
} from 'lucide-react';
import { Job, JobStatus, PaymentStatus } from '../../types';

interface OmegaHeaderProps {
  activeTab: 'ACTIVE' | 'ARCHIVED';
  setActiveTab: (tab: 'ACTIVE' | 'ARCHIVED') => void;
  jobs: Job[];
  liveRefresh: boolean;
  setLiveRefresh: (v: boolean) => void;
  loadJobs: () => void;
  isAdmin: boolean;
  onCreateNew: () => void;
  paymentFilter: PaymentStatus | 'ALL';
  setPaymentFilter: (v: PaymentStatus | 'ALL') => void;
  archivePaymentFilter: PaymentStatus | 'all';
  setArchivePaymentFilter: (v: PaymentStatus | 'all') => void;
  archiveReviewFilter: 'all' | 'sent' | 'not_sent';
  setArchiveReviewFilter: (v: 'all' | 'sent' | 'not_sent') => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  viewMode: 'BOARD' | 'KANBAN' | 'MIXED';
  setViewMode: (v: 'BOARD' | 'KANBAN' | 'MIXED') => void;
  handleBackup: () => void;
  dashVariant?: 'legacy' | 'omega';
  onDashVariantChange?: (v: 'legacy' | 'omega') => void;
}

const OmegaHeader: React.FC<OmegaHeaderProps> = ({
  activeTab, setActiveTab, jobs, liveRefresh, setLiveRefresh, loadJobs,
  isAdmin, onCreateNew, paymentFilter, setPaymentFilter,
  archivePaymentFilter, setArchivePaymentFilter,
  archiveReviewFilter, setArchiveReviewFilter,
  searchQuery, setSearchQuery, viewMode, setViewMode, handleBackup,
  dashVariant, onDashVariantChange
}) => {
  return (
    <div className="flex flex-col gap-3 mb-4 mt-11">
      {/* Row 1: Tabs + New button + Variant Switcher */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-4">
          <div className="theme-surface flex p-1 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
            <button 
              onClick={() => {
                setActiveTab('ACTIVE');
                localStorage.setItem('dashboard_active_tab', 'ACTIVE');
              }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: activeTab === 'ACTIVE' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'ACTIVE' ? 'var(--text-inverse)' : 'var(--text-secondary)'
              }}
            >
              AKTYWNE ({jobs.filter(j => j.status !== JobStatus.ARCHIVED).length})
            </button>
            <button 
              onClick={() => {
                setActiveTab('ARCHIVED');
                localStorage.setItem('dashboard_active_tab', 'ARCHIVED');
              }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all"
              style={{ 
                borderRadius: 'var(--radius-md)',
                background: activeTab === 'ARCHIVED' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'ARCHIVED' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              ARCHIWUM
            </button>
          </div>

          {/* Development Variant Switcher */}
          {onDashVariantChange && (
            <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 ml-2">
              <button
                onClick={() => onDashVariantChange('legacy')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded ${
                  dashVariant === 'legacy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Legacy
              </button>
              <button
                onClick={() => onDashVariantChange('omega')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded ${
                  dashVariant === 'omega' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Omega v2
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Live Refresh Toggle */}
          <button
            onClick={() => setLiveRefresh(!liveRefresh)}
            className={`px-3 py-2 font-bold flex items-center gap-2 transition-all rounded-lg ${
              liveRefresh 
                ? 'bg-green-500 text-white shadow-md' 
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            title={liveRefresh ? 'Wyłącz live odświeżanie' : 'Włącz live odświeżanie'}
          >
            <Radio className={`w-4 h-4 ${liveRefresh ? 'fill-white' : ''}`} />
            <span className="hidden sm:inline text-xs">LIVE</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadJobs()}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 transition-all rounded-lg border border-slate-300 shadow-sm"
            title="Odśwież ręcznie"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isAdmin && (
            <button
              onClick={handleBackup}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center gap-2 transition-all rounded-lg shadow-sm"
              title="Pobierz backup danych"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline text-xs">BACKUP</span>
            </button>
          )}

          <button 
            onClick={onCreateNew}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 transition-all rounded-lg shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">NOWE ZLECENIE</span>
          </button>
        </div>
      </div>

      {/* Row 2: Filters & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeTab === 'ACTIVE' ? (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-tight">Płatność:</span>
              {(['ALL', PaymentStatus.NONE, PaymentStatus.PROFORMA, PaymentStatus.PAID, PaymentStatus.CASH] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPaymentFilter(f)}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded transition-all uppercase tracking-tighter ${
                    paymentFilter === f 
                      ? 'bg-blue-600 text-white shadow-sm scale-105' 
                      : 'text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'WSZYSTKIE' : f}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-tight">Płatność:</span>
                {(['all', PaymentStatus.PAID, PaymentStatus.PROFORMA, PaymentStatus.NONE] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setArchivePaymentFilter(f)}
                    className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                      archivePaymentFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f === 'all' ? 'Wszystkie' : f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-tight">Opinia:</span>
                {(['all', 'sent', 'not_sent'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setArchiveReviewFilter(f)}
                    className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                      archiveReviewFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f === 'all' ? 'Wszystkie' : f === 'sent' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg ml-auto sm:ml-0">
            <button
              onClick={() => setViewMode('BOARD')}
              className={`p-1.5 rounded transition-all ${viewMode === 'BOARD' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Widok tablicy"
            >
              <LayoutDashboard size={16} />
            </button>
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`p-1.5 rounded transition-all ${viewMode === 'KANBAN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Widok Kanban"
            >
              <Kanban size={16} />
            </button>
            <button
              onClick={() => setViewMode('MIXED')}
              className={`p-1.5 rounded transition-all ${viewMode === 'MIXED' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Widok mieszany (Lista + Kanban)"
            >
              <StretchHorizontal size={16} />
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj zlecenia..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default OmegaHeader;

