import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, CheckCircle2, Loader2, Camera, Save, Edit2, 
  ListTodo, Plus, Trash2, Copy, MessageSquare, Star, FileText,
  X, Share2, ScrollText, ScanEye, Navigation, Phone, ExternalLink,
  Mic, MicOff, RotateCw, Calendar, Archive, ChevronDown, Clock,
  Receipt, Mail
} from 'lucide-react';
import { Job, JobOrderData, JobStatus, UserRole, ChecklistItem, PaymentStatus, JobColumnId } from '../types';
import { jobsService, geminiService, clientsService, Client } from '../services/apiService';
import { 
  Building2, Users
} from 'lucide-react';
import invoiceService from '../services/invoiceService';
import { rotateImage90, compressImage, processImageFile } from '../utils/imageUtils';
import InvoiceModule from './InvoiceModule';
import CompletionSection from './CompletionSection';
import { useVoiceInput } from '../hooks/useVoiceInput';

interface JobCardProps {
  job?: Job;
  initialData?: JobOrderData;
  initialImages?: string[];
  role: UserRole;
  onBack: () => void;
  onJobSaved?: () => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPaymentStatusChange?: (jobId: string, status: PaymentStatus, source: 'manual' | 'auto') => Promise<void>;
}

declare global {
  interface Window {
    html2canvas: any;
  }
}

const getFileExtension = (url: string) => {
  if (!url) return '';
  // Handle data URLs
  if (url.startsWith('data:')) {
    const mime = url.split(';')[0].split(':')[1];
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'application/postscript') return 'eps';
    return mime.split('/')[1];
  }
  
  // Handle standard URLs (remove query params)
  const cleanUrl = url.split('?')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
  return ext;
};

const isImageFile = (url: string) => {
  const ext = getFileExtension(url);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
};

interface AttachmentPreviewProps {
  url: string;
  idx: number;
  isEditing: boolean;
  isAdmin: boolean;
  onClick: (url: string) => void;
  setCoverImage: (index: number) => void;
  rotateProjectImage: (index: number) => void;
  removeProjectImage: (index: number) => void;
  setAsClientLogo?: (url: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (index: number) => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ 
  url, idx, isEditing, isAdmin, onClick, setCoverImage, rotateProjectImage, removeProjectImage,
  setAsClientLogo, isSelected, onToggleSelect
}) => {
  const [imgError, setImgError] = useState(false);
  const extension = getFileExtension(url);
  const isImg = isImageFile(url);
  
  // Try to show thumbnail if it's not a standard image
  const showThumbnail = !isImg && !imgError && ['pdf', 'eps', 'ai', 'psd'].includes(extension);
  const displayUrl = showThumbnail ? `${url}.jpg` : url;

  return (
    <div className={`relative aspect-square rounded-xl overflow-hidden border-2 group bg-slate-50 transition-all ${
      isSelected ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'
    }`}>
      <div onClick={() => !isImg ? window.open(url, '_blank') : onClick(url)} className={`w-full h-full ${isImg ? 'cursor-zoom-in' : 'cursor-pointer'}`}>
        {(!isImg && !showThumbnail) || (showThumbnail && imgError) ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 bg-slate-100">
            <FileText className="w-12 h-12 mb-2 text-slate-400" />
            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg shadow-sm uppercase text-slate-600 border border-slate-200">
              {extension || 'PLIK'}
            </span>
          </div>
        ) : (
          <img 
            src={displayUrl} 
            className="w-full h-full object-cover" 
            alt="attachment" 
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {(isEditing || isAdmin) && (
        <div className={`absolute inset-0 flex flex-col justify-between p-2 pointer-events-none transition-all duration-200 ${
          isEditing ? 'bg-black/10' : 'bg-black/40'
        }`}>
          <div className="flex justify-between pointer-events-auto">
            {/* Checkbox do zbiorczego usuwania */}
            {onToggleSelect && (
              <button 
                onClick={(e) => {e.stopPropagation(); onToggleSelect(idx)}} 
                className={`p-1.5 rounded-lg shadow-md transition-all ${
                  isSelected 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/90 text-slate-400 hover:text-red-500'
                }`}
                title="Zaznacz do usunięcia"
              >
                <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'fill-current' : ''}`} />
              </button>
            )}
            <button 
              onClick={(e) => {e.stopPropagation(); setCoverImage(idx)}} 
              className={`p-2 rounded-lg shadow-md transition-transform active:scale-95 ${
                idx === 0 ? 'bg-amber-400 text-amber-900' : 'bg-white text-slate-400 hover:text-amber-600'
              }`}
              title="Ustaw jako okładkę"
            >
              <Star className={`w-5 h-5 ${idx === 0 ? 'fill-current' : ''}`} />
            </button>
            <div className="flex gap-1">
              {/* Ustaw jako logo klienta - nowa opcja */}
              {setAsClientLogo && isImageFile(url) && (
                <button 
                  onClick={(e) => {e.stopPropagation(); setAsClientLogo(url)}} 
                  className="p-2 bg-orange-500 text-white rounded-lg shadow-md hover:bg-orange-600"
                  title="Ustaw jako logo kontrahenta"
                >
                  <Building2 className="w-5 h-5" />
                </button>
              )}
              {/* Obróć - tylko dla obrazów, nie PDF */}
              {isImageFile(url) && (
                <button 
                  onClick={(e) => {e.stopPropagation(); rotateProjectImage(idx)}} 
                  className="p-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600"
                  title="Obróć o 90°"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={(e) => {e.stopPropagation(); removeProjectImage(idx)}} 
                className="p-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600"
                title="Usuń"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          {idx === 0 && <span className="bg-amber-400 text-amber-900 text-[10px] font-black text-center py-1.5 rounded-lg shadow-sm uppercase tracking-wider">Okładka</span>}
        </div>
      )}
    </div>
  );
};

const JobCard: React.FC<JobCardProps> = ({ 
  job, 
  initialData, 
  initialImages, 
  role, 
  onBack, 
  onJobSaved, 
  onArchive, 
  onDelete,
  onPaymentStatusChange
}) => {
  const isAdmin = role === UserRole.ADMIN;
  const [isEditing, setIsEditing] = useState(!job);
  
  const normalizeData = (d: any): JobOrderData => ({
    ...d,
    locations: d.locations || [],
    scopeWorkText: d.scopeWorkText || '',
    scopeWorkImages: d.scopeWorkImages || '',
    scheduledDate: d.scheduledDate || '',
    timeSlotStart: d.timeSlotStart || '',
    timeSlotEnd: d.timeSlotEnd || '',
    billing: d.billing ? {
      ...d.billing,
      nip: d.billing.nip || d.nip || '',
      email: d.billing.email || d.email || '' // Domyślnie email z korespondencji
    } : {
      name: '',
      nip: d.nip || '',
      street: '',
      buildingNo: '',
      apartmentNo: '',
      postCode: '',
      city: '',
      email: d.email || '' // Domyślnie email z korespondencji
    }
  });

  const [editedData, setEditedData] = useState<JobOrderData>(
    job ? normalizeData(job.data) : (initialData ? normalizeData(initialData) : {} as JobOrderData)
  );
  
  const [adminNotes, setAdminNotes] = useState(job?.adminNotes || '');
  const [completionNotes, setCompletionNotes] = useState(job?.completionNotes || '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(job?.checklist || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [completionImages, setCompletionImages] = useState<string[]>(job?.completionImages || []);
  const [projectImages, setProjectImages] = useState<string[]>(job ? job.projectImages : (initialImages || []));
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showReanalysis, setShowReanalysis] = useState(false);
  const [reanalysisText, setReanalysisText] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showCompletionSection, setShowCompletionSection] = useState(false);
  const [addressOptions, setAddressOptions] = useState<Array<{
    formattedAddress: string;
    coordinates: { lat: number; lng: number };
    placeId: string;
  }>>([]);
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [manualAddressForm, setManualAddressForm] = useState({
    street: '',
    buildingNo: '',
    city: 'Warszawa',
    postCode: ''
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await clientsService.getClients();
        setClients(data);
      } catch (err) {
        console.error('Failed to load clients:', err);
      }
    };
    loadClients();
  }, []);

  useEffect(() => {
    if (job?.clientId) {
      setSelectedClientId(job.clientId);
    }
  }, [job]);
  
  // Voice Input
  const { isListening, transcript, resetTranscript, startListening, stopListening, isSupported } = useVoiceInput();
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const lastAutoNip = useRef<string | null>(null);

  // Automatyczny GUS po wpisaniu NIP - TYLKO wypełnia billing, NIE dotyka tytułu/clientName!
  useEffect(() => {
    const nip = editedData.billing?.nip?.replace(/[^\d]/g, '');
    
    if (isEditing && nip && nip.length === 10) {
      // Nie sprawdzaj jeśli to ten sam NIP co poprzednio (chyba że nazwa billing jest pusta)
      const isNewNip = nip !== lastAutoNip.current;
      const isBillingNameEmpty = !editedData.billing?.name || editedData.billing.name.length < 3;

      if (isNewNip || isBillingNameEmpty) {
        const timer = setTimeout(async () => {
          lastAutoNip.current = nip;
          
          setIsProcessing(true);
          try {
            console.log('[GUS] Automatyczne sprawdzanie NIP:', nip);
            const res = await invoiceService.lookupNip(nip);
            if (res.success && res.company) {
              const { name, street, city, postCode } = res.company;
              let st = street;
              let bNo = '';
              let aNo = '';
              const streetMatch = street.match(/^(.*?)\s(\d+[a-zA-Z]?)(?:\/(\d+))?$/);
              if (streetMatch) {
                st = streetMatch[1];
                bNo = streetMatch[2];
                aNo = streetMatch[3] || '';
              }

              // TYLKO aktualizuj billing - NIE dotykaj jobTitle ani clientName!
              setEditedData(prev => ({
                ...prev,
                billing: {
                  name: name || null,
                  nip: prev.billing?.nip ?? null,
                  street: st || null,
                  buildingNo: bNo || null,
                  apartmentNo: aNo || null,
                  city: city || null,
                  postCode: postCode || null,
                  email: prev.billing?.email ?? null
                }
              }));
              console.log('[GUS] Dane billing wypełnione dla:', name);
            }
          } catch (e) {
            console.error('Auto-GUS failed:', e);
          } finally {
            setIsProcessing(false);
          }
        }, 800);

        return () => clearTimeout(timer);
      }
    }
  }, [editedData.billing?.nip, isEditing]);

  useEffect(() => {
    if (transcript && activeVoiceField) {
      if (activeVoiceField === 'adminNotes') {
        setAdminNotes(prev => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${transcript}` : transcript;
        });
      } else if (activeVoiceField === 'completionNotes') {
        setCompletionNotes(prev => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${transcript}` : transcript;
        });
      } else {
        handleDataChange(activeVoiceField as keyof JobOrderData, 
          ((editedData[activeVoiceField as keyof JobOrderData] as string) || '').trim() + ' ' + transcript
        );
      }
      resetTranscript();
    }
  }, [transcript, activeVoiceField, resetTranscript, editedData]);

  const toggleVoice = (field: string) => {
    if (isListening && activeVoiceField === field) {
      stopListening();
      setActiveVoiceField(null);
    } else {
      setActiveVoiceField(field);
      startListening();
    }
  };

  const addressInputRef = useRef<HTMLTextAreaElement>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);

  // Google Places Autocomplete - USUNIĘTE (powodowało błędy z textarea i API)
  // Zamiast tego polegamy na naszym backendowym geokodowaniu (przycisk "Sprawdź na mapie")
  // oraz "Silent Auto-Geocode" przy zapisie.
  /*
  useEffect(() => {
    if (!addressInputRef.current || !window.google || !isEditing) return;
    // ... kod usunięty ...
  }, [isEditing]);
  */

  // Obsługa Ctrl+V dla zdjęć projektu
  // Tylko gdy: tworzymy nowe zlecenie (!job) LUB jesteśmy w trybie edycji (isEditing)
  // I tylko gdy focus jest w sekcji projektu (nie w CompletionSection)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Ogranicz paste do trybu edycji lub nowego zlecenia
      if (job && !isEditing) return;
      
      // Sprawdź czy focus jest w CompletionSection (jeśli istnieje)
      const activeElement = document.activeElement;
      const completionSection = document.querySelector('[data-completion-section]');
      if (completionSection && completionSection.contains(activeElement as Node)) {
        return; // Paste idzie do CompletionSection
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation(); // Zatrzymaj propagację
          const file = item.getAsFile();
          if (!file) continue;
          
          try {
            // Napraw orientację EXIF i kompresuj
            const processed = await processImageFile(file);
            setProjectImages(prev => [...prev, processed]);
          } catch (err) {
            console.error('Błąd przetwarzania obrazu:', err);
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste, true); // capture phase
    return () => document.removeEventListener('paste', handlePaste, true);
  }, [job, isEditing]);

  useEffect(() => {
    if (job) {
      setEditedData(normalizeData(job.data));
      setAdminNotes(job.adminNotes || '');
      setChecklist(job.checklist || []);
      setProjectImages(job.projectImages || []);
      setIsEditing(false);
    } else if (initialData) {
      setEditedData(normalizeData(initialData));
      setProjectImages(initialImages || []);
      setIsEditing(true);
    }
  }, [job, initialData, initialImages]);

  const handleDataChange = (field: keyof JobOrderData, value: any) => {
    setEditedData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'address') {
        newData.coordinates = undefined;
      }
      
      // Auto-assign client if email or NIP changes and matches
      if (!selectedClientId && (field === 'email' || field === 'nip')) {
        const val = typeof value === 'string' ? value.trim() : value;
        if (val) {
          const found = clients.find(c => 
            (field === 'email' && c.email?.toLowerCase() === val.toLowerCase()) ||
            (field === 'nip' && c.nip?.replace(/[^\d]/g, '') === val.replace(/[^\d]/g, ''))
          );
          if (found) {
            setSelectedClientId(found.id);
            // Optionally update other fields if they are empty
            if (!newData.clientName) newData.clientName = found.company_name || found.name;
            if (!newData.phoneNumber) newData.phoneNumber = found.phone || '';
            if (!newData.address) newData.address = found.address || '';
          }
        }
      }
      
      return newData;
    });
  };

  // Checklist
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist(prev => [...prev, { 
      id: Date.now().toString(), 
      task: newChecklistItem, 
      isChecked: false, 
      addedBy: isAdmin ? 'Admin' : 'Pracownik' 
    }]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = async (id: string) => {
    const newList = checklist.map(i => i.id === id ? { ...i, isChecked: !i.isChecked } : i);
    setChecklist(newList);
    if (!isEditing && job) {
      try { 
        await jobsService.updateJob(job.id, { checklist: newList }); 
      } catch {}
    }
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(prev => prev.filter(i => i.id !== id));
  };

  // Backend Geocoding (Google Maps via PHP)
  const geocodeAddress = async (address: string): Promise<Array<{
    formattedAddress: string;
    coordinates: { lat: number; lng: number };
    placeId: string;
  }>> => {
    if (!address || address.trim().length < 3) return [];
    
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const data = await response.json();
      
      if (data.success && data.results) {
        return data.results;
      }
      return [];
    } catch (error) {
      console.error('Geocoding error:', error);
      return [];
    }
  };

  const selectAddressOption = (option: { formattedAddress: string; coordinates: { lat: number; lng: number } }) => {
    setEditedData(prev => ({
      ...prev,
      address: option.formattedAddress,
      coordinates: option.coordinates
    }));
    setShowAddressModal(false);
    setAddressOptions([]);
    
    // Teraz zapisz
    const newData = {
      ...editedData,
      address: option.formattedAddress,
      coordinates: option.coordinates
    };
    
    setTimeout(() => handleSaveConfirmed(newData), 100);
  };

  const confirmManualAddress = () => {
    const { street, buildingNo, city, postCode } = manualAddressForm;
    
    if (!street || !city) {
      alert('Podaj przynajmniej ulicę i miasto');
      return;
    }
    
    const fullAddress = `${street} ${buildingNo}, ${postCode} ${city}, Polska`.trim();
    
    const newData = { 
      ...editedData, 
      address: fullAddress,
      coordinates: undefined 
    };
    
    setEditedData(newData);
    
    setShowAddressModal(false);
    setShowManualAddress(false);
    
    // Resetuj formularz
    setManualAddressForm({ street: '', buildingNo: '', city: 'Warszawa', postCode: '' });
    
    // Teraz zapisz
    setTimeout(() => handleSaveConfirmed(newData), 100);
  };

  const handleSave = async () => {
    // 1. Walidacja wstępna (tytuł)
    if (!editedData.jobTitle) {
      alert('Podaj nazwę zlecenia');
      return;
    }

    // 2. Przygotuj dane do zapisu
    let dataToSave = { ...editedData };

    // 3. "Cichy Geocoding" - jeśli jest adres, ale nie ma współrzędnych
    if (dataToSave.address && dataToSave.address.trim().length > 3 && !dataToSave.coordinates) {
      try {
        // Nie pokazujemy spinnera "isProcessing" blokującego UI, 
        // po prostu robimy to jako część procesu zapisu.
        setIsProcessing(true); // Włączamy spinner zapisu
        const results = await geocodeAddress(dataToSave.address);
        
        if (results.length > 0) {
          // Bierzemy PIERWSZY wynik (najlepsze dopasowanie wg Google)
          // To działa tak samo jak kliknięcie "Nawiguj" w Google Maps
          const bestMatch = results[0];
          dataToSave = {
            ...dataToSave,
            // Opcjonalnie: Możemy nadpisać adres sformatowanym (ładnym),
            // ale bezpieczniej zostawić tekst użytkownika i tylko dodać koordynaty.
            // Tutaj: Nadpisujemy, żeby było "ładnie" (np. z kodem pocztowym).
            address: bestMatch.formattedAddress, 
            coordinates: bestMatch.coordinates
          };
        }
      } catch (e) {
        console.error("Cichy geocoding nieudany:", e);
        // Trudno, zapisujemy bez współrzędnych
      }
    }

    // 4. Zapisz ostateczne dane
    await handleSaveConfirmed(dataToSave);
  };

  // Zmodyfikowane handleSaveConfirmed żeby przyjmowało opcjonalne dane
  const handleSaveConfirmed = async (dataToSave?: JobOrderData) => {
    const data = dataToSave || editedData;
    setIsProcessing(true);
    try {
      if (job) {
        // ZABEZPIECZENIE: Nie wysyłaj projectImages jeśli:
        // - Lokalna tablica jest pusta
        // - ALE oryginalne zlecenie miało zdjęcia
        // To zapobiega przypadkowemu usunięciu zdjęć przy innych aktualizacjach
        const updates: any = { 
          data: data, 
          adminNotes, 
          checklist,
          clientId: selectedClientId
        };
        
        // Tylko wysyłaj projectImages jeśli:
        // 1. Mamy zdjęcia do zapisania, LUB
        // 2. Świadomie usuwamy (oryginał był pusty lub użytkownik faktycznie usunął)
        const originalHadImages = (job.projectImages?.length || 0) > 0;
        const localHasImages = projectImages.length > 0;
        
        if (localHasImages || !originalHadImages) {
          updates.projectImages = projectImages;
        } else {
          console.warn('ÔÜá´ŞĆ Pomijam wysyłanie pustych projectImages - oryginał miał zdjęcia');
        }
        
        await jobsService.updateJob(job.id, updates);
        alert('Zapisano!');
        setIsEditing(false);
      } else {
        await jobsService.createJob(data, projectImages, adminNotes, checklist, selectedClientId || undefined);
        if (onJobSaved) onJobSaved();
      }
    } catch (e) { 
      alert('Błąd zapisu'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  // Funkcja wywoływana RĘCZNIE przyciskiem "Sprawdź na mapie"
  const handleCheckAddress = async () => {
    const address = editedData.address;
    if (!address || address.trim().length < 3) {
      alert('Wpisz najpierw adres');
      return;
    }
    
    setIsProcessing(true);
    const results = await geocodeAddress(address);
    setIsProcessing(false);
    
    if (results.length === 0) {
      alert('Nie znaleziono takiego adresu na mapie.');
      setShowManualAddress(true);
      setShowAddressModal(true);
    } else if (results.length === 1) {
      // Znaleziono jeden - zaktualizuj i powiadom
      setEditedData(prev => ({
        ...prev,
        address: results[0].formattedAddress,
        coordinates: results[0].coordinates
      }));
      // alert(`Znaleziono: ${results[0].formattedAddress}`); // User nie chce spamu
    } else {
      // Wiele wyników - pokaż modal
      setAddressOptions(results);
      setShowManualAddress(false);
      setShowAddressModal(true);
    }
  };

  const handleCompleteJob = async () => {
    if (!job) return;
    setIsProcessing(true);
    try {
      await jobsService.completeJob(job.id, {
        completionImages,
        completionNotes,
        clientEmail: '',
        sendEmail: false,
      });
      alert('Zlecenie zakończone!');
      onBack();
    } catch { 
      alert('Błąd zapisu'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'project' | 'completion') => {
    if (e.target.files) {
      for (const file of Array.from(e.target.files)) {
        try {
          // Napraw orientację EXIF i kompresuj
          const processed = await processImageFile(file);
          if (type === 'project') {
            setProjectImages(prev => [...prev, processed]);
          } else {
            setCompletionImages(prev => [...prev, processed]);
          }
        } catch (err) {
          console.error('Błąd przetwarzania obrazu:', err);
        }
      }
    }
  };

  const handleDuplicate = async () => {
    if (!job) return;
    if (window.confirm("Duplikować?")) {
      await jobsService.duplicateJob(job.id);
      alert("Zduplikowano!");
      onBack();
    }
  };

  // Generuj tekst do udostępnienia
  const generateShareText = () => {
    const title = editedData.jobTitle || 'Zlecenie';
    const phone = editedData.phoneNumber;
    const address = editedData.address;
    const friendlyId = job?.friendlyId || '';
    
    let text = `­čôő *${title}*\n`;
    if (friendlyId) text += `Nr: ${friendlyId}\n`;
    text += `\n`;
    
    if (phone) {
      const cleanPhone = phone.replace(/\s+/g, '');
      text += `­čô× Telefon: ${phone}\n`;
      text += `Zadzwoń: tel:${cleanPhone}\n\n`;
    }
    
    if (address) {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
      text += `­čôŹ Adres: ${address}\n`;
      text += `Nawiguj: ${mapsUrl}\n`;
    }
    
    return text;
  };

  // 1. WhatsApp tylko linki (szybkie)
  const handleShareLinks = () => {
    const shareText = generateShareText();
    // Używamy api.whatsapp.com zamiast wa.me dla większej kompatybilności
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
  };

  // 2. WhatsApp z PNG (udostępnij obrazek)
  const handleSharePng = async () => {
    if (!cardRef.current || !window.html2canvas) return;
    setIsProcessing(true);
    
    try {
      const canvas = await window.html2canvas(cardRef.current, { 
        useCORS: true, 
        scale: 2, 
        backgroundColor: '#f8fafc' 
      });
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      if (!blob) {
        setIsProcessing(false);
        return;
      }
      
      const friendlyId = job?.friendlyId || 'zlecenie';
      const fileName = `Zlecenie_${friendlyId.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Fallback - pobierz
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      }
    } catch (e) {
      console.error('Share PNG error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Kopiuj PNG do schowka
  const handleCopyPng = async () => {
    if (!cardRef.current || !window.html2canvas) return;
    setIsProcessing(true);
    
    try {
      const canvas = await window.html2canvas(cardRef.current, { 
        useCORS: true, 
        scale: 2, 
        backgroundColor: '#f8fafc' 
      });
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('Ôťů Obrazek skopiowany do schowka!\n\nTeraz możesz go wkleić (Ctrl+V) w WhatsApp.');
      } else {
        alert('ÔŁî Twoja przeglądarka nie obsługuje kopiowania obrazków.');
      }
    } catch (e) {
      console.error('Copy PNG error:', e);
      alert('ÔŁî Nie udało się skopiować obrazka.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const setCoverImage = async (index: number) => {
    const newImages = [...projectImages];
    const selected = newImages.splice(index, 1)[0];
    newImages.unshift(selected);
    setProjectImages(newImages);
    if (!isEditing && job) {
      try { await jobsService.updateJob(job.id, { projectImages: newImages }); } catch {}
    }
  };

  // Stan dla modalu potwierdzenia usunięcia zdjęcia
  const [deleteImageIndex, setDeleteImageIndex] = useState<number | null>(null);
  
  // Stan dla zbiorczego usuwania zdjęć (checkboxy)
  const [selectedForDeletion, setSelectedForDeletion] = useState<number[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  const removeProjectImage = async (index: number) => {
    // Pokaż modal potwierdzenia zamiast window.confirm
    setDeleteImageIndex(index);
  };
  
  const confirmDeleteImage = async () => {
    if (deleteImageIndex === null) return;
    const newImages = projectImages.filter((_, i) => i !== deleteImageIndex);
    setProjectImages(newImages);
    setDeleteImageIndex(null);
    if (!isEditing && job) {
      try { 
        await jobsService.updateJob(job.id, { projectImages: newImages }); 
      } catch (err) {
        console.error('Błąd usuwania zdjęcia:', err);
      }
    }
  };
  
  // Zbiorcze usuwanie zdjęć
  const toggleImageSelection = (index: number) => {
    setSelectedForDeletion(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };
  
  const selectAllImages = () => {
    if (selectedForDeletion.length === projectImages.length) {
      setSelectedForDeletion([]);
    } else {
      setSelectedForDeletion(projectImages.map((_, i) => i));
    }
  };
  
  const confirmDeleteSelectedImages = async () => {
    if (selectedForDeletion.length === 0) return;
    const newImages = projectImages.filter((_, i) => !selectedForDeletion.includes(i));
    setProjectImages(newImages);
    setSelectedForDeletion([]);
    setShowBulkDeleteConfirm(false);
    if (!isEditing && job) {
      try { 
        await jobsService.updateJob(job.id, { projectImages: newImages }); 
      } catch (err) {
        console.error('Błąd usuwania zdjęć:', err);
      }
    }
  };

  const rotateProjectImage = async (index: number) => {
    const img = projectImages[index];
    if (!img || img.startsWith('data:application/pdf')) return; // Nie obracaj PDF
    
    const rotated = await rotateImage90(img);
    const newImages = [...projectImages];
    newImages[index] = rotated;
    setProjectImages(newImages);
    
    // Zapisz od razu jeśli nie w trybie edycji
    if (!isEditing && job) {
      try { await jobsService.updateJob(job.id, { projectImages: newImages }); } catch {}
    }
  };

  const setAsClientLogo = async (url: string) => {
    if (!selectedClientId) {
      alert('Najpierw przypisz kontrahenta do tego zlecenia.');
      return;
    }
    if (!window.confirm('Czy ustawić to zdjęcie jako logo kontrahenta?')) return;
    
    setIsProcessing(true);
    try {
      await clientsService.updateClient(selectedClientId, { logo_url: url });
      alert('Logo zostało zaktualizowane.');
      if (onJobSaved) onJobSaved();
    } catch (error) {
      alert('Błąd aktualizacji logo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const AttachmentThumbnail = ({ url, onClick, isImage }: { url: string; onClick: () => void; isImage: boolean }) => {
    const [error, setError] = useState(false);
    const ext = getFileExtension(url);
    
    // If it's a standard image, just show it
    if (isImage) {
      return (
        <div onClick={onClick} className="w-full h-full cursor-zoom-in">
          <img src={url} className="w-full h-full object-cover" alt="attachment" loading="lazy" />
        </div>
      );
    }
  
    // If it's not an image, try to show the thumbnail (url + .jpg)
    // If error, show icon
    if (error) {
      return (
        <div onClick={onClick} className="w-full h-full cursor-pointer flex flex-col items-center justify-center text-slate-400 p-4 bg-slate-100">
          <FileText className="w-12 h-12 mb-2 text-slate-400" />
          <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg shadow-sm uppercase text-slate-600 border border-slate-200">
            {ext || 'PLIK'}
          </span>
        </div>
      );
    }
  
    return (
      <div onClick={onClick} className="w-full h-full cursor-pointer relative group">
         <img 
           src={url + '.jpg'} 
           className="w-full h-full object-cover" 
           alt="thumbnail" 
           loading="lazy" 
           onError={() => setError(true)}
         />
         {/* Overlay indicating it's a file */}
         <div className="absolute bottom-2 right-2 bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm border border-slate-200 uppercase">
           {ext}
         </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-40">
      
      {/* Lightbox */}
      {lightboxImage && createPortal(
        <div 
          className="fixed z-[99999] bg-black/95 flex items-center justify-center p-2 sm:p-4" 
          style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          onClick={() => setLightboxImage(null)}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 transition-colors z-[100000] hover:bg-white/10 rounded-full"
          >
            <X className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none" onClick={(e) => e.stopPropagation()}>
            {getFileExtension(lightboxImage) === 'pdf' 
              ? <iframe src={lightboxImage} className="w-full h-[85vh] max-w-5xl bg-white rounded-lg shadow-2xl pointer-events-auto" title="pdf" /> 
              : <img 
                  src={lightboxImage} 
                  className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl pointer-events-auto animate-fade-in" 
                  alt="view"
                  loading="lazy"
                />
            }
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}

      {/* Modal potwierdzenia usunięcia zdjęcia */}
      {deleteImageIndex !== null && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setDeleteImageIndex(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-2">Usunąć zdjęcie?</h3>
            <p className="text-slate-600 text-sm mb-4">Czy na pewno chcesz usunąć to zdjęcie z projektu?</p>
            
            {/* Miniatura zdjęcia */}
            {projectImages[deleteImageIndex] && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={projectImages[deleteImageIndex]} 
                  alt="Do usunięcia" 
                  className="w-24 h-24 object-cover rounded-lg border-2 border-red-200"
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteImageIndex(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteImage}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Usuń
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}

      {/* Modal potwierdzenia ZBIORCZEGO usunięcia zdjęć */}
      {showBulkDeleteConfirm && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Usunąć {selectedForDeletion.length} zdjęć?
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              Czy na pewno chcesz usunąć zaznaczone zdjęcia z projektu? Tej operacji nie można cofnąć.
            </p>
            
            {/* Miniatury zaznaczonych zdjęć */}
            <div className="mb-4 flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto">
              {selectedForDeletion.slice(0, 8).map(idx => (
                projectImages[idx] && (
                  <img 
                    key={idx}
                    src={projectImages[idx]} 
                    alt={`Do usunięcia ${idx + 1}`} 
                    className="w-14 h-14 object-cover rounded-lg border-2 border-red-200"
                  />
                )
              ))}
              {selectedForDeletion.length > 8 && (
                <div className="w-14 h-14 bg-slate-100 rounded-lg border-2 border-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                  +{selectedForDeletion.length - 8}
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteSelectedImages}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Usuń wszystkie
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}

      {/* Nav Bar */}
      <div className="flex justify-between items-center mb-4 sticky top-0 z-30 py-3 bg-slate-100/90 backdrop-blur-sm border-b border-slate-200/50">
        <button onClick={onBack} className="flex items-center text-slate-700 font-bold bg-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow border border-slate-200 transition-all">
          <ArrowLeft className="w-4 h-4 mr-2" /> Wróć
        </button>
        <div className="flex gap-2 flex-wrap justify-end">
          {isAdmin && job && !isEditing && (
            <>
              <button onClick={handleDuplicate} className="bg-violet-500 hover:bg-violet-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-violet-500/25 flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Duplikuj
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Czy na pewno chcesz przenieść to zlecenie do archiwum?')) {
                    onArchive?.(job.id);
                    onBack();
                  }
                }} 
                className="bg-slate-500 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-slate-500/25 flex items-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" /> Archiwizuj
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Czy na pewno chcesz USUN─ä─ć to zlecenie? Ta operacja jest nieodwracalna!')) {
                    onDelete?.(job.id);
                    onBack();
                  }
                }} 
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-red-500/25 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Usuń
              </button>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/25">
                <Edit2 className="w-3.5 h-3.5" /> Edytuj
              </button>
            </>
          )}
          {isEditing && (
            <span className="text-xs bg-amber-400 text-amber-900 px-4 py-2.5 rounded-xl font-black uppercase shadow-lg">
              TRYB EDYCJI
            </span>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div ref={cardRef} className="bg-slate-50 w-full mx-auto shadow-2xl overflow-hidden rounded-2xl pb-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zlecenie</span>
              <h1 className="text-2xl font-black mt-1">{job?.friendlyId || '#NOWE'}</h1>
            </div>
            <div className="text-right text-sm text-slate-400">
              {job && new Date(job.createdAt).toLocaleDateString('pl-PL', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                {isEditing ? (
                  <input 
                    value={editedData.jobTitle || ''} 
                    onChange={(e) => handleDataChange('jobTitle', e.target.value)} 
                    className="w-full text-2xl font-black text-slate-800 bg-white border-b-2 border-slate-200 p-2 focus:border-orange-500 outline-none" 
                    placeholder="NAZWA ZLECENIA" 
                  />
                ) : (
                  <h1 className="text-2xl font-black text-slate-800 leading-tight">{editedData.jobTitle}</h1>
                )}
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-2">NAZWA ZLECENIA</p>
              </div>
              
              {isEditing && job && (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Dzień / Kolumna
                  </label>
                  <select
                    value={job.columnId || 'PREPARE'}
                    onChange={async (e) => {
                      const newCol = e.target.value as JobColumnId;
                      // Optimistic update handled by parent usually, but here we act on job directly
                      // We'll just call API and reload/notify
                      try {
                        await jobsService.updateJobColumn(job.id, newCol);
                        // Force reload or update local state? 
                        // Ideally we should callback to parent to refresh
                        if (onJobSaved) onJobSaved(); // Trigger refresh
                      } catch (err) {
                        alert('Błąd zmiany kolumny');
                      }
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none"
                  >
                    <option value="PREPARE">DO PRZYGOTOWANIA</option>
                    <option value="MON">PONIEDZIAŁEK</option>
                    <option value="TUE">WTOREK</option>
                    <option value="WED">ŚRODA</option>
                    <option value="THU">CZWARTEK</option>
                    <option value="FRI">PI─äTEK</option>
                    <option value="COMPLETED">WYKONANE</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Module - TOP POSITION for easy access */}
          {isAdmin && job && (
            <InvoiceModule
              jobId={job.id}
              clientId={job.clientId}
              clientName={editedData.clientName || editedData.companyName}
              clientEmail={editedData.email}
              installAddress={editedData.address}
              phone={editedData.phoneNumber}
              nip={editedData.nip}
              billing={editedData.billing ? {
                name: editedData.billing.name || undefined,
                nip: editedData.billing.nip || undefined,
                street: editedData.billing.street || undefined,
                buildingNo: editedData.billing.buildingNo || undefined,
                apartmentNo: editedData.billing.apartmentNo || undefined,
                postCode: editedData.billing.postCode || undefined,
                city: editedData.billing.city || undefined,
                email: editedData.billing.email || undefined
              } : undefined}
              paymentStatus={job.paymentStatus || PaymentStatus.NONE}
              totalGross={job.totalGross || 0}
              paidAmount={job.paidAmount || 0}
              invoices={job.invoices || []}
              isAdmin={isAdmin}
              onStatusChange={async (status, source = 'manual') => {
                if (onPaymentStatusChange) {
                  await onPaymentStatusChange(job.id, status, source);
                } else {
                  // Fallback jeśli nie przekazano handlera (nie powinno się zdarzyć)
                  try {
                    await jobsService.updateJob(job.id, { paymentStatus: status });
                    console.log(`Payment status changed to: ${status} (source: ${source})`);
                  } catch (error) {
                    console.error('Failed to update payment status:', error);
                  }
                }
              }}
              onClientDataChange={(billingData) => {
                // TYLKO aktualizuj dane billing - NIE dotykaj głównych pól kontaktowych!
                setEditedData(prev => ({
                  ...prev,
                  billing: {
                    ...(prev.billing || {}),
                    name: billingData.companyName || prev.billing?.name || null,
                    nip: billingData.nip || prev.billing?.nip || null,
                    email: billingData.email || prev.billing?.email || null,
                    street: billingData.street || prev.billing?.street || null,
                    buildingNo: prev.billing?.buildingNo || null,
                    apartmentNo: prev.billing?.apartmentNo || null,
                    city: billingData.city || prev.billing?.city || null,
                    postCode: billingData.postCode || prev.billing?.postCode || null
                  }
                }));
              }}
            />
          )}

          {/* Re-analysis AI Section - tylko w trybie edycji */}
          {isEditing && (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-5 shadow-sm border border-violet-200">
              <button
                onClick={() => setShowReanalysis(!showReanalysis)}
                className="w-full flex justify-between items-center text-left"
              >
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wide flex items-center gap-2">
                  <RotateCw className="w-4 h-4" /> RE-ANALIZA AI - WKLEJ NOWY MAIL / W─äTEK
                </p>
                <ChevronDown className={`w-5 h-5 text-violet-500 transition-transform ${showReanalysis ? 'rotate-180' : ''}`} />
              </button>
              
              {showReanalysis && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-violet-600">
                    Wklej poniżej nową treść maila lub zaktualizowany wątek, a AI ponownie przeanalizuje i wypełni wszystkie pola.
                  </p>
                  <textarea
                    value={reanalysisText}
                    onChange={(e) => setReanalysisText(e.target.value)}
                    className="w-full min-h-[150px] bg-white border border-violet-300 rounded-lg p-3 text-sm text-slate-800 placeholder:text-slate-400"
                    placeholder="Wklej tutaj treść maila, wątku konwersacji lub nowe informacje o zleceniu..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!reanalysisText.trim()) {
                          alert('Wklej treść do analizy');
                          return;
                        }
                        if (!window.confirm('AI przeanalizuje wklejony tekst i NADPISZE obecne dane zlecenia (tytuł, adres, zakres prac itd.). Kontynuować?')) return;
                        
                        setIsProcessing(true);
                        try {
                          const result = await geminiService.parseEmail(reanalysisText, projectImages);
                          if (result) {
                            // Aktualizuj wszystkie pola z wyniku AI
                            setEditedData(prev => ({
                              ...prev,
                              ...result,
                              // Zachowaj pewne pola które nie powinny być nadpisane
                              coordinates: prev.coordinates || result.coordinates,
                            }));
                            setReanalysisText('');
                            setShowReanalysis(false);
                            alert('Ôťů AI zaktualizowało dane zlecenia! Sprawdź i popraw jeśli trzeba.');
                          }
                        } catch (e) {
                          console.error('Re-analysis error:', e);
                          alert('ÔŁî Błąd analizy AI. Spróbuj ponownie.');
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      disabled={isProcessing || !reanalysisText.trim()}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Analizuję...
                        </>
                      ) : (
                        <>
                          <RotateCw className="w-4 h-4" /> ANALIZUJ I NADPISZ DANE
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setReanalysisText('');
                        setShowReanalysis(false);
                      }}
                      className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-bold transition-all"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Address */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Navigation className="w-4 h-4" /> ADRES MONTAŻU
            </p>
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea 
                  ref={addressInputRef}
                  value={editedData.address || ''} 
                  onChange={(e) => handleDataChange('address', e.target.value)} 
                  className="w-full min-h-[60px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800"
                  placeholder="Wpisz adres..."
                />
                <button 
                  onClick={handleCheckAddress}
                  className="self-end text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg"
                >
                  <Navigation className="w-3 h-3" /> SPRAWD┼╣ NA MAPIE
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-800">{editedData.address || 'Brak adresu'}</p>
                {editedData.address && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(editedData.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/25"
                  >
                    <Navigation className="w-4 h-4" /> Nawiguj
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Scheduled Date & Time */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 shadow-sm border border-indigo-200">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> TERMIN MONTAŻU
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Data
                </label>
                {isEditing ? (
                  <input 
                    type="date"
                    value={editedData.scheduledDate || ''} 
                    onChange={(e) => handleDataChange('scheduledDate', e.target.value)} 
                    className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <p className="font-semibold text-slate-800 mt-1">
                    {editedData.scheduledDate 
                      ? new Date(editedData.scheduledDate).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
                      : <span className="text-slate-400 italic">Nie ustalono</span>
                    }
                  </p>
                )}
              </div>
              
              {/* Time Start */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Od godziny
                </label>
                {isEditing ? (
                  <input 
                    type="time"
                    value={editedData.timeSlotStart || ''} 
                    onChange={(e) => handleDataChange('timeSlotStart', e.target.value)} 
                    className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <p className="font-semibold text-slate-800 mt-1">
                    {editedData.timeSlotStart || <span className="text-slate-400 italic">-</span>}
                  </p>
                )}
              </div>
              
              {/* Time End */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Do godziny
                </label>
                {isEditing ? (
                  <input 
                    type="time"
                    value={editedData.timeSlotEnd || ''} 
                    onChange={(e) => handleDataChange('timeSlotEnd', e.target.value)} 
                    className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <p className="font-semibold text-slate-800 mt-1">
                    {editedData.timeSlotEnd || <span className="text-slate-400 italic">-</span>}
                  </p>
                )}
              </div>
            </div>
            
            {/* Quick preview of scheduled time */}
            {!isEditing && editedData.scheduledDate && (
              <div className="mt-3 pt-3 border-t border-indigo-200 flex items-center gap-2 text-indigo-700">
                <Calendar className="w-4 h-4" />
                <span className="font-bold">
                  {new Date(editedData.scheduledDate).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {editedData.timeSlotStart && editedData.timeSlotEnd && (
                    <span className="ml-2 font-normal">
                      {editedData.timeSlotStart} - {editedData.timeSlotEnd}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Client Database Link */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-500" /> BAZA KONTRAHENTÓW
              </p>
              {selectedClientId && (
                <button 
                  onClick={() => setSelectedClientId(null)}
                  className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase"
                >
                  Odłącz
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <select 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={selectedClientId || ''}
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value) : null;
                    setSelectedClientId(id);
                    if (id) {
                      const client = clients.find(c => c.id === id);
                      if (client) {
                        setEditedData(prev => ({
                          ...prev,
                          clientName: client.company_name || client.name,
                          phoneNumber: client.phone || prev.phoneNumber,
                          email: client.email || prev.email,
                          nip: client.nip || prev.nip,
                          address: client.address || prev.address
                        }));
                      }
                    }
                  }}
                >
                  <option value="">-- Wybierz kontrahenta z bazy --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.name} {c.nip ? `(NIP: ${c.nip})` : ''}
                    </option>
                  ))}
                </select>
                {!selectedClientId && (
                  <p className="text-[10px] text-slate-400 italic px-1">
                    Wybierz kontrahenta, aby automatycznie uzupełnić dane poniżej.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                    <Building2 className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 leading-tight">
                      {selectedClientId ? clients.find(c => c.id === selectedClientId)?.company_name || editedData.clientName : 'Zlecenie wolne (brak powiązania)'}
                    </p>
                    {selectedClientId && <p className="text-[10px] text-slate-400 font-medium mt-0.5">Powiązany z bazą kontrahentów</p>}
                  </div>
                </div>
                {selectedClientId && (
                  <button 
                    className="p-2 text-slate-400 hover:text-blue-600 transition-all"
                    title="Zobacz kartę klienta"
                    onClick={() => {
                      window.location.hash = `/clients?id=${selectedClientId}`;
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4" /> KONTAKT
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Osoba kontaktowa</label>
                {isEditing ? (
                  <input 
                    value={editedData.contactPerson || ''} 
                    onChange={(e) => handleDataChange('contactPerson', e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <p className="font-semibold text-slate-800">{editedData.contactPerson || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Telefon</label>
                {isEditing ? (
                  <input 
                    value={editedData.phoneNumber || ''} 
                    onChange={(e) => handleDataChange('phoneNumber', e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{editedData.phoneNumber || '-'}</p>
                    {editedData.phoneNumber && (
                      <a href={`tel:${editedData.phoneNumber}`} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Klient/Firma</label>
                {isEditing ? (
                  <input 
                    value={editedData.clientName || ''} 
                    onChange={(e) => handleDataChange('clientName', e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <p className="font-semibold text-slate-800">{editedData.clientName || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                {isEditing ? (
                  <input 
                    value={editedData.email || ''} 
                    onChange={(e) => handleDataChange('email', e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm mt-1"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{editedData.email || '-'}</p>
                    {job?.gmailThreadId && (
                      <a 
                        href={`https://mail.google.com/mail/u/0/#inbox/${job.gmailThreadId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        title="Otwórz w Gmail"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Billing Data - Sekcja do edycji */}
          {(isEditing || editedData.billing?.name || editedData.billing?.nip) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-500" /> DANE DO FAKTURY
                </p>
                {isEditing && (
                  <button 
                    onClick={() => {
                      const fullAddress = editedData.address || '';
                      let street = '';
                      let buildingNo = '';
                      let apartmentNo = '';
                      let postCode = '';
                      let city = '';

                      // Prosta próba parsowania adresu: "Ulica 12/3, 00-000 Miasto"
                      if (fullAddress) {
                        const parts = fullAddress.split(',');
                        if (parts.length > 0) {
                          const streetPart = parts[0].trim();
                          const streetMatch = streetPart.match(/^(.*?)\s(\d+[a-zA-Z]?)(?:\/(\d+))?$/);
                          if (streetMatch) {
                            street = streetMatch[1];
                            buildingNo = streetMatch[2];
                            apartmentNo = streetMatch[3] || '';
                          } else {
                            street = streetPart;
                          }
                        }
                        if (parts.length > 1) {
                          const cityPart = parts[1].trim();
                          const cityMatch = cityPart.match(/^(\d{2}-\d{3})\s+(.*)$/);
                          if (cityMatch) {
                            postCode = cityMatch[1];
                            city = cityMatch[2];
                          } else {
                            city = cityPart;
                          }
                        }
                      }

                      handleDataChange('billing', {
                        name: editedData.clientName || editedData.jobTitle,
                        nip: editedData.nip || '',
                        street,
                        buildingNo,
                        apartmentNo,
                        postCode,
                        city,
                        email: editedData.email || ''
                      });
                    }}
                    className="text-[10px] font-bold text-blue-600 uppercase hover:underline"
                  >
                    Kopiuj z głównych
                  </button>
                )}
              </div>
              
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nazwa firmy / Nabywca</label>
                    <input 
                      value={editedData.billing?.name || ''} 
                      onChange={(e) => handleDataChange('billing', { ...editedData.billing, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">NIP</label>
                    <div className="flex gap-1 mt-1">
                      <input 
                        value={editedData.billing?.nip || ''} 
                        onChange={(e) => handleDataChange('billing', { ...editedData.billing, nip: e.target.value })}
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-sm focus:border-blue-400 outline-none"
                        placeholder="NIP firmy..."
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const nip = editedData.billing?.nip?.replace(/[^\d]/g, '');
                          if (!nip || nip.length !== 10) {
                            alert('Wpisz poprawny NIP (10 cyfr)');
                            return;
                          }
                          setIsProcessing(true);
                          try {
                            const res = await invoiceService.lookupNip(nip);
                            if (res.success && res.company) {
                              const { name, street, city, postCode } = res.company;
                              
                              // Rozbij ulicę na numer
                              let st = street;
                              let bNo = '';
                              let aNo = '';
                              const streetMatch = street.match(/^(.*?)\s(\d+[a-zA-Z]?)(?:\/(\d+))?$/);
                              if (streetMatch) {
                                st = streetMatch[1];
                                bNo = streetMatch[2];
                                aNo = streetMatch[3] || '';
                              }

                              handleDataChange('billing', {
                                ...editedData.billing,
                                name,
                                street: st,
                                buildingNo: bNo,
                                apartmentNo: aNo,
                                city,
                                postCode
                              });
                              
                              // NIE nadpisujemy clientName - to pole kontaktu, nie fakturowania
                            } else {
                              alert('Nie znaleziono firmy w GUS: ' + (res.error || 'Błąd'));
                            }
                          } catch (e) {
                            alert('Błąd połączenia z GUS');
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        disabled={isProcessing}
                        className="px-3 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-black hover:bg-blue-100 transition-colors uppercase tracking-tight"
                      >
                        GUS
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Email do faktury</label>
                    <input 
                      value={editedData.billing?.email || ''} 
                      onChange={(e) => handleDataChange('billing', { ...editedData.billing, email: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Ulica</label>
                      <input 
                        value={editedData.billing?.street || ''} 
                        onChange={(e) => handleDataChange('billing', { ...editedData.billing, street: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nr</label>
                        <input 
                          value={editedData.billing?.buildingNo || ''} 
                          onChange={(e) => handleDataChange('billing', { ...editedData.billing, buildingNo: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Lok</label>
                        <input 
                          value={editedData.billing?.apartmentNo || ''} 
                          onChange={(e) => handleDataChange('billing', { ...editedData.billing, apartmentNo: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:col-span-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Kod</label>
                      <input 
                        value={editedData.billing?.postCode || ''} 
                        onChange={(e) => handleDataChange('billing', { ...editedData.billing, postCode: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Miasto</label>
                      <input 
                        value={editedData.billing?.city || ''} 
                        onChange={(e) => handleDataChange('billing', { ...editedData.billing, city: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-700">
                  <p className="font-bold">{editedData.billing?.name}</p>
                  {editedData.billing?.nip && <p>NIP: {editedData.billing.nip}</p>}
                  <p>{editedData.billing?.street} {editedData.billing?.buildingNo}{editedData.billing?.apartmentNo ? '/' + editedData.billing.apartmentNo : ''}</p>
                  <p>{editedData.billing?.postCode} {editedData.billing?.city}</p>
                  {editedData.billing?.email && <p className="text-blue-600 mt-1">{editedData.billing.email}</p>}
                </div>
              )}
            </div>
          )}

          {/* Scope of Work */}
          {(editedData.scopeWorkText || isEditing) && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-2">
                  <ScrollText className="w-4 h-4" /> ZAKRES PRAC
                </p>
                {isEditing && isSupported && (
                  <button
                    onClick={() => toggleVoice('scopeWorkText')}
                    className={`p-1.5 rounded-lg transition-all ${
                      isListening && activeVoiceField === 'scopeWorkText'
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : 'bg-white text-slate-400 hover:text-blue-600'
                    }`}
                    title="Nagraj głosowo"
                  >
                    {isListening && activeVoiceField === 'scopeWorkText' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {isEditing ? (
                <textarea 
                  value={editedData.scopeWorkText || ''} 
                  onChange={(e) => handleDataChange('scopeWorkText', e.target.value)}
                  className="w-full min-h-[100px] bg-white border border-blue-200 rounded-lg p-3 text-sm text-slate-800"
                  placeholder="Opis zakresu prac..."
                />
              ) : (
                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {editedData.scopeWorkText || "Brak opisu."}
                </div>
              )}
            </div>
          )}

          {/* AI Analysis */}
          {(editedData.scopeWorkImages || isEditing) && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wide flex items-center gap-2">
                  <ScanEye className="w-4 h-4" /> ANALIZA TECHNICZNA
                </p>
                <div className="flex gap-2">
                  {isEditing && (
                    <button
                      onClick={async () => {
                        if (!window.confirm('Czy na pewno chcesz ponownie przeanalizować zakres prac i zdjęcia? To nadpisze obecną analizę.')) return;
                        setIsProcessing(true);
                        try {
                          // Construct a prompt from title, text and images context
                          const prompt = `Proszę o ponowną analizę techniczną dla zlecenia: ${editedData.jobTitle}. Zakres prac: ${editedData.scopeWorkText}. Wygeneruj krótki, techniczny opis (wymiary, materiały) na podstawie tego tekstu i załączonych obrazów.`;
                          const result = await geminiService.parseEmail(prompt, projectImages);
                          if (result.scopeWorkImages) {
                            handleDataChange('scopeWorkImages', result.scopeWorkImages);
                          }
                        } catch (e) {
                          alert('Błąd analizy AI');
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white text-violet-500 hover:bg-violet-100 transition-all"
                      title="Ponowna analiza AI"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  {isEditing && isSupported && (
                    <button
                      onClick={() => toggleVoice('scopeWorkImages')}
                      className={`p-1.5 rounded-lg transition-all ${
                        isListening && activeVoiceField === 'scopeWorkImages'
                          ? 'bg-red-100 text-red-600 animate-pulse'
                          : 'bg-white text-slate-400 hover:text-violet-600'
                      }`}
                      title="Nagraj głosowo"
                    >
                      {isListening && activeVoiceField === 'scopeWorkImages' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              {isEditing ? (
                <textarea 
                  value={editedData.scopeWorkImages || ''} 
                  onChange={(e) => handleDataChange('scopeWorkImages', e.target.value)}
                  className="w-full min-h-[80px] bg-white border border-violet-200 rounded-lg p-3 text-sm text-slate-800"
                  placeholder="Wymiary, materiały odczytane z rysunków..."
                />
              ) : (
                <div className="text-sm text-slate-700 italic">{editedData.scopeWorkImages || "Brak analizy."}</div>
              )}
            </div>
          )}

          {/* Admin Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> UWAGI WEWNĘTRZNE
              </p>
              {isEditing && isSupported && (
                <button
                  onClick={() => toggleVoice('adminNotes')}
                  className={`p-1.5 rounded-lg transition-all ${
                    isListening && activeVoiceField === 'adminNotes'
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-white text-slate-400 hover:text-amber-600'
                  }`}
                  title="Nagraj głosowo"
                >
                  {isListening && activeVoiceField === 'adminNotes' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea 
                value={adminNotes} 
                onChange={(e) => setAdminNotes(e.target.value)} 
                className="w-full min-h-[80px] bg-white text-slate-800 border border-amber-200 p-3 rounded-lg text-sm" 
                placeholder="Uwagi dla montażystów..." 
              />
            ) : (
              <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{adminNotes || 'Brak uwag.'}</p>
            )}
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ListTodo className="w-4 h-4" /> Checklista
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  <input 
                    value={newChecklistItem} 
                    onChange={(e) => setNewChecklistItem(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-48" 
                    placeholder="Dodaj zadanie..." 
                  />
                  <button onClick={addChecklistItem} className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {checklist.length === 0 && <p className="text-sm text-slate-400 italic">Brak zadań.</p>}
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border bg-slate-50 transition-colors hover:bg-white">
                  <div 
                    onClick={() => toggleChecklistItem(item.id)} 
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                      item.isChecked 
                        ? 'bg-green-500 border-green-500' 
                        : 'bg-white border-slate-300 hover:border-green-400'
                    }`}
                  >
                    {item.isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`flex-1 text-sm font-medium ${item.isChecked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.task}
                  </span>
                  {isEditing && (
                    <button onClick={() => removeChecklistItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>


          {/* Images Gallery */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4" /> Pliki i Projekty
              </h3>
              {isEditing && (
                <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-100 transition-colors shadow-sm border border-blue-200">
                  <Plus className="w-4 h-4" /> DODAJ
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => handleImageUpload(e, 'project')} />
                </label>
              )}
            </div>
            
            {/* Drop zone dla drag & drop */}
            {isEditing && (
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    for (const file of Array.from(files)) {
                      if (file.type.startsWith('image/')) {
                        try {
                          const processed = await processImageFile(file);
                          setProjectImages(prev => [...prev, processed]);
                        } catch (err) {
                          console.error('Błąd przetwarzania obrazu:', err);
                        }
                      } else if (file.type === 'application/pdf') {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setProjectImages(prev => [...prev, reader.result as string]);
                        };
                        reader.readAsDataURL(file);
                      }
                    }
                  }
                }}
                className="mb-4 p-4 border-2 border-dashed border-slate-300 rounded-xl text-center text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
              >
                <p className="mb-1">Przeciągnij i upuść zdjęcia tutaj</p>
                <p className="text-xs text-slate-400">lub użyj Ctrl+V aby wkleić</p>
              </div>
            )}

            {projectImages.length > 0 ? (
              <>
                {/* Pasek zbiorczego usuwania */}
                {(isEditing || isAdmin) && projectImages.length > 1 && (
                  <div className="flex items-center justify-between mb-3 p-2 bg-slate-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllImages}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {selectedForDeletion.length === projectImages.length ? 'Odznacz wszystko' : 'Zaznacz wszystko'}
                      </button>
                      {selectedForDeletion.length > 0 && (
                        <span className="text-xs text-slate-500">
                          ({selectedForDeletion.length} zaznaczonych)
                        </span>
                      )}
                    </div>
                    {selectedForDeletion.length > 0 && (
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Usuń zaznaczone ({selectedForDeletion.length})
                      </button>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {projectImages.map((img, idx) => (
                    <AttachmentPreview
                      key={idx}
                      url={img}
                      idx={idx}
                      isEditing={isEditing}
                      isAdmin={isAdmin}
                      onClick={setLightboxImage}
                      setCoverImage={setCoverImage}
                      rotateProjectImage={rotateProjectImage}
                      removeProjectImage={removeProjectImage}
                      setAsClientLogo={setAsClientLogo}
                      isSelected={selectedForDeletion.includes(idx)}
                      onToggleSelect={toggleImageSelection}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-sm text-slate-400">Brak załączników.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-6 space-y-4">
        {/* Przycisk "Zakończ zlecenie" - widoczny w obu trybach (edycja i normalny) oraz dla zleceń z archiwum */}
        {isAdmin && job && (
          <div className="space-y-3">
            {isEditing ? (
              <div className="flex gap-3">
                <button 
                  onClick={handleSave} 
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-3 transition-colors text-lg disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Save />} 
                  ZAPISZ
                </button>
                <button 
                  onClick={() => setShowCompletionSection(!showCompletionSection)} 
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-3 transition-colors text-lg disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {showCompletionSection ? 'UKRYJ' : (job.status === JobStatus.ARCHIVED ? 'OPINIA' : 'ZAKOŃCZ')}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowCompletionSection(!showCompletionSection)} 
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-3 transition-colors text-lg disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                {showCompletionSection 
                  ? 'UKRYJ SEKCJĘ ZAKOŃCZENIA' 
                  : (job.status === JobStatus.ARCHIVED ? 'WYŚLIJ PROŚBĘ O OPINIĘ' : 'ZAKOŃCZ ZLECENIE')
                }
              </button>
            )}
            
            {/* Completion Section - rozwija się pod przyciskiem po kliknięciu */}
            {showCompletionSection && (
              <CompletionSection
                job={job}
                isAdmin={isAdmin}
                onComplete={async (completionData) => {
                  try {
                    await jobsService.completeJob(job.id, {
                      completionImages: completionData.completionImages,
                      completionNotes: completionData.completionNotes,
                      clientEmail: completionData.clientEmail,
                      sendEmail: completionData.sendEmail,
                      archiveJob: completionData.archiveJob !== false,
                    });
                    setShowCompletionSection(false);
                    onJobSaved?.();
                    onBack();
                  } catch (error) {
                    console.error('Błąd zakończenia zlecenia:', error);
                    throw error;
                  }
                }}
              />
            )}
          </div>
        )}
        
        {isAdmin && !isEditing && (
          <div className="space-y-3">
            {/* 1. WhatsApp - linki */}
            <button 
              onClick={handleShareLinks}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl shadow-xl shadow-green-500/25 flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp (linki)
            </button>

            <div className="grid grid-cols-2 gap-3">
              {/* 2. Udostępnij PNG */}
              <button 
                onClick={handleSharePng}
                disabled={isProcessing}
                className="py-3 bg-white border-2 border-green-200 hover:border-green-400 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
                Udostępnij PNG
              </button>

              {/* 3. Kopiuj PNG */}
              <button 
                onClick={handleCopyPng}
                disabled={isProcessing}
                className="py-3 bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
                Kopiuj PNG
              </button>
            </div>
          </div>
        )}
        
        {/* Worker Completion Form */}
        {!isAdmin && !isEditing && job?.status !== JobStatus.COMPLETED && (
          <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-blue-500">
            <h3 className="font-bold text-xl text-slate-800 mb-4">Raport Montażowy</h3>
            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4" 
              value={completionNotes} 
              onChange={(e) => setCompletionNotes(e.target.value)} 
              placeholder="Opisz co zostało zrobione..." 
              rows={4}
            />
            <label className="flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-xl mb-4 cursor-pointer hover:bg-slate-200 border border-dashed border-slate-300 font-bold text-slate-600">
              <Camera className="w-5 h-5" />
              <span>Dodaj Zdjęcia z Realizacji</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'completion')} />
            </label>
            {completionImages.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {completionImages.map((img, i) => (
                  <img key={i} src={img} className="w-16 h-16 rounded-lg object-cover border" alt="done" loading="lazy" />
                ))}
              </div>
            )}
            <button 
              onClick={handleCompleteJob} 
              disabled={isProcessing} 
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-xl shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} 
              Zakończ Zlecenie
            </button>
          </div>
        )}
      </div>

      {/* Modal: Wybór adresu / ręczne wprowadzanie */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Navigation className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">
                  {showManualAddress ? 'Wprowadź adres ręcznie' : 'Wybierz lokalizację'}
                </h3>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Szukano: <strong>{editedData.address}</strong>
              </p>
            </div>

            <div className="p-6">
              {!showManualAddress && addressOptions.length > 0 && (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Google znalazł kilka lokalizacji. Najbliższa Twojej firmy jest pierwsza. Wybierz właściwą:
                  </p>
                  
                  <div className="space-y-2 mb-4">
                    {addressOptions.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectAddressOption(option)}
                        className={`w-full text-left p-4 border-2 rounded-xl transition-colors ${
                          idx === 0 
                            ? 'border-green-500 bg-green-50 hover:bg-green-100' 
                            : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-semibold text-slate-800">{option.formattedAddress}</div>
                          {idx === 0 && <span className="text-[10px] font-bold bg-green-200 text-green-800 px-2 py-1 rounded ml-2">NAJBLIŻEJ</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex gap-2">
                          <span>{option.coordinates.lat.toFixed(5)}, {option.coordinates.lng.toFixed(5)}</span>
                          {(option as any).distance !== undefined && (
                            <span className="font-bold text-slate-400">
                              ({Math.round((option as any).distance)} km od bazy)
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4 space-y-2">
                    <button
                      onClick={() => setShowManualAddress(true)}
                      className="w-full py-3 text-blue-600 font-medium hover:bg-blue-50 rounded-xl transition-colors"
                    >
                      ­čľŐ´ŞĆ Żaden się nie zgadza - wprowadzę ręcznie
                    </button>
                    <button
                      onClick={() => {
                        // Zapisz bez adresu/współrzędnych
                        setEditedData(prev => ({ ...prev, coordinates: undefined }));
                        setShowAddressModal(false);
                        setAddressOptions([]);
                        setTimeout(() => handleSaveConfirmed(), 100);
                      }}
                      className="w-full py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      ÔĆş´ŞĆ Nie znam adresu - wprowadzę później
                    </button>
                  </div>
                </>
              )}

              {showManualAddress && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Ulica <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualAddressForm.street}
                        onChange={(e) => setManualAddressForm(prev => ({ ...prev, street: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 outline-none"
                        placeholder="np. Zajęcza"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Numer budynku
                      </label>
                      <input
                        type="text"
                        value={manualAddressForm.buildingNo}
                        onChange={(e) => setManualAddressForm(prev => ({ ...prev, buildingNo: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 outline-none"
                        placeholder="9"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Kod pocztowy
                      </label>
                      <input
                        type="text"
                        value={manualAddressForm.postCode}
                        onChange={(e) => setManualAddressForm(prev => ({ ...prev, postCode: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 outline-none"
                        placeholder="00-000"
                        maxLength={6}
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Miasto <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualAddressForm.city}
                        onChange={(e) => setManualAddressForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 outline-none"
                        placeholder="Warszawa"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowAddressModal(false);
                          setShowManualAddress(false);
                          setAddressOptions([]);
                        }}
                        className="flex-1 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={confirmManualAddress}
                        className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
                      >
                        Zapisz adres
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        // Zapisz bez zmiany adresu - użyj tego co jest w polu
                        setShowAddressModal(false);
                        setShowManualAddress(false);
                        setAddressOptions([]);
                        setTimeout(() => handleSaveConfirmed(), 100);
                      }}
                      className="w-full py-3 text-white font-medium bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                    >
                      <span>ÔĆş´ŞĆ</span> Pomiń - zapisz "{editedData.address}"
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!showManualAddress && addressOptions.length > 0 && (
              <div className="border-t p-4">
                <button
                  onClick={() => {
                    setShowAddressModal(false);
                    setAddressOptions([]);
                  }}
                  className="w-full py-2 text-slate-500 hover:text-slate-700"
                >
                  Anuluj
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;

