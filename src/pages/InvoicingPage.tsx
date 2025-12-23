import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Loader2, CheckCircle2, Search, Filter, ArrowUpRight } from 'lucide-react';
import invoiceService from '../services/invoiceService';
import { Invoice } from '../types';

const InvoicingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setTypeFilter] = useState<'all' | 'proforma' | 'vat'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [filterType]);

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

  const proformas = filteredInvoices.filter(inv => inv.type === 'proforma');
  const vatInvoices = filteredInvoices.filter(inv => inv.type === 'invoice');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Fakturowanie</h1>
          <p className="text-slate-500 text-sm">Zarządzaj proformami i fakturami VAT z inFakt</p>
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
          
          <select 
            value={filterType}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none shadow-sm"
          >
            <option value="all">Wszystkie typy</option>
            <option value="proforma">Tylko Proformy</option>
            <option value="vat">Tylko Faktury VAT</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Pobieram dokumenty...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PROFORMY */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                <h2 className="font-black text-slate-800 uppercase tracking-wider">Proformy ({proformas.length})</h2>
              </div>
            </div>
            
            <div className="space-y-3">
              {proformas.length > 0 ? proformas.map(inv => (
                <InvoiceCard key={inv.id} inv={inv} onMarkPaid={handleMarkPaid} />
              )) : (
                <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-sm">
                  Brak proform pasujących do filtrów.
                </div>
              )}
            </div>
          </section>

          {/* FAKTURY VAT */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                <h2 className="font-black text-slate-800 uppercase tracking-wider">Faktury VAT ({vatInvoices.length})</h2>
              </div>
            </div>
            
            <div className="space-y-3">
              {vatInvoices.length > 0 ? vatInvoices.map(inv => (
                <InvoiceCard key={inv.id} inv={inv} onMarkPaid={handleMarkPaid} />
              )) : (
                <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-sm">
                  Brak faktur VAT pasujących do filtrów.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const InvoiceCard = ({ inv, onMarkPaid }: { inv: any, onMarkPaid: (id: number) => void }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group">
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${inv.type === 'proforma' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
          <FileText size={20} />
        </div>
        <div>
          <h3 className="font-black text-slate-800">{inv.infaktNumber || `#${inv.id}`}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {new Date(inv.createdAt).toLocaleDateString()} • {inv.totalGross.toFixed(2)} zł
          </p>
        </div>
      </div>
      
      <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter border ${
        inv.status === 'paid' 
          ? 'bg-green-50 text-green-600 border-green-100' 
          : 'bg-slate-50 text-slate-500 border-slate-100'
      }`}>
        {inv.status === 'paid' ? 'Opłacona' : 'Oczekuje'}
      </div>
    </div>

    <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100/50">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400 font-bold uppercase tracking-tighter">Zlecenie</span>
        <span className="text-blue-600 font-bold">{inv.jobFriendlyId}</span>
      </div>
      <p className="text-sm font-semibold text-slate-700 truncate">{inv.jobTitle}</p>
    </div>

    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
      {inv.status !== 'paid' && (
        <button 
          onClick={() => onMarkPaid(inv.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black text-green-600 hover:bg-green-50 rounded-lg transition-all uppercase tracking-widest"
        >
          <CheckCircle2 size={14} /> Opłacona
        </button>
      )}
      <a 
        href={invoiceService.getPdfUrl(inv.id)} 
        target="_blank" 
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
        title="Pobierz PDF"
      >
        <Download size={18} />
      </a>
      {inv.shareLink && (
        <a 
          href={inv.shareLink} 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          title="Otwórz w inFakt"
        >
          <ExternalLink size={18} />
        </a>
      )}
      <button 
        onClick={() => {
          // TODO: Nawiguj do zlecenia
          window.location.href = `/?job=${inv.jobId}`;
        }}
        className="flex items-center justify-center gap-1.5 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
        title="Idź do zlecenia"
      >
        <ArrowUpRight size={18} />
      </button>
    </div>
  </div>
);

export default InvoicingPage;

