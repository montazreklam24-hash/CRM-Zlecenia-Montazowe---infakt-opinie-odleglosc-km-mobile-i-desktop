import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, Send, Download, Check, 
  Receipt, Loader2, ExternalLink, CreditCard, Banknote,
  AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Invoice, InvoiceItem, PaymentStatus } from '../types';

interface InvoiceModuleProps {
  jobId: string;
  clientId?: number;
  clientName?: string;
  clientEmail?: string;
  address?: string;
  phone?: string;
  paymentStatus?: PaymentStatus;
  totalGross?: number;
  paidAmount?: number;
  invoices?: Invoice[];
  isAdmin: boolean;
  onStatusChange?: (status: PaymentStatus) => void;
}

// Domyślne pozycje dla montażu reklam
const PRESET_ITEMS: Partial<InvoiceItem>[] = [
  { name: 'Montaż kasetonu reklamowego', unit: 'szt.', unitPriceNet: 500, vatRate: 23 },
  { name: 'Montaż szyldu/tablicy', unit: 'szt.', unitPriceNet: 300, vatRate: 23 },
  { name: 'Montaż banneru', unit: 'm²', unitPriceNet: 50, vatRate: 23 },
  { name: 'Oklejanie folią', unit: 'm²', unitPriceNet: 120, vatRate: 23 },
  { name: 'Montaż liter 3D', unit: 'szt.', unitPriceNet: 80, vatRate: 23 },
  { name: 'Usługa transportowa', unit: 'km', unitPriceNet: 3, vatRate: 23 },
  { name: 'Dojazd', unit: 'szt.', unitPriceNet: 150, vatRate: 23 },
];

const InvoiceModule: React.FC<InvoiceModuleProps> = ({
  jobId,
  clientId,
  clientName,
  clientEmail,
  address,
  phone,
  paymentStatus = PaymentStatus.NONE,
  totalGross = 0,
  paidAmount = 0,
  invoices = [],
  isAdmin,
  onStatusChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'proforma' | 'invoice'>('proforma');
  const [description, setDescription] = useState('');

  // Oblicz sumy
  const calculateTotals = () => {
    let totalNet = 0;
    let totalGross = 0;
    
    items.forEach(item => {
      const itemNet = item.quantity * item.unitPriceNet;
      const itemGross = itemNet * (1 + item.vatRate / 100);
      totalNet += itemNet;
      totalGross += itemGross;
    });
    
    return { totalNet, totalGross, totalVat: totalGross - totalNet };
  };

  const { totalNet, totalGross: calculatedGross, totalVat } = calculateTotals();

  // Dodaj pozycję
  const addItem = (preset?: Partial<InvoiceItem>) => {
    const newItem: InvoiceItem = {
      name: preset?.name || '',
      quantity: 1,
      unit: preset?.unit || 'szt.',
      unitPriceNet: preset?.unitPriceNet || 0,
      vatRate: preset?.vatRate || 23
    };
    setItems([...items, newItem]);
    setShowPresets(false);
  };

  // Aktualizuj pozycję
  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Usuń pozycję
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Wystaw dokument
  const handleCreateInvoice = async () => {
    if (items.length === 0) {
      alert('Dodaj przynajmniej jedną pozycję');
      return;
    }

    if (!clientId && !clientName) {
      alert('Brak danych klienta. Uzupełnij dane kontaktowe zlecenia.');
      return;
    }

    setIsLoading(true);
    
    try {
      // TODO: Wywołaj API /api/invoices
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          jobId,
          clientId,
          type: invoiceType,
          items,
          description,
          installAddress: address,
          phone,
          sendToInfakt: true
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`${invoiceType === 'proforma' ? 'Proforma' : 'Faktura'} została wystawiona!`);
        setItems([]);
        if (onStatusChange) {
          onStatusChange(invoiceType === 'proforma' ? PaymentStatus.PROFORMA : PaymentStatus.INVOICE);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      alert('Błąd: ' + (error.message || 'Nie udało się wystawić dokumentu'));
    } finally {
      setIsLoading(false);
    }
  };

  // Oznacz jako gotówka
  const handleMarkAsCash = () => {
    if (onStatusChange) {
      onStatusChange(PaymentStatus.CASH);
    }
  };

  // Status badge
  const getStatusBadge = () => {
    const badges: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
      [PaymentStatus.NONE]: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Brak dokumentu' },
      [PaymentStatus.PROFORMA]: { bg: 'bg-orange-100', text: 'text-orange-700', label: '📄 Proforma' },
      [PaymentStatus.INVOICE]: { bg: 'bg-blue-100', text: 'text-blue-700', label: '📋 Faktura' },
      [PaymentStatus.PARTIAL]: { bg: 'bg-purple-100', text: 'text-purple-700', label: '💸 Zaliczka' },
      [PaymentStatus.PAID]: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Opłacone' },
      [PaymentStatus.CASH]: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '💵 Gotówka' },
      [PaymentStatus.OVERDUE]: { bg: 'bg-red-100', text: 'text-red-700', label: '⚠️ Przeterminowane' }
    };
    return badges[paymentStatus] || badges[PaymentStatus.NONE];
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
              {totalGross > 0 && (
                <span className="text-sm text-slate-500">
                  {paidAmount > 0 ? `${paidAmount.toFixed(2)} / ` : ''}{totalGross.toFixed(2)} zł
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          
          {/* Istniejące faktury */}
          {invoices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase">Wystawione dokumenty</h4>
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${inv.type === 'proforma' ? 'text-orange-500' : 'text-blue-500'}`} />
                    <div>
                      <p className="font-semibold text-sm">{inv.number || inv.infaktNumber}</p>
                      <p className="text-xs text-slate-500">
                        {inv.totalGross.toFixed(2)} zł • {inv.paymentStatus === 'paid' ? '✅ Opłacona' : 'Oczekuje'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {inv.infaktLink && (
                      <a 
                        href={inv.infaktLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 text-slate-600"
                        title="Otwórz w inFakt"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button 
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 text-slate-600"
                      title="Pobierz PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {inv.paymentStatus !== 'paid' && clientEmail && (
                      <button 
                        className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                        title="Wyślij email"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nowa faktura - tylko dla admina */}
          {isAdmin && (
            <>
              {/* Typ dokumentu */}
              <div className="flex gap-2">
                <button
                  onClick={() => setInvoiceType('proforma')}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                    invoiceType === 'proforma'
                      ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  📄 Proforma
                </button>
                <button
                  onClick={() => setInvoiceType('invoice')}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                    invoiceType === 'invoice'
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  📋 Faktura VAT
                </button>
                <button
                  onClick={handleMarkAsCash}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                    paymentStatus === PaymentStatus.CASH
                      ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  💵 Gotówka
                </button>
              </div>

              {/* Pozycje */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Pozycje</h4>
                  <div className="relative">
                    <button
                      onClick={() => setShowPresets(!showPresets)}
                      className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="w-4 h-4" /> Dodaj pozycję
                    </button>
                    
                    {/* Dropdown z presetami */}
                    {showPresets && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-10 p-2 space-y-1">
                        {PRESET_ITEMS.map((preset, i) => (
                          <button
                            key={i}
                            onClick={() => addItem(preset)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
                          >
                            <span className="font-medium">{preset.name}</span>
                            <span className="text-slate-400 ml-2">
                              ({preset.unitPriceNet} zł/{preset.unit})
                            </span>
                          </button>
                        ))}
                        <hr className="my-2" />
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
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                            placeholder="Nazwa usługi..."
                          />
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">Ilość</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                              min="0"
                              step="0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">Jedn.</label>
                            <select
                              value={item.unit}
                              onChange={(e) => updateItem(index, 'unit', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                            >
                              <option value="szt.">szt.</option>
                              <option value="m²">m²</option>
                              <option value="mb">mb</option>
                              <option value="km">km</option>
                              <option value="godz.">godz.</option>
                              <option value="kpl.">kpl.</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">Cena netto</label>
                            <input
                              type="number"
                              value={item.unitPriceNet}
                              onChange={(e) => updateItem(index, 'unitPriceNet', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                              min="0"
                              step="10"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">VAT</label>
                            <select
                              value={item.vatRate}
                              onChange={(e) => updateItem(index, 'vatRate', parseInt(e.target.value))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                            >
                              <option value="23">23%</option>
                              <option value="8">8%</option>
                              <option value="5">5%</option>
                              <option value="0">0%</option>
                              <option value="-1">zw.</option>
                            </select>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-slate-400">Wartość: </span>
                          <span className="font-bold text-slate-700">
                            {(item.quantity * item.unitPriceNet * (1 + item.vatRate / 100)).toFixed(2)} zł brutto
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Podsumowanie */}
              {items.length > 0 && (
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
                    <span className="font-black text-indigo-600">{calculatedGross.toFixed(2)} zł</span>
                  </div>
                </div>
              )}

              {/* Opis */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Opis (opcjonalnie)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  rows={2}
                  placeholder="Dodatkowe informacje na fakturze..."
                />
              </div>

              {/* Przycisk wystawienia */}
              {items.length > 0 && (
                <button
                  onClick={handleCreateInvoice}
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                    invoiceType === 'proforma'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                  } disabled:opacity-50`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Wystaw {invoiceType === 'proforma' ? 'Proformę' : 'Fakturę VAT'}
                    </>
                  )}
                </button>
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









