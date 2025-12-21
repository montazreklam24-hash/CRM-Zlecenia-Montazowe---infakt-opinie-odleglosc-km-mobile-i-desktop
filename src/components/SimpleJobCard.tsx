import React, { useState, useEffect, useRef } from 'react';
import { Job, JobAttachment, JobStatus } from '../types';
import { processImageFile } from '../utils/imageUtils';

declare global {
  interface Window {
    google: any;
  }
}

interface SimpleJobCardProps {
  job?: Job;
  onClose: () => void;
  onSave: (job: Partial<Job>) => Promise<void>;
  onDelete?: (jobId: string) => Promise<void>;
}

export const SimpleJobCard: React.FC<SimpleJobCardProps> = ({
  job,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState({
    jobTitle: job?.data?.jobTitle || '',
    clientName: job?.data?.clientName || '',
    companyName: job?.data?.companyName || '',
    phone: job?.data?.phoneNumber || '',
    email: job?.data?.email || '',
    nip: job?.data?.nip || '',
    address: job?.data?.address || '',
    coordinates: job?.data?.coordinates as { lat: number; lng: number } | undefined,
    description: job?.data?.description || job?.data?.scopeWorkText || '',
    notes: job?.adminNotes || '',
    status: (job?.status || 'NEW') as JobStatus,
    scheduledDate: job?.data?.scheduledDate || '',
    valueNet: job?.data?.payment?.netAmount?.toString() || '',
    valueGross: job?.data?.payment?.grossAmount?.toString() || '',
    paymentStatus: job?.data?.paymentStatus || 'pending'
  });
  
  const [projectImages, setProjectImages] = useState<string[]>(job?.projectImages || []);
  const [completionImages, setCompletionImages] = useState<string[]>(job?.completionImages || []);
  const [attachments, setAttachments] = useState<JobAttachment[]>(job?.attachments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-save debounce
  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, []);
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Auto-save wyłączony - użytkownik kliknie "Zapisz"
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Napraw orientację EXIF (obrócone zdjęcia z telefonu) i kompresuj
        const processed = await processImageFile(file);
        setProjectImages(prev => [...prev, processed]);
      } catch (err) {
        console.error('Błąd przetwarzania obrazu:', err);
      }
    }
  };
  
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result as string
        };
        setAttachments(prev => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Ref do głównego kontenera - do sprawdzenia czy paste jest dla tego komponentu
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handlePasteImage = async (e: ClipboardEvent) => {
    // Sprawdź czy aktywny element jest wewnątrz tego komponentu
    const activeElement = document.activeElement;
    if (containerRef.current && !containerRef.current.contains(activeElement)) {
      return; // Paste nie jest dla tego komponentu
    }
    
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            try {
              // Napraw orientację EXIF i kompresuj
              const processed = await processImageFile(blob);
              setProjectImages(prev => [...prev, processed]);
            } catch (err) {
              console.error('Błąd przetwarzania obrazu:', err);
            }
          }
        }
      }
    }
  };
  
  useEffect(() => {
    document.addEventListener('paste', handlePasteImage as any);
    return () => document.removeEventListener('paste', handlePasteImage as any);
  }, []);
  
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Google Places Autocomplete
  useEffect(() => {
    if (!addressInputRef.current || !window.google) return;

    const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'pl' },
      fields: ['formatted_address', 'geometry']
    });

    // Preferencja dla Warszawy (bounds)
    const warsawBounds = new window.google.maps.LatLngBounds(
      new window.google.maps.LatLng(52.1, 20.8),
      new window.google.maps.LatLng(52.4, 21.3)
    );
    autocomplete.setBounds(warsawBounds);

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address && place.geometry?.location) {
        setFormData(prev => ({
          ...prev,
          address: place.formatted_address || '',
          coordinates: {
            lat: place.geometry!.location!.lat(),
            lng: place.geometry!.location!.lng()
          }
        }));
      }
    });
  }, []);

  const handleGeocodeAddress = async () => {
    if (!formData.address) return;
    
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: formData.address })
      });
      
      const data = await response.json();
      
      if (data.success && data.results.length > 0) {
        if (data.results.length === 1) {
          // Jeden wynik - ustaw automatycznie
          const result = data.results[0];
          setFormData(prev => ({
            ...prev,
            address: result.formattedAddress,
            coordinates: result.coordinates
          }));
        } else {
          // Wiele wyników - pokaż modal wyboru
          setAddressOptions(data.results);
          setShowAddressModal(true);
        }
      } else {
        alert('Nie znaleziono adresu. Sprawdź pisownię lub wpisz ręcznie.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };
  
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const jobData: Partial<Job> = {
        id: job?.id,
        data: {
          jobTitle: formData.jobTitle,
          clientName: formData.clientName,
          companyName: formData.companyName,
          phoneNumber: formData.phone,
          email: formData.email,
          nip: formData.nip,
          address: formData.address,
          coordinates: formData.coordinates,
          description: formData.description,
          scheduledDate: formData.scheduledDate,
          paymentStatus: formData.paymentStatus,
          payment: {
            netAmount: formData.valueNet ? parseFloat(formData.valueNet) : undefined,
            grossAmount: formData.valueGross ? parseFloat(formData.valueGross) : undefined
          }
        },
        status: formData.status as JobStatus,
        adminNotes: formData.notes,
        projectImages,
        completionImages,
        attachments
      };
      
      await onSave(jobData);
    } catch (error) {
      console.error('Save error:', error);
      alert('Błąd zapisu zlecenia');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!job?.id || !onDelete) return;
    try {
      await onDelete(job.id);
      onClose();
    } catch (error) {
      alert('Błąd usuwania zlecenia');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div ref={containerRef} className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <h2 className="text-2xl font-bold">
                {job ? 'Edycja zlecenia' : 'Nowe zlecenie proste'}
              </h2>
              {job?.friendlyId && (
                <p className="text-green-100 text-sm">{job.friendlyId}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
        
        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tytuł zlecenia */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Tytuł zlecenia <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => handleChange('jobTitle', e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-lg"
              placeholder="np. Montaż szyld montazreklam24.pl"
              required
            />
          </div>
          
          {/* Dane klienta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Imię i nazwisko
              </label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => handleChange('clientName', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="Jan Kowalski"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nazwa firmy
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="Firma Sp. z o.o."
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Telefon <span className="text-orange-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="123 456 789"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="email@example.com"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                NIP
              </label>
              <input
                type="text"
                value={formData.nip}
                onChange={(e) => handleChange('nip', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="123-456-78-90"
              />
            </div>
          </div>
          
          {/* Adres */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Adres montażu
            </label>
            <div className="flex gap-2">
              <input
                ref={addressInputRef}
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="Wpisz adres (np. Żytnia 4, Warszawa)"
              />
              <button
                onClick={handleGeocodeAddress}
                className="px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
                type="button"
                title="Wymuś geokodowanie"
              >
                📍
              </button>
            </div>
            {formData.coordinates && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Współrzędne: {formData.coordinates.lat.toFixed(5)}, {formData.coordinates.lng.toFixed(5)}
              </p>
            )}
          </div>
          
          {/* Opis */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Opis zlecenia
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none resize-none"
              placeholder="Szczegóły zlecenia..."
              rows={4}
            />
          </div>
          
          {/* Notatki wewnętrzne */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notatki wewnętrzne
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-yellow-400 outline-none resize-none bg-yellow-50"
              placeholder="Uwagi dla zespołu..."
              rows={3}
            />
          </div>
          
          {/* Termin i status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Termin realizacji
              </label>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => handleChange('scheduledDate', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
              >
                <option value="NEW">Nowe</option>
                <option value="IN_PROGRESS">W trakcie</option>
                <option value="COMPLETED">Zakończone</option>
                <option value="CANCELLED">Anulowane</option>
              </select>
            </div>
          </div>
          
          {/* Płatność */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Wartość netto
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valueNet}
                onChange={(e) => handleChange('valueNet', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="0.00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Wartość brutto
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valueGross}
                onChange={(e) => handleChange('valueGross', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
                placeholder="0.00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status płatności
              </label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => handleChange('paymentStatus', e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-green-400 outline-none"
              >
                <option value="pending">Oczekująca</option>
                <option value="proforma">Proforma</option>
                <option value="invoiced">Zafakturowana</option>
                <option value="paid">Opłacona</option>
                <option value="overdue">Zaległa</option>
              </select>
            </div>
          </div>
          
          {/* Zdjęcia projektu */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Zdjęcia (Ctrl+V lub kliknij)
            </label>
            <div className="flex flex-wrap gap-3">
              {projectImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt={`Zdjęcie ${idx + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border-2 border-slate-200"
                    loading="lazy"
                  />
                  <button
                    onClick={() => setProjectImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <span className="text-3xl text-slate-400">+</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
          
          {/* Załączniki */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Załączniki (PDF, dokumenty)
            </label>
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-2xl">📎</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{att.name}</p>
                    <p className="text-xs text-slate-500">{(att.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="text-orange-500 hover:text-orange-700"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <button
                onClick={() => attachmentInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <span className="text-slate-600">+ Dodaj załącznik</span>
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                onChange={handleAttachmentUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
        
        {/* Footer - Przyciski */}
        <div className="border-t p-4 flex items-center justify-between bg-slate-50">
          <div>
            {job && onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                🗑️ Usuń
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Zapisywanie...' : '💾 Zapisz'}
            </button>
          </div>
        </div>
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
              <h3 className="text-lg font-bold mb-2">Potwierdź usunięcie</h3>
              <p className="text-slate-600 mb-4">Czy na pewno chcesz usunąć to zlecenie?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border-2 border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Usuń
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Address Selection Modal */}
        {showAddressModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Wybierz właściwy adres</h3>
              <div className="space-y-2">
                {addressOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        address: option.formattedAddress,
                        coordinates: option.coordinates
                      }));
                      setShowAddressModal(false);
                      setAddressOptions([]);
                    }}
                    className="w-full text-left p-3 border-2 border-slate-100 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                  >
                    <p className="font-semibold text-slate-800">{option.formattedAddress}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {option.coordinates.lat.toFixed(5)}, {option.coordinates.lng.toFixed(5)}
                    </p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddressModal(false)}
                className="mt-4 w-full py-2 text-slate-500 hover:text-slate-700"
              >
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

