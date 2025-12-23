import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Trash2, Send, Download, 
  Receipt, Loader2, ExternalLink, 
  ChevronDown, ChevronUp, Edit2, Check, Search
} from 'lucide-react';
import { PaymentStatus, Invoice } from '../types';
import invoiceService, { InvoiceItemData } from '../services/invoiceService';

interface BillingData {
  name?: string;
  nip?: string;
  street?: string;
  buildingNo?: string;
  apartmentNo?: string;
  postCode?: string;
  city?: string;
  email?: string;
}

interface InvoiceModuleProps {
  jobId?: string;
  clientName?: string;
  clientEmail?: string;
  installAddress?: string;
  phone?: string;
  nip?: string;
  paymentStatus?: PaymentStatus;
  invoices?: Invoice[];
  isAdmin?: boolean;
  onStatusChange?: (status: PaymentStatus) => void;
  onClientDataChange?: (data: any) => void;
  billing?: BillingData;
}

// Presety dla montażu reklam
const PRESET_ITEMS: Partial<InvoiceItemData>[] = [
  { name: 'Montaż kasetonu reklamowego', quantity: 1, unitPriceNet: 500, vatRate: 23 },
  { name: 'Montaż szyldu/tablicy', quantity: 1, unitPriceNet: 300, vatRate: 23 },
  { name: 'Montaż banneru', quantity: 1, unitPriceNet: 200, vatRate: 23 },
  { name: 'Oklejanie folią', quantity: 1, unitPriceNet: 120, vatRate: 23 },
  { name: 'Montaż liter 3D', quantity: 1, unitPriceNet: 80, vatRate: 23 },
  { name: 'Usługa transportowa', quantity: 1, unitPriceNet: 150, vatRate: 23 },
  { name: 'Dojazd', quantity: 1, unitPriceNet: 100, vatRate: 23 },
];

const InvoiceModule: React.FC<InvoiceModuleProps> = ({
  jobId = '',
  clientName,
  clientEmail,
  installAddress,
  phone,
  nip,
  paymentStatus = PaymentStatus.NONE,
  invoices: initialInvoices = [],
  isAdmin = true,
  onStatusChange,
  onClientDataChange,
  billing: initialBilling
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [items, setItems] = useState<InvoiceItemData[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  
  // Billing state
  const [billing, setBilling] = useState<BillingData>(() => {
    if (initialBilling && Object.keys(initialBilling).some(k => (initialBilling as any)[k])) {
      return {
        name: initialBilling.name || clientName || '',
        nip: initialBilling.nip || nip || '',
        street: initialBilling.street || '',
        buildingNo: initialBilling.buildingNo || '',
        apartmentNo: initialBilling.apartmentNo || '',
        postCode: initialBilling.postCode || '',
        city: initialBilling.city || '',
        email: initialBilling.email || clientEmail || ''
      };
    }
    return {
      name: clientName || '',
      nip: nip || '',
      street: '',
      buildingNo: '',
      apartmentNo: '',
      postCode: '',
      city: '',
      email: clientEmail || ''
    };
  });

  const lastAutoNip = useRef<string | null>(null);

  // Sync invoices from props
  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  // Sync billing from props
  useEffect(() => {
    if (initialBilling) {
      setBilling(prev => ({
        ...prev,
        name: initialBilling.name || prev.name || clientName || '',
        nip: initialBilling.nip || prev.nip || nip || '',
        street: initialBilling.street || prev.street || '',
        buildingNo: initialBilling.buildingNo || prev.buildingNo || '',
        apartmentNo: initialBilling.apartmentNo || prev.apartmentNo || '',
        postCode: initialBilling.postCode || prev.postCode || '',
        city: initialBilling.city || prev.city || '',
        email: initialBilling.email || prev.email || clientEmail || ''
      }));
    }
  }, [initialBilling, clientName, clientEmail, nip]);

  // Fetch invoices if not provided
  useEffect(() => {
    if (jobId && initialInvoices.length === 0) {
      invoiceService.getJobInvoices(jobId).then(res => {
        if (res.success && res.invoices) {
          setInvoices(res.invoices);
        }
      }).catch(console.error);
    }
  }, [jobId, initialInvoices.length]);

  // Calculate totals
  const calculateTotals = () => {
    let totalNet = 0;
    let totalGross = 0;
    items.forEach(item => {
      const itemNet = item.quantity * item.unitPriceNet;
      const vatMultiplier = item.vatRate >= 0 ? (1 + item.vatRate / 100) : 1;
      totalGross += itemNet * vatMultiplier;
      totalNet += itemNet;
    });
    return { totalNet, totalGross, totalVat: totalGross - totalNet };
  };

  const { totalNet, totalGross, totalVat } = calculateTotals();

  // Add item
  const addItem = (preset?: Partial<InvoiceItemData>) => {
    const newItem: InvoiceItemData = {
      name: preset?.name || '',
      quantity: preset?.quantity || 1,
      unitPriceNet: preset?.unitPriceNet || 0,
      vatRate: preset?.vatRate || 23
    };
    setItems([...items, newItem]);
    setShowPresets(false);
  };

  // Update item
  const updateItem = (index: number, field: keyof InvoiceItemData, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle billing change
  const handleBillingChange = (field: keyof BillingData, value: string) => {
    setBilling(prev => ({ ...prev, [field]: value }));
  };

  // GUS lookup
  const handleGusLookup = async () => {
    const nipStr = billing.nip?.replace(/[^\d]/g, '');
    if (!nipStr || nipStr.length !== 10) {
      alert('Wpisz poprawny NIP (10 cyfr)');
      return;
    }
    
    setIsProcessing(true);
    try {
      const res = await invoiceService.lookupNip(nipStr);
      if (res.success && res.company) {
        const { name, street, city, postCode } = res.company;
        let st = street || '';
        let bNo = '';
        let aNo = '';
        
        const streetMatch = street?.match(/^(.*?)\s(\d+[a-zA-Z]?)(?:\/(\d+))?$/);
        if (streetMatch) {
          st = streetMatch[1];
          bNo = streetMatch[2];
          aNo = streetMatch[3] || '';
        }

        const newBilling = {
          ...billing,
          name: name || billing.name,
          street: st,
          buildingNo: bNo,
          apartmentNo: aNo,
          city: city || '',
          postCode: postCode || ''
        };
        setBilling(newBilling);
        
        if (onClientDataChange) {
          onClientDataChange({
            companyName: name,
            nip: nipStr,
            email: billing.email,
            phone: phone,
            street: st,
            city,
            postCode,
            buildingNo: bNo,
            apartmentNo: aNo
          });
        }
        
        lastAutoNip.current = nipStr;
      } else {
        alert('Nie znaleziono firmy w GUS: ' + (res.error || 'Błąd'));
      }
    } catch (e) {
      alert('Błąd połączenia z GUS');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create invoice
  const handleCreateDocument = async (type: 'proforma' | 'vat') => {
    if (items.length === 0) {
      alert('Dodaj przynajmniej jedną pozycję');
      return;
    }

    if (!billing.name) {
      alert('Uzupełnij nazwę nabywcy (dane do faktury)');
      return;
    }

    setIsProcessing(true);
    try {
      const billingData = {
        name: billing.name,
        nip: billing.nip?.replace(/[^\d]/g, '') || '',
        street: billing.street || '',
        buildingNo: billing.buildingNo || '',
        apartmentNo: billing.apartmentNo || '',
        postCode: billing.postCode || '',
        city: billing.city || '',
        email: billing.email || ''
      };

      let result;
      if (type === 'proforma') {
        result = await invoiceService.createProforma(jobId, items, billingData, installAddress);
      } else {
        result = await invoiceService.createInvoice(jobId, items, billingData, installAddress);
      }

      if (result.success && result.invoice) {
        alert(`${type === 'proforma' ? 'Proforma' : 'Faktura VAT'} została wystawiona!`);
        setInvoices(prev => [result.invoice!, ...prev]);
        setItems([]);
        
        if (onStatusChange) {
          onStatusChange(type === 'proforma' ? PaymentStatus.PROFORMA : PaymentStatus.INVOICE);
        }
      } else {
        throw new Error(result.error || 'Błąd wystawiania dokumentu');
      }
    } catch (error: any) {
      console.error('Create document error:', error);
      alert('Błąd: ' + (error.message || 'Nie udało się wystawić dokumentu'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Mark as paid
  const handleMarkPaid = async (invoiceId: number) => {
    try {
      const result = await invoiceService.markAsPaid(invoiceId);
      if (result.success) {
        setInvoices(prev => prev.map(inv => 
          inv.id === invoiceId ? { ...inv, status: 'paid' } : inv
        ));
        if (onStatusChange) {
          onStatusChange(PaymentStatus.PAID);
        }
      }
    } catch (e) {
      console.error('Mark paid error:', e);
    }
  };

  // Format address for display
  const formatBillingAddress = () => {
    const parts = [];
    if (billing.street) {
      let addr = billing.street;
      if (billing.buildingNo) addr += ' ' + billing.buildingNo;
      if (billing.apartmentNo) addr += '/' + billing.apartmentNo;
      parts.push(addr);
    }
    if (billing.postCode || billing.city) {
      parts.push([billing.postCode, billing.city].filter(Boolean).join(' '));
    }
    return parts.join(', ') || 'Brak adresu';
  };

  // Status badge
  const getStatusLabel = () => {
    if (invoices.some(i => i.status === 'paid')) return { label: 'OPŁACONE', color: 'bg-green-100 text-green-700' };
    if (invoices.some(i => i.type === 'vat' || i.type === 'invoice')) return { label: 'FAKTURA', color: 'bg-blue-100 text-blue-700' };
    if (invoices.some(i => i.type === 'proforma')) return { label: 'PROFORMA', color: 'bg-orange-100 text-orange-700' };
    return { label: 'NIEOPŁACONE', color: 'bg-slate-100 text-slate-600' };
  };

  const status = getStatusLabel();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header - rozwijany */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Fakturowanie</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${status.color}`}>
                {status.label}
              </span>
              {totalGross > 0 && (
                <span className="text-sm text-slate-500 font-semibold">
                  {totalGross.toFixed(2)} zł
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
      </div>

      {/* Rozwinięta zawartość */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          
          {/* Wystawione dokumenty */}
          {invoices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Wystawione dokumenty</h4>
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${inv.type === 'proforma' ? 'text-orange-500' : 'text-blue-500'}`} />
                    <div>
                      <p className="font-bold text-sm text-slate-800">
                        {inv.infaktNumber || inv.infakt_number || `#${inv.id}`}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                        {inv.type === 'proforma' ? 'Proforma' : 'Faktura VAT'} • {inv.status === 'paid' ? '✅ Opłacona' : 'Oczekuje'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {inv.status !== 'paid' && (
                      <button 
                        onClick={() => handleMarkPaid(inv.id)}
                        className="p-2 bg-white rounded-lg border border-slate-200 hover:border-green-300 text-slate-400 hover:text-green-600 transition-colors"
                        title="Oznacz jako opłacone"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <a 
                      href={invoiceService.getPdfUrl(inv.id)} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Pobierz PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {(inv.shareLink || inv.share_link) && (
                      <a 
                        href={inv.shareLink || inv.share_link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Otwórz w inFakt"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dane nabywcy - zawsze widoczne */}
          {isAdmin && (
            <>
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Dane nabywcy do faktury
                  </h4>
                  <button
                    onClick={() => setIsEditingBilling(!isEditingBilling)}
                    className="text-[10px] font-bold px-2 py-1 rounded border transition-colors bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-100"
                  >
                    {isEditingBilling ? 'Zapisz' : 'Edytuj'}
                  </button>
                </div>

                {isEditingBilling ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nazwa firmy / Nabywca</label>
                      <input 
                        value={billing.name || ''} 
                        onChange={(e) => handleBillingChange('name', e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                        placeholder="Nazwa firmy lub imię i nazwisko..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">NIP</label>
                      <div className="flex gap-1 mt-1">
                        <input 
                          value={billing.nip || ''} 
                          onChange={(e) => handleBillingChange('nip', e.target.value)}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                          placeholder="0000000000"
                        />
                        <button
                          type="button"
                          onClick={handleGusLookup}
                          disabled={isProcessing}
                          className="px-3 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black hover:bg-indigo-200 transition-colors uppercase flex items-center gap-1"
                        >
                          <Search className="w-3 h-3" /> GUS
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Email do faktury</label>
                      <input 
                        value={billing.email || ''} 
                        onChange={(e) => handleBillingChange('email', e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                        placeholder="email@firma.pl"
                      />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Ulica</label>
                        <input 
                          value={billing.street || ''} 
                          onChange={(e) => handleBillingChange('street', e.target.value)}
                          className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nr</label>
                        <input 
                          value={billing.buildingNo || ''} 
                          onChange={(e) => handleBillingChange('buildingNo', e.target.value)}
                          className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm text-center focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Lok</label>
                        <input 
                          value={billing.apartmentNo || ''} 
                          onChange={(e) => handleBillingChange('apartmentNo', e.target.value)}
                          className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm text-center focus:border-indigo-400 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Kod pocztowy</label>
                      <input 
                        value={billing.postCode || ''} 
                        onChange={(e) => handleBillingChange('postCode', e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                        placeholder="00-000"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Miasto</label>
                      <input 
                        value={billing.city || ''} 
                        onChange={(e) => handleBillingChange('city', e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-16 flex-shrink-0">Nazwa:</span>
                      <span className="font-semibold text-slate-800">{billing.name || <span className="text-red-400 italic">Brak</span>}</span>
                    </div>
                    {billing.nip && (
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 w-16 flex-shrink-0">NIP:</span>
                        <span className="font-mono text-slate-700">{billing.nip}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-16 flex-shrink-0">Adres:</span>
                      <span className="text-slate-700">{formatBillingAddress()}</span>
                    </div>
                    {billing.email && (
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 w-16 flex-shrink-0">Email:</span>
                        <span className="text-slate-700">{billing.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pozycje faktury */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pozycje dokumentu</h4>
                  <div className="relative">
                    <button
                      onClick={() => setShowPresets(!showPresets)}
                      className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Dodaj pozycję
                    </button>
                    
                    {/* Dropdown z presetami */}
                    {showPresets && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-10 p-2 space-y-1 animate-in fade-in slide-in-from-top-2">
                        {PRESET_ITEMS.map((preset, i) => (
                          <button
                            key={i}
                            onClick={() => addItem(preset)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm transition-colors"
                          >
                            <span className="font-medium text-slate-700">{preset.name}</span>
                            <span className="text-slate-400 ml-2 text-xs">
                              ({preset.unitPriceNet} zł)
                            </span>
                          </button>
                        ))}
                        <hr className="my-2 border-slate-100" />
                        <button
                          onClick={() => addItem()}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 text-sm text-indigo-600 font-medium"
                        >
                          + Pusta pozycja
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista pozycji */}
                {items.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    Kliknij "Dodaj pozycję" aby rozpocząć
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="p-3 bg-slate-50 rounded-xl space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                            placeholder="Nazwa usługi..."
                          />
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold">Ilość</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                              min="0"
                              step="0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold">Cena netto</label>
                            <input
                              type="number"
                              value={item.unitPriceNet}
                              onChange={(e) => updateItem(index, 'unitPriceNet', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                              min="0"
                              step="10"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold">VAT</label>
                            <select
                              value={item.vatRate}
                              onChange={(e) => updateItem(index, 'vatRate', parseInt(e.target.value))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                            >
                              <option value="23">23%</option>
                              <option value="8">8%</option>
                              <option value="5">5%</option>
                              <option value="0">0%</option>
                              <option value="-1">zw.</option>
                            </select>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <span className="text-slate-400">Wartość: </span>
                          <span className="font-bold text-slate-700">
                            {(item.quantity * item.unitPriceNet * (item.vatRate >= 0 ? (1 + item.vatRate / 100) : 1)).toFixed(2)} zł brutto
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Podsumowanie */}
              {items.length > 0 && (
                <>
                  <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Netto:</span>
                      <span className="font-semibold">{totalNet.toFixed(2)} zł</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">VAT:</span>
                      <span className="font-semibold">{totalVat.toFixed(2)} zł</span>
                    </div>
                    <div className="flex justify-between text-lg border-t border-indigo-200 pt-2">
                      <span className="font-bold text-slate-800">Brutto:</span>
                      <span className="font-black text-indigo-600">{totalGross.toFixed(2)} zł</span>
                    </div>
                  </div>

                  {/* Przyciski wystawiania */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCreateDocument('proforma')}
                      disabled={isProcessing}
                      className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Proforma
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleCreateDocument('vat')}
                      disabled={isProcessing}
                      className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <FileText className="w-5 h-5" />
                          Faktura VAT
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Dla nie-adminów - tylko podgląd */}
          {!isAdmin && invoices.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm">
              Brak dokumentów do wyświetlenia
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceModule;
