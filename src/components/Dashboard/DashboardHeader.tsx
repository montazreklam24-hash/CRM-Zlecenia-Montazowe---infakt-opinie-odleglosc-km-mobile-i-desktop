import React from 'react';
import { 
  Plus, Radio, RefreshCw, Search, Download, 
  LayoutDashboard, Kanban, StretchHorizontal, 
  ThumbsUp, ThumbsDown 
} from 'lucide-react';
import { JobStatus, PaymentStatus } from '../../types';

interface DashboardHeaderProps {
  activeTab: 'ACTIVE' | 'ARCHIVED';
  setActiveTab: (tab: 'ACTIVE' | 'ARCHIVED') => void;
  activeJobsCount: number;
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
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  setActiveTab,
  activeJobsCount,
  liveRefresh,
  setLiveRefresh,
  loadJobs,
  isAdmin,
  onCreateNew,
  paymentFilter,
  setPaymentFilter,
  archivePaymentFilter,
  setArchivePaymentFilter,
  archiveReviewFilter,
  setArchiveReviewFilter,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  handleBackup
}) => {
  return (
    <div className="flex flex-col gap-3 mb-4 mt-11">
      {/* Row 1: Tabs + New button */}
      <div className="flex justify-between items-center gap-2">
        <div className="theme-surface flex p-1 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
          <button 
            onClick={() => setActiveTab('ACTIVE')}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all"
            style={{ 
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'ACTIVE' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'ACTIVE' ? 'var(--text-inverse)' : 'var(--text-secondary)'
            }}
          >
            AKTYWNE ({activeJobsCount})
          </button>
          <button 
            onClick={() => setActiveTab('ARCHIVED')}
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
            <span className="hidden sm:inline text-xs">Odśwież</span>
          </button>

          {isAdmin && (
            <button 
              onClick={onCreateNew}
              className="px-3 sm:px-5 py-2.5 font-bold flex items-center gap-2 transition-all active:scale-95 flex-shrink-0"
              style={{ 
                background: 'var(--accent-orange)', 
                color: 'var(--text-inverse)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <Plus className="w-5 h-5" /> 
              <span className="hidden sm:inline">NOWE ZLECENIE</span>
            </button>
          )}
        </div>
      </div>

      {/* Payment Filters - Chips dla aktywnego widoku */}
      {activeTab === 'ACTIVE' && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Płatność:</span>
          <button
            onClick={() => setPaymentFilter('ALL')}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              paymentFilter === 'ALL'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => setPaymentFilter(PaymentStatus.PROFORMA)}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              paymentFilter === PaymentStatus.PROFORMA
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            }`}
          >
            Proforma
          </button>
          <button
            onClick={() => setPaymentFilter(PaymentStatus.PAID)}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              paymentFilter === PaymentStatus.PAID
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            Opłacone
          </button>
          <button
            onClick={() => setPaymentFilter(PaymentStatus.CASH)}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              paymentFilter === PaymentStatus.CASH
                ? 'bg-yellow-500 text-white shadow-md'
                : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
            }`}
          >
            Gotówka
          </button>
          <button
            onClick={() => setPaymentFilter(PaymentStatus.OVERDUE)}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              paymentFilter === PaymentStatus.OVERDUE
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Przeterminowane
          </button>
          <button
            onClick={() => setPaymentFilter(PaymentStatus.PARTIAL)}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              paymentFilter === PaymentStatus.PARTIAL
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          >
            Częściowe
          </button>
        </div>
      )}

      {/* Archive Filters - Chips nad paskiem wyszukiwania */}
      {activeTab === 'ARCHIVED' && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {/* Payment Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Płatność:</span>
            <button
              onClick={() => setArchivePaymentFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archivePaymentFilter === 'all'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setArchivePaymentFilter(PaymentStatus.PROFORMA)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archivePaymentFilter === PaymentStatus.PROFORMA
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
              }`}
            >
              Proforma
            </button>
            <button
              onClick={() => setArchivePaymentFilter(PaymentStatus.PAID)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archivePaymentFilter === PaymentStatus.PAID
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              Opłacone
            </button>
            <button
              onClick={() => setArchivePaymentFilter(PaymentStatus.PARTIAL)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archivePaymentFilter === PaymentStatus.PARTIAL
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
            >
              Zaliczka
            </button>
            <button
              onClick={() => setArchivePaymentFilter(PaymentStatus.CASH)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archivePaymentFilter === PaymentStatus.CASH
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
              }`}
            >
              Gotówka
            </button>
            <button
              onClick={() => setArchivePaymentFilter(PaymentStatus.OVERDUE)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archivePaymentFilter === PaymentStatus.OVERDUE
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              Przeterminowane
            </button>
          </div>
          
          {/* Review Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold ml-2" style={{ color: 'var(--text-secondary)' }}>Opinia:</span>
            <button
              onClick={() => setArchiveReviewFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
                archiveReviewFilter === 'all'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setArchiveReviewFilter('sent')}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1 ${
                archiveReviewFilter === 'sent'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              <ThumbsUp className="w-3 h-3" /> Wystawiona
            </button>
            <button
              onClick={() => setArchiveReviewFilter('not_sent')}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1 ${
                archiveReviewFilter === 'not_sent'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <ThumbsDown className="w-3 h-3" /> Nie wystawiona
            </button>
          </div>
        </div>
      )}

      {/* Row 2: Search & Actions */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Szukaj..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="theme-input pl-10 pr-3 py-2 text-sm w-full"
          />
        </div>
        
        {/* Refresh button moved to Row 1 but keeping a copy here if needed or removing */}
        <button 
          onClick={() => loadJobs()}
          className="theme-card p-2.5 transition-all"
          style={{ borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}
          title="Odśwież"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        {isAdmin && (
          <button 
            onClick={handleBackup} 
            className="theme-card p-2.5" 
            style={{ borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}
            title="Pobierz Kopię Zapasową"
          >
            <Download className="w-5 h-5" />
          </button>
        )}

        {/* View toggle - 3 widoki */}
        <div className="theme-surface flex p-1 flex-shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
          <button 
            onClick={() => setViewMode('MIXED')} 
            className="p-2 transition-all"
            style={{ 
              borderRadius: 'var(--radius-md)',
              background: viewMode === 'MIXED' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'MIXED' ? 'var(--accent-primary)' : 'var(--text-muted)'
            }}
            title="Widok mieszany (PRZYGOT. + PN-PT + MAPA + WYKONANE)"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('KANBAN')} 
            className="p-2 transition-all"
            style={{ 
              borderRadius: 'var(--radius-md)',
              background: viewMode === 'KANBAN' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'KANBAN' ? 'var(--accent-primary)' : 'var(--text-muted)'
            }}
            title="Kolumny pionowe (7 kolumn)"
          >
            <Kanban className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('BOARD')} 
            className="p-2 transition-all"
            style={{ 
              borderRadius: 'var(--radius-md)',
              background: viewMode === 'BOARD' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'BOARD' ? 'var(--accent-primary)' : 'var(--text-muted)'
            }}
            title="Wiersze poziome (7 wierszy)"
          >
            <StretchHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

