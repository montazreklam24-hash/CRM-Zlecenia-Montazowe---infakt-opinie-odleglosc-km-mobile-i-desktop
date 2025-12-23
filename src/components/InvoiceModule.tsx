import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, Send, Download, 
  Receipt, Loader2, ExternalLink, Search, Building2,
  AlertTriangle, ChevronDown, ChevronUp, User, Mail, Phone, MapPin,
  AlertCircle, Link as LinkIcon
} from 'lucide-react';
import { Invoice, InvoiceItem, PaymentStatus } from '../types';
import { invoiceService, InvoiceItemData, InvoiceClientData } from '../services/invoiceService';

interface InvoiceModuleProps {
  jobId: string;
  clientId?: number;
  clientName?: string;
  clientEmail?: string;
  installAddress?: string; // Adres MONTAŻU (nie do faktury!)
  phone?: string;
  nip?: string;
  paymentStatus?: PaymentStatus;
  totalGross?: number;
  paidAmount?: number;
  invoices?: Invoice[];
  isAdmin: boolean;
  onStatusChange?: (status: PaymentStatus) => void;
  onClientDataChange?: (data: InvoiceClientData) => void;
  // Opcjonalnie dla kompatybilności wstecznej
  billing?: {
    name?: string;
    nip?: string;
    street?: string;
    buildingNo?: string;
    apartmentNo?: string;
    postCode?: string;
    city?: string;
    email?: string;
  };
}

// Współrzędne Warszawy dla obliczania odległości
const WARSAW_COORDS = { lat: 52.2297, lng: 21.0122 };
const MAX_DISTANCE_KM = 100;

// Domyślne pozycje dla montażu reklam
const PRESET_ITEMS: Partial<InvoiceItem>[] = [
  { name: 'Montaż kasetonu reklamowego', unit: 'szt.', unitPriceNet: 500, vatRate: 23 },
  { name: 'Montaż szyldu/tablicy', unit: 'szt.', unitPriceNet: 300, vatRate: 23 },
  { name: 'Montaż banneru', unit: 'm²', unitPriceNet: 50, vatRate: 23 },
  { name: 'Oklejanie folią', unit: 'm²', unitPriceNet: 120, vatRate: 23 },
  { name: 'Oklejanie witryn - folia OWV', unit: 'm²', unitPriceNet: 180, vatRate: 23 },
  { name: 'Oklejanie witryn - folia mrożona', unit: 'm²', unitPriceNet: 150, vatRate: 23 },
  { name: 'Montaż liter 3D', unit: 'szt.', unitPriceNet: 80, vatRate: 23 },
  { name: 'Dojazd na montaż (do 20km)', unit: 'szt.', unitPriceNet: 350, vatRate: 23 },
  { name: 'Dojazd - dopłata za km', unit: 'km', unitPriceNet: 6, vatRate: 23 },
  { name: 'Pomiar', unit: 'szt.', unitPriceNet: 200, vatRate: 23 },
  { name: 'Pomiar + gruntowanie', unit: 'szt.', unitPriceNet: 500, vatRate: 23 },
];

// Lista miast daleko od Warszawy (ostrzeżenie)
const FAR_CITIES = [
  'gdańsk', 'gdynia', 'sopot', 'katowice', 'kraków', 'wrocław', 'poznań', 
  'łódź', 'szczecin', 'bydgoszcz', 'lublin', 'białystok', 'rzeszów', 
  'olsztyn', 'kielce', 'opole', 'zielona góra', 'gorzów'
];

const InvoiceModule: React.FC<InvoiceModuleProps> = ({
  jobId,
  clientId,
  clientName,
  clientEmail,
  installAddress, // To jest adres MONTAŻU - NIE do faktury!
  phone,
  nip: initialNip,
  paymentStatus = PaymentStatus.NONE,
  totalGross = 0,
  paidAmount = 0,
  invoices = [],
  isAdmin,
  onStatusChange,
  onClientDataChange,
  billing
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'proforma' | 'invoice'>('proforma');
  const [description, setDescription] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [distanceWarning, setDistanceWarning] = useState<string | null>(null);
  
  // Dane do FAKTURY (adres siedziby firmy - z GUS)
  // Mapuj billing na InvoiceClientData jeśli jest przekazany
  const [clientData, setClientData] = useState<InvoiceClientData>(() => {
    if (billing && (billing.name || billing.nip || billing.street)) {
      // Mapuj billing na InvoiceClientData
      let street = billing.street || '';
      if (billing.buildingNo) {
        street += (street ? ' ' : '') + billing.buildingNo;
      }
      if (billing.apartmentNo) {
        street += '/' + billing.apartmentNo;
      }
      return {
        companyName: billing.name || clientName || '',
        nip: billing.nip || initialNip || '',
        email: billing.email || clientEmail || '',
        phone: phone || '',
        street: street,
        city: billing.city || '',
        postCode: billing.postCode || '',
      };
    }
    return {
      companyName: clientName || '',
      nip: initialNip || '',
      email: clientEmail || '',
      phone: phone || '',
      street: '',      // Adres SIEDZIBY firmy (z GUS), NIE adres montażu!
      city: '',
      postCode: '',
    };
  });

  // Sprawdź czy adres montażu nie jest za daleko od Warszawy
  useEffect(() => {
    if (installAddress) {
      const addressLower = installAddress.toLowerCase();
      const isFarCity = FAR_CITIES.some(city => addressLower.includes(city));
      
      if (isFarCity) {
        setDistanceWarning(`⚠️ Adres montażu "${installAddress}" może być ponad ${MAX_DISTANCE_KM}km od Warszawy. Czy na pewno to poprawne zlecenie?`);
      } else {
        setDistanceWarning(null);
      }
    }
  }, [installAddress]);

  // Aktualizuj dane z propsów (ale NIE adres montażu!)
  useEffect(() => {
    setClientData(prev => ({
      ...prev,
      companyName: clientName || prev.companyName,
      email: clientEmail || prev.email,
      phone: phone || prev.phone,
      nip: initialNip || prev.nip,
      // NIE ustawiamy street/city/postCode z installAddress!
      // Te pola pobieramy z GUS po NIP
    }));
  }, [clientName, clientEmail, phone, initialNip]);

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

  // Pobierz dane firmy po NIP (adres SIEDZIBY do faktury)
  const handleNipLookup = async () => {
    const nip = clientData.nip?.replace(/[^0-9]/g, '');
    if (!nip || nip.length !== 10) {
      setLookupError('NIP musi mieć 10 cyfr');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);

    try {
      const result = await invoiceService.lookupNip(nip);
      
      if (result.success && result.company) {
        // WAŻNE: Aktualizuj WSZYSTKIE dane rozliczeniowe z GUS razem!
        const company = result.company!;
        const source = (result as any).source || 'GUS'; // KRS, CEIDG lub MF
        
        // Sprawdź czy nazwa nie jest pusta
        if (!company.name || company.name.trim() === '') {
          setLookupError(`Znaleziono firmę w ${source}, ale brak nazwy. Sprawdź dane ręcznie.`);
          return;
        }
        
        const gusData = {
          companyName: company.name.trim(),
          street: company.street?.trim() || '',
          city: company.city?.trim() || '',
          postCode: company.postCode?.trim() || '',
          nip: company.nip || nip,
        };
        
        console.log(`[GUS] Pobrano dane z ${source}:`, gusData);
        
        // Aktualizuj stan - wszystkie dane firmowe z GUS, zachowaj tylko email i telefon
        setClientData(prev => ({
          ...gusData,
          email: prev.email,
          phone: prev.phone,
        }));
        
        // Powiadom rodzica o zmianie danych (do zapisania w zleceniu)
        if (onClientDataChange) {
          onClientDataChange({
            ...gusData,
            email: clientData.email,
            phone: clientData.phone,
          });
        }
        
        // Pokaż info o źródle danych
        console.log(`✅ Dane pobrane z: ${source}`);
      } else {
        setLookupError(result.error || 'Nie znaleziono firmy o podanym NIP');
      }
    } catch (error: any) {
      setLookupError(error.message || 'Błąd podczas wyszukiwania');
    } finally {
      setIsLookingUp(false);
    }
  };

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

    if (!clientData.companyName && !clientData.email) {
      alert('Podaj nazwę firmy/klienta lub adres email');
      return;
    }

    // Ostrzeżenie o odległości
    if (distanceWarning) {
      const confirmed = window.confirm(distanceWarning + '\n\nCzy kontynuować wystawianie faktury?');
      if (!confirmed) return;
    }

    setIsLoading(true);
    
    try {
      // DEBUG: Loguj dane klienta przed wysłaniem
      console.log('[InvoiceModule] Wysyłanie faktury:', {
        invoiceType,
        clientData,
        itemsCount: items.length,
        jobId
      });
      
      // Przekształć pozycje do formatu API
      const apiItems: InvoiceItemData[] = items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceNet: item.unitPriceNet,
        vatRate: item.vatRate,
        unit: item.unit,
      }));

      // Opis z adresem montażu (NIE adres do faktury!)
      const fullDescription = installAddress 
        ? `${description}\nAdres montażu: ${installAddress}`.trim()
        : description;

      let result;
      
      if (invoiceType === 'proforma') {
        result = await invoiceService.createProforma(jobId, apiItems, clientData, {
          description: fullDescription,
          installAddress: installAddress, // Adres montażu jako osobna informacja
          sendEmail,
        });
      } else {
        result = await invoiceService.createInvoice(jobId, apiItems, clientData, {
          description: fullDescription,
          installAddress: installAddress,
          sendEmail,
          markAsPaid: false,
        });
      }
      
      if (result.success && result.invoice) {
        alert(`${invoiceType === 'proforma' ? 'Proforma' : 'Faktura'} ${result.invoice.number} została wystawiona!${result.invoice.emailSent ? '\n✉️ Email wysłany!' : ''}`);
        setItems([]);
        if (onStatusChange) {
          onStatusChange(invoiceType === 'proforma' ? PaymentStatus.PROFORMA : PaymentStatus.PAID);
        }
      } else {
        throw new Error(result.error || 'Nieznany błąd');
      }
    } catch (error: any) {
      alert('Błąd: ' + (error.message || 'Nie udało się wystawić dokumentu'));
    } finally {
      setIsLoading(false);
    }
  };

  // Oznacz jako barter (bez FV)
  const handleMarkAsBarter = () => {
    if (onStatusChange) {
      onStatusChange(PaymentStatus.CASH);
    }
  };

  // Status badge
  const getStatusBadge = () => {
    const badges: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
      [PaymentStatus.NONE]: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Brak dokumentu' },
      [PaymentStatus.PROFORMA]: { bg: 'bg-orange-100', text: 'text-orange-700', label: '📄 Proforma' },
      [PaymentStatus.PARTIAL]: { bg: 'bg-purple-100', text: 'text-purple-700', label: '💸 Zaliczka' },
      [PaymentStatus.PAID]: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Opłacone' },
      [PaymentStatus.CASH]: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🤝 Barter' },
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
            <h3 className="font-bold text-slate-800">FAKTUROWANIE (INFAKT)</h3>
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
          
          {/* Ostrzeżenie o odległości */}
          {distanceWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Uwaga!</strong> {distanceWarning}
              </div>
            </div>
          )}

          {/* Adres montażu (tylko informacja) */}
          {installAddress && (
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <MapPin className="w-4 h-4" />
                <span className="font-semibold">Adres montażu:</span>
                <span>{installAddress}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1 ml-6">
                (Ten adres zostanie dodany do opisu faktury, NIE jako adres nabywcy)
              </p>
            </div>
          )}
          
          {/* Przycisk podpięcia faktury ręcznie */}
          {isAdmin && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <AttachInvoiceButton 
                jobId={jobId} 
                clientId={clientId}
                onInvoiceAttached={() => {
                  // Odśwież listę faktur - trzeba będzie przekazać callback
                  window.location.reload();
                }}
              />
            </div>
          )}

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
                        {inv.totalGross?.toFixed(2) || '0.00'} zł • {inv.paymentStatus === 'paid' ? '✅ Opłacona' : 'Oczekuje'}
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
                      onClick={() => window.open(invoiceService.getPdfUrl(inv.id), '_blank')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {inv.paymentStatus !== 'paid' && clientData.email && (
                      <button 
                        className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                        title="Wyślij email"
                        onClick={async () => {
                          try {
                            await invoiceService.sendInvoiceEmail(inv.id, clientData.email!);
                            alert('Email wysłany!');
                          } catch (e) {
                            alert('Błąd wysyłania emaila');
                          }
                        }}
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
                  onClick={handleMarkAsBarter}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                    paymentStatus === PaymentStatus.CASH
                      ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🤝 Barter
                </button>
              </div>

              {/* Dane do FAKTURY (adres siedziby firmy) */}
              <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Dane nabywcy (do faktury)
                </h4>
                
                {/* NIP z przyciskiem wyszukiwania */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={clientData.nip || ''}
                      onChange={(e) => setClientData(prev => ({ ...prev, nip: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm pl-8"
                      placeholder="NIP (10 cyfr)"
                      maxLength={13}
                    />
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    onClick={handleNipLookup}
                    disabled={isLookingUp}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-bold text-sm hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLookingUp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Pobierz z GUS
                  </button>
                </div>
                
                {lookupError && (
                  <div className="text-red-500 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {lookupError}
                  </div>
                )}

                {/* Nazwa firmy / klienta */}
                <div className="relative">
                  <input
                    type="text"
                    value={clientData.companyName || ''}
                    onChange={(e) => setClientData(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm pl-8"
                    placeholder="Nazwa firmy lub imię i nazwisko"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Adres SIEDZIBY firmy (do faktury) */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 relative">
                    <input
                      type="text"
                      value={clientData.street || ''}
                      onChange={(e) => setClientData(prev => ({ ...prev, street: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm pl-8"
                      placeholder="Adres siedziby firmy"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <input
                    type="text"
                    value={clientData.postCode || ''}
                    onChange={(e) => setClientData(prev => ({ ...prev, postCode: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                    placeholder="00-000"
                    maxLength={6}
                  />
                </div>
                
                <input
                  type="text"
                  value={clientData.city || ''}
                  onChange={(e) => setClientData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  placeholder="Miasto (siedziby)"
                />

                {/* Email i telefon */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="email"
                      value={clientData.email || ''}
                      onChange={(e) => setClientData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm pl-8"
                      placeholder="Email"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <div className="relative">
                    <input
                      type="tel"
                      value={clientData.phone || ''}
                      onChange={(e) => setClientData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm pl-8"
                      placeholder="Telefon"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 italic">
                  💡 Wpisz NIP i kliknij "Pobierz z GUS" - adres siedziby firmy uzupełni się automatycznie.
                </p>
              </div>

              {/* Pozycje */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Pozycje faktury</h4>
                  <div className="relative">
                    <button
                      onClick={() => setShowPresets(!showPresets)}
                      className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="w-4 h-4" /> Dodaj pozycję
                    </button>
                    
                    {/* Dropdown z presetami */}
                    {showPresets && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-72 overflow-y-auto">
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

              {/* Checkbox wysyłki email */}
              {clientData.email && items.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Mail className="w-4 h-4" />
                  Wyślij automatycznie na: <span className="font-semibold">{clientData.email}</span>
                </label>
              )}

              {/* Przycisk wystawienia - zawsze widoczny */}
              <button
                onClick={handleCreateInvoice}
                disabled={isLoading || items.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                  items.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : invoiceType === 'proforma'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : items.length === 0 ? (
                  <>
                    <Plus className="w-5 h-5" />
                    Dodaj pozycje żeby wystawić {invoiceType === 'proforma' ? 'proformę' : 'fakturę'}
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Wystaw {invoiceType === 'proforma' ? 'Proformę' : 'Fakturę VAT'}
                    {sendEmail && clientData.email && ' i wyślij'}
                  </>
                )}
              </button>
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

// Komponent do podpinania faktury ręcznie
const AttachInvoiceButton: React.FC<{
  jobId: string;
  clientId?: number;
  onInvoiceAttached?: () => void;
}> = ({ jobId, clientId, onInvoiceAttached }) => {
  const [showDialog, setShowDialog] = useState(false);
  const [infaktId, setInfaktId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    if (!infaktId || !/^\d+$/.test(infaktId)) {
      setError('Podaj prawidłowe ID faktury z inFakt (tylko cyfry)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await invoiceService.attachInvoice(jobId, parseInt(infaktId), clientId);
      
      if (result.success) {
        alert(`Faktura ${result.invoice?.number || infaktId} została podpięta do zlecenia!`);
        setShowDialog(false);
        setInfaktId('');
        if (onInvoiceAttached) {
          onInvoiceAttached();
        }
      } else {
        setError(result.error || 'Nie udało się podpiąć faktury');
      }
    } catch (e: any) {
      setError(e.message || 'Błąd podpinania faktury');
    } finally {
      setIsLoading(false);
    }
  };

  if (!showDialog) {
    return (
      <button
        onClick={() => setShowDialog(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors text-sm font-semibold"
      >
        <LinkIcon size={16} />
        Podepnij fakturę z inFakt
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-bold text-slate-700">Podepnij fakturę z inFakt</h5>
        <button
          onClick={() => {
            setShowDialog(false);
            setInfaktId('');
            setError(null);
          }}
          className="text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">
          ID faktury z inFakt:
        </label>
        <input
          type="text"
          value={infaktId}
          onChange={(e) => {
            setInfaktId(e.target.value);
            setError(null);
          }}
          placeholder="np. 12345"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
          disabled={isLoading}
        />
        <p className="text-xs text-slate-500">
          ID znajdziesz w URL faktury w inFakt: <code className="bg-slate-100 px-1 rounded">/invoices/12345</code>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAttach}
          disabled={isLoading || !infaktId}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin inline mr-2" />
              Podpinanie...
            </>
          ) : (
            'Podepnij'
          )}
        </button>
        <button
          onClick={() => {
            setShowDialog(false);
            setInfaktId('');
            setError(null);
          }}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-colors"
          disabled={isLoading}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
};

export default InvoiceModule;
