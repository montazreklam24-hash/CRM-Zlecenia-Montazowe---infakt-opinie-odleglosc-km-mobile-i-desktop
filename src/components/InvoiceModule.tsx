import React, { useState, useEffect } from 'react';
import { PaymentStatus, Invoice } from '../types';
import { Plus, Trash2, FileText, Send, Download, ExternalLink, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import invoiceService, { InvoiceItemData } from '../services/invoiceService';

interface InvoiceModuleProps {
  jobId?: string;
  clientId?: number;
  clientName?: string;
  clientEmail?: string;
  installAddress?: string;
  phone?: string;
  nip?: string;
  paymentStatus?: PaymentStatus;
  totalGross?: number;
  paidAmount?: number;
  invoices?: Invoice[];
  isAdmin?: boolean;
  onStatusChange?: (status: PaymentStatus) => Promise<void>;
  onClientDataChange?: (billingData: any) => void;
}

const InvoiceModule: React.FC<InvoiceModuleProps> = ({
  jobId = '',
  clientName,
  clientEmail,
  installAddress,
  phone,
  nip,
  paymentStatus,
  invoices: initialInvoices = [],
  isAdmin = true,
  onStatusChange,
  onClientDataChange
}) => {
  const [items, setItems] = useState<InvoiceItemData[]>([
    { name: 'Usługa montażowa', quantity: 1, unitPriceNet: 0, vatRate: 23 }
  ]);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Sync invoices if they change from props
  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  if (!isAdmin) return null;

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unitPriceNet: 0, vatRate: 23 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof InvoiceItemData, value: any) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    setItems(newItems);
  };

  const calculateTotals = () => {
    const net = items.reduce((sum, item) => sum + (item.quantity * (item.unitPriceNet || 0)), 0);
    const gross = items.reduce((sum, item) => sum + (item.quantity * (item.unitPriceNet || 0) * (1 + (item.vatRate || 0) / 100)), 0);
    return { net, gross };
  };

  const { net: totalNet, gross: totalGrossCalc } = calculateTotals();

  const handleCreateProforma = async () => {
    if (!clientName) return alert('Brak nazwy klienta!');
    if (items.some(i => !i.name || i.unitPriceNet <= 0)) {
      if (!window.confirm('Niektóre pozycje mają zerową cenę lub brak nazwy. Kontynuować?')) return;
    }

    setIsProcessing(true);
    try {
      const res = await invoiceService.createProforma(jobId, items, {
        companyName: clientName,
        email: clientEmail,
        nip,
        phone,
        street: installAddress
      }, {
        installAddress,
        sendEmail: true
      });
      
      if (res.success && res.invoice) {
        alert('Proforma wystawiona i wysłana!');
        const updated = await invoiceService.getJobInvoices(jobId);
        setInvoices(updated.invoices);
        setShowForm(false);
        if (onStatusChange) await onStatusChange(PaymentStatus.PROFORMA);
      }
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!clientName) return alert('Brak nazwy klienta!');
    setIsProcessing(true);
    try {
      const res = await invoiceService.createInvoice(jobId, items, {
        companyName: clientName,
        email: clientEmail,
        nip,
        phone,
        street: installAddress
      }, {
        installAddress,
        sendEmail: true,
        markAsPaid: false
      });
      
      if (res.success && res.invoice) {
        alert('Faktura VAT wystawiona i wysłana!');
        const updated = await invoiceService.getJobInvoices(jobId);
        setInvoices(updated.invoices);
        setShowForm(false);
      }
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPaid = async (invId: number) => {
    if (!window.confirm('Oznaczyć tę fakturę jako opłaconą?')) return;
    setIsProcessing(true);
    try {
      await invoiceService.markAsPaid(invId);
      const updated = await invoiceService.getJobInvoices(jobId);
      setInvoices(updated.invoices);
      if (onStatusChange) await onStatusChange(PaymentStatus.PAID);
      alert('Oznaczono jako opłacone!');
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-slate-800 uppercase tracking-tight">Fakturowanie (inFakt)</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
            paymentStatus === PaymentStatus.PAID ? 'bg-green-100 text-green-700 border border-green-200' :
            paymentStatus === PaymentStatus.PROFORMA ? 'bg-orange-100 text-orange-700 border border-orange-200' :
            'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            {paymentStatus === PaymentStatus.PAID ? 'OPŁACONE' :
             paymentStatus === PaymentStatus.PROFORMA ? 'PROFORMA' :
             'NIEOPŁACONE'}
          </span>
          <button 
            onClick={() => setShowForm(!showForm)}
            className={`p-2 rounded-lg transition-all border ${
              showForm ? 'bg-red-50 border-red-200 text-red-600' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
            }`}
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Lista wystawionych faktur */}
        {invoices.length > 0 && (
          <div className="space-y-3 mb-6">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-200 transition-all group shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${inv.type === 'proforma' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{inv.infakt_number || `#${inv.id}`}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                      {inv.type === 'proforma' ? 'Proforma' : 'Faktura VAT'} • {new Date(inv.created_at || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {inv.status !== 'paid' && (
                    <button 
                      onClick={() => handleMarkPaid(inv.id)}
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                      title="Oznacz jako opłacone"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  )}
                  <a 
                    href={invoiceService.getPdfUrl(inv.id)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Pobierz PDF"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  {inv.share_link && (
                    <a 
                      href={inv.share_link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Otwórz w inFakt"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!showForm && invoices.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl mb-4">
            <p className="text-sm text-slate-400 font-medium">Brak wystawionych dokumentów.</p>
            <button 
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs font-black text-blue-600 hover:text-blue-700 px-6 py-2.5 bg-blue-50 rounded-xl transition-all border border-blue-100 uppercase tracking-widest"
            >
              + Wystaw dokument
            </button>
          </div>
        )}

        {/* Formularz nowej faktury */}
        {showForm && (
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Nowy dokument</h4>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3 mb-6">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
                  <div className="flex-1 min-w-[200px]">
                    <input 
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="Nazwa usługi..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="w-16">
                    <input 
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-center focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="w-28">
                    <input 
                      type="number"
                      value={item.unitPriceNet}
                      onChange={(e) => updateItem(idx, 'unitPriceNet', parseFloat(e.target.value))}
                      placeholder="Netto"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-right focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="w-20">
                    <select
                      value={item.vatRate}
                      onChange={(e) => updateItem(idx, 'vatRate', parseInt(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:border-blue-400 outline-none"
                    >
                      <option value="23">23%</option>
                      <option value="8">8%</option>
                      <option value="5">5%</option>
                      <option value="0">0%</option>
                      <option value="-1">zw</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => removeItem(idx)} 
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    disabled={items.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={addItem}
                className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-wider hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-blue-100"
              >
                <Plus className="w-3 h-3" /> Dodaj pozycję
              </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end border-t border-slate-200 pt-4 mb-6 gap-4">
              <div className="text-[10px] text-slate-400 font-bold uppercase space-y-1 w-full sm:w-auto text-center sm:text-left">
                <p>Razem Netto: <span className="text-slate-600">{totalNet.toFixed(2)} zł</span></p>
                <p className="text-sm text-slate-800">Razem Brutto: <span className="font-black text-blue-600">{totalGrossCalc.toFixed(2)} zł</span></p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={handleCreateProforma}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-none px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  PROFORMA
                </button>
                <button 
                  onClick={handleCreateInvoice}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  FAKTURA VAT
                </button>
              </div>
            </div>

            {(!clientName || !clientEmail) && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-[10px] font-bold uppercase leading-tight">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>Brak pełnych danych klienta (nazwa, email). Dokumenty mogą zostać wystawione błędnie w inFakt.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceModule;
