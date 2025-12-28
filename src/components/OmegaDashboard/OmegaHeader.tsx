import React from 'react';
import { 
  Plus, Radio, RefreshCw, Search, Download, 
  LayoutDashboard, Kanban, StretchHorizontal, 
  ThumbsUp, ThumbsDown 
} from 'lucide-react';
import { Job, JobStatus, PaymentStatus } from '../../types';
import { getPaymentStatusConfig } from '../../constants/paymentStatus';

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
  reviewFilter: 'all' | 'sent' | 'not_sent';
  setReviewFilter: (v: 'all' | 'sent' | 'not_sent') => void;
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
  reviewFilter, setReviewFilter,
  archivePaymentFilter, setArchivePaymentFilter,
  archiveReviewFilter, setArchiveReviewFilter,
  searchQuery, setSearchQuery, viewMode, setViewMode, handleBackup,
  dashVariant, onDashVariantChange
}) => {
  const paymentStatuses = [
    'ALL',
    PaymentStatus.PROFORMA,
    PaymentStatus.PAID,
    PaymentStatus.CASH,
    PaymentStatus.OVERDUE,
    PaymentStatus.PARTIAL,
    PaymentStatus.NONE
  ] as const;

  return (
    <div className="flex flex-col gap-4 mb-6 mt-11">
      {/* Row 1: Tabs + Right Side Actions */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="theme-surface flex p-1 shadow-sm" style={{ borderRadius: 'var(--radius-lg)' }}>
            <button 
              onClick={() => { setActiveTab('ACTIVE'); localStorage.setItem('dashboard_active_tab', 'ACTIVE'); }}
              className={`px-4 py-2 text-sm font-bold transition-all ${activeTab === 'ACTIVE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              AKTYWNE ({jobs.filter(j => j.status !== JobStatus.ARCHIVED).length})
            </button>
            <button 
              onClick={() => { setActiveTab('ARCHIVED'); localStorage.setItem('dashboard_active_tab', 'ARCHIVED'); }}
              className={`px-4 py-2 text-sm font-bold transition-all ${activeTab === 'ARCHIVED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              ARCHIWUM
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setLiveRefresh(!liveRefresh)} className={`px-3 py-2 font-bold flex items-center gap-2 transition-all rounded-lg ${liveRefresh ? 'bg-green-500 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`} title={liveRefresh ? 'Wyłącz live odświeżanie' : 'Włącz live odświeżanie'}>
            <Radio className={`w-4 h-4 ${liveRefresh ? 'fill-white' : ''}`} />
            <span className="hidden sm:inline text-xs">LIVE</span>
          </button>
          <button onClick={() => loadJobs()} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 transition-all rounded-lg border border-slate-300 shadow-sm"><span className="hidden sm:inline text-xs">ODŚWIEŻ</span><RefreshCw className="w-4 h-4" /></button>
          {isAdmin && <button onClick={handleBackup} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center gap-2 transition-all rounded-lg shadow-sm" title="Pobierz backup danych"><Download className="w-4 h-4" /><span className="hidden lg:inline text-xs">BACKUP</span></button>}
          <button 
            onClick={onCreateNew} 
            className="px-3 sm:px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center gap-2 transition-all active:scale-95 rounded-lg shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">NOWE ZLECENIE</span>
          </button>
        </div>
      </div>

      {/* Row 2: Payment & Review Filters (Chips Style) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Płatność:</span>
            <div className="flex flex-wrap gap-2">
              {paymentStatuses.map(f => {
                const isActive = activeTab === 'ACTIVE' ? paymentFilter === f : archivePaymentFilter === (f === 'ALL' ? 'all' : f);
                const cfg = f === 'ALL' ? null : getPaymentStatusConfig(f);
                
                // Styles for active chips
                let activeStyle = {};
                if (isActive) {
                  if (f === 'ALL') activeStyle = { background: '#2563eb', color: '#fff' };
                  else activeStyle = { background: cfg?.color, color: '#fff' };
                }

                return (
                  <button
                    key={f}
                    onClick={() => {
                      if (activeTab === 'ACTIVE') setPaymentFilter(f);
                      else setArchivePaymentFilter(f === 'ALL' ? 'all' : (f as PaymentStatus));
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                      isActive 
                        ? 'shadow-sm scale-105 border-transparent' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                    style={isActive ? activeStyle : { 
                      color: !isActive && f !== 'ALL' ? cfg?.color : undefined,
                      borderColor: !isActive && f !== 'ALL' ? `${cfg?.color}44` : undefined 
                    }}
                  >
                    {f === 'ALL' ? 'Wszystkie' : cfg?.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Opinia Google:</span>
            <div className="flex flex-wrap gap-2">
              {(['all', 'sent', 'not_sent'] as const).map(f => {
                const isActive = activeTab === 'ACTIVE' ? reviewFilter === f : archiveReviewFilter === f;
                const colors = {
                  all: { bg: '#2563eb', text: '#2563eb' },
                  sent: { bg: '#22c55e', text: '#22c55e' },
                  not_sent: { bg: '#ef4444', text: '#ef4444' }
                };

                return (
                  <button
                    key={f}
                    onClick={() => {
                      if (activeTab === 'ACTIVE') setReviewFilter(f);
                      else setArchiveReviewFilter(f);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                      isActive ? 'text-white shadow-sm scale-105 border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                    style={{
                      background: isActive ? colors[f].bg : 'transparent',
                      color: !isActive ? colors[f].text : '#fff',
                      borderColor: !isActive ? `${colors[f].text}44` : 'transparent'
                    }}
                  >
                    {f === 'all' ? 'Wszystkie' : (f === 'sent' ? 'Wysłana' : 'Nie wysłana')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Search + View Modes */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj zlecenia..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={() => setViewMode('BOARD')} className={`p-2 rounded-lg transition-all ${viewMode === 'BOARD' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Widok tablicy"><LayoutDashboard size={18} /></button>
          <button onClick={() => setViewMode('KANBAN')} className={`p-2 rounded-lg transition-all ${viewMode === 'KANBAN' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Widok Kanban"><Kanban size={18} /></button>
          <button onClick={() => setViewMode('MIXED')} className={`p-2 rounded-lg transition-all ${viewMode === 'MIXED' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Widok mieszany"><StretchHorizontal size={18} /></button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => loadJobs()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm" title="Odśwież"><RefreshCw size={18} /></button>
          <button onClick={handleBackup} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm" title="Backup"><Download size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default OmegaHeader;

