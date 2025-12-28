import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Loader2, CheckCircle2, Search, Filter, ArrowUpRight, RefreshCw, Users, Database } from 'lucide-react';
import invoiceService from '../services/invoiceService';
import { settingsService } from '../services/apiService';
import { Invoice } from '../types';

const InvoicingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [filterType, setTypeFilter] = useState<'all' | 'proforma' | 'vat'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInvoices();
    fetchLastSync();
    // Automatyczna synchronizacja statusów przy pierwszym załadowaniu
    syncStatus();
  }, [filterType]);

  const fetchLastSync = async () => {
    try {
      const settings = await settingsService.getSettings();
      if (settings.last_infakt_sync) {
        setLastSync(settings.last_infakt_sync);
      }
    } catch (error) {
      console.error('Failed to fetch last sync time:', error);
    }
  };

  const syncStatus = async () => {
    setSyncing(true);
    try {
      const result = await invoiceService.syncStatus();
      if (result.success) {
        // Odśwież listę faktur po synchronizacji
        await fetchInvoices();
        if (result.updated > 0) {
          // alert(`Zsynchronizowano ${result.updated} faktur z inFakt`);
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleFullSync = async () => {
    if (!window.confirm('Czy chcesz uruchomić pełną synchronizację? Spowoduje to aktualizację statusów płatności oraz bazy klientów na podstawie inFakt.')) return;
    
    setFullSyncing(true);
    try {
      const result = await invoiceService.fullSync();
      if (result.success) {
        await fetchInvoices();
        await fetchLastSync();
        alert(result.results.message);
      }
    } catch (error: any) {
      alert('Błąd synchronizacji: ' + error.message);
    } finally {
      setFullSyncing(false);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterType !== 'all') params.type = filterType;
      
      const res = await invoiceService.getAllInvoices(params);
      if (res.success) {
        setInvoices(res.invoices);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (invId: number) => {
    if (!window.confirm('Oznaczyć tę fakturę jako opłaconą?')) return;
    try {
      await invoiceService.markAsPaid(invId);
      fetchInvoices();
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.infaktNumber?.toLowerCase().includes(search.toLowerCase()) ||
    inv.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
    inv.jobFriendlyId?.toLowerCase().includes(search.toLowerCase())
  );

  // Filtruj według wybranego typu widoku
  const displayedInvoices = filterType === 'all' 
    ? filteredInvoices 
    : filteredInvoices.filter(inv => 
        filterType === 'proforma' ? inv.type === 'proforma' : inv.type === 'invoice'
      );

  // Sortowanie: najnowsze na górze
  const sortedInvoices = [...displayedInvoices].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Fakturowanie</h1>
          <p className="text-slate-500 text-sm">Zarządzaj proformami i fakturami VAT z inFakt</p>
          {lastSync && (
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
              Ostatnia pełna synchronizacja: {new Date(lastSync).toLocaleString('pl-PL')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Szukaj numeru, zlecenia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button
            onClick={handleFullSync}
            disabled={fullSyncing || syncing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            title="Pełna synchronizacja faktur i klientów"
          >
            {fullSyncing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Database size={16} />
            )}
            {fullSyncing ? 'Synchronizacja...' : 'Pełna Synchronizacja'}
          </button>
          <button
            onClick={syncStatus}
            disabled={syncing || fullSyncing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Szybkie odświeżenie statusów płatności"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            Odśwież statusy
          </button>
        </div>
      </div>

      {/* Przełącznik widoku Proformy / Faktury VAT */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
          <button
            onClick={() => setTypeFilter('proforma')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              filterType === 'proforma'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Proformy
          </button>
          <button
            onClick={() => setTypeFilter('vat')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              filterType === 'vat'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Faktury VAT
          </button>
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              filterType === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Wszystkie
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Pobieram dokumenty...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Nagłówek listy */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Numer</div>
              <div className="col-span-3">Zlecenie</div>
              <div className="col-span-2">Data</div>
              <div className="col-span-2 text-right">Kwota</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
          </div>

          {/* Lista faktur */}
          <div className="divide-y divide-slate-100">
            {sortedInvoices.length > 0 ? (
              sortedInvoices.map(inv => (
                <InvoiceRow key={inv.id} inv={inv} onMarkPaid={handleMarkPaid} />
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 text-sm">
                Brak dokumentów pasujących do filtrów.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InvoiceRow = ({ inv, onMarkPaid }: { inv: any, onMarkPaid: (id: number) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="hover:bg-slate-50 transition-colors">
      <div 
        className="px-6 py-4 grid grid-cols-12 gap-4 items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Numer */}
        <div className="col-span-3 flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${inv.type === 'proforma' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
            <FileText size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-800">{inv.infaktNumber || `#${inv.id}`}</div>
            <div className="text-xs text-slate-400 uppercase tracking-tighter">
              {inv.type === 'proforma' ? 'Proforma' : 'Faktura VAT'}
            </div>
          </div>
        </div>

        {/* Zlecenie */}
        <div className="col-span-3">
          <div className="text-sm font-semibold text-slate-800 truncate">{inv.jobTitle || '-'}</div>
          <div className="text-xs text-blue-600 font-bold">{inv.jobFriendlyId || '-'}</div>
        </div>

        {/* Data */}
        <div className="col-span-2">
          <div className="text-sm text-slate-600">{new Date(inv.createdAt).toLocaleDateString('pl-PL')}</div>
        </div>

        {/* Kwota */}
        <div className="col-span-2 text-right">
          <div className="font-bold text-slate-800">{inv.totalGross?.toFixed(2) || '0.00'} zł</div>
        </div>

        {/* Status */}
        <div className="col-span-2 text-right">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            inv.status === 'paid' 
              ? 'bg-green-50 text-green-600' 
              : 'bg-slate-100 text-slate-600'
          }`}>
            {inv.status === 'paid' && <CheckCircle2 size={12} />}
            {inv.status === 'paid' ? 'Opłacona' : 'Oczekuje'}
          </div>
        </div>
      </div>

      {/* Rozwinięte szczegóły */}
      {isExpanded && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            {inv.status !== 'paid' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkPaid(inv.id);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 size={16} /> Oznacz jako opłaconą
              </button>
            )}
            <a 
              href={invoiceService.getPdfUrl(inv.id)} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={16} /> Pobierz PDF
            </a>
            {inv.shareLink && (
              <a 
                href={inv.shareLink} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={16} /> Otwórz w inFakt
              </a>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/?job=${inv.jobId}`;
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <ArrowUpRight size={16} /> Idź do zlecenia
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicingPage;

