import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Job, JobColumnId, PaymentStatus, JobStatus } from '../../types';
import { 
  ChevronLeft, Navigation, Phone, MapPin, Edit, Save, X,
  Trash2, Copy, Archive, Image as ImageIcon, FileText, User,
  Building2, Mail, Calendar, DollarSign, CheckCircle2, AlertCircle,
  Camera, Send, Upload, ImagePlus, ZoomIn, ZoomOut
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { jobsService } from '../../services/apiService';

// Payment status helpers
const getPaymentStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return '#22c55e';
    case PaymentStatus.PROFORMA: return '#f97316';
    case PaymentStatus.PARTIAL: return '#a855f7';
    case PaymentStatus.CASH: return '#eab308';
    case PaymentStatus.OVERDUE: return '#ef4444';
    default: return '#64748b';
  }
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return 'OPŁACONE';
    case PaymentStatus.PROFORMA: return 'PROFORMA';
    case PaymentStatus.PARTIAL: return 'ZALICZKA';
    case PaymentStatus.CASH: return 'BARTER';
    case PaymentStatus.OVERDUE: return 'DO ZAPŁATY';
    default: return 'BRAK';
  }
};

// Format address without postal code
const formatAddress = (address: string | undefined): { street: string; city: string } => {
  if (!address) return { street: 'Brak adresu', city: '' };
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    let city = parts[1].replace(/\d{2}-\d{3}\s*/g, '').trim();
    if (!city && parts[2]) {
      city = parts[2].replace(/\d{2}-\d{3}\s*/g, '').trim();
    }
    return { street, city };
  }
  return { street: address, city: '' };
};

// Format phone
const formatPhone = (phone: string | undefined): string => {
  if (!phone) return 'Brak numeru';
  const cleaned = phone.replace(/[\s-]/g, '');
  const match = cleaned.match(/^(\+48)?(\d{9})$/);
  if (match) {
    const prefix = match[1] ? '+48 ' : '';
    const num = match[2];
    return `${prefix}${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 9)}`;
  }
  return phone;
};

interface MobileJobDetailProps {
  job: Job;
  onBack: () => void;
  onSave: (jobId: string, updates: Partial<Job>) => Promise<void>;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
  onArchive: (jobId: string) => void;
  isAdmin?: boolean;
}

const MobileJobDetail: React.FC<MobileJobDetailProps> = ({
  job,
  onBack,
  onSave,
  onDelete,
  onDuplicate,
  onArchive,
  isAdmin = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(-1); // -1 = modal closed
  
  // Completion section state
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionImages, setCompletionImages] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [clientEmail, setClientEmail] = useState(job.data.email || '');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);       // Kamera
  const galleryInputRef = useRef<HTMLInputElement>(null);    // Galeria
  
  // Edit state
  const [editData, setEditData] = useState({
    jobTitle: job.data.jobTitle || '',
    clientName: job.data.clientName || '',
    phoneNumber: job.data.phoneNumber || '',
    email: job.data.email || '',
    address: job.data.address || '',
    scopeWorkText: job.data.scopeWorkText || '',
    adminNotes: job.adminNotes || '',
  });

  const { street, city } = formatAddress(job.data.address);
  const paymentColor = getPaymentStatusColor(job.paymentStatus || PaymentStatus.NONE);
  const paymentLabel = getPaymentStatusLabel(job.paymentStatus || PaymentStatus.NONE);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(job.id, {
        data: {
          ...job.data,
          jobTitle: editData.jobTitle,
          clientName: editData.clientName,
          phoneNumber: editData.phoneNumber,
          email: editData.email,
          address: editData.address,
          scopeWorkText: editData.scopeWorkText,
        },
        adminNotes: editData.adminNotes,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const images = job.projectImages || [];

  // Process files (shared by upload, paste, and drag-drop)
  const processImageFiles = useCallback((files: FileList | File[]) => {
    const remainingSlots = 10 - completionImages.length;
    const filesToProcess = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          // Simple compression
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxWidth = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.8);
            setCompletionImages(prev => [...prev, compressed]);
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    });
  }, [completionImages.length]);

  // Handle paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!showCompletion) return; // Only when completion section is visible
      
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        processImageFiles(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processImageFiles, showCompletion]);

  // Handle completion image upload (shared by camera and gallery inputs)
  const handleCompletionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processImageFiles(files);
    // Reset both inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };
  
  // Reset zoom when changing image
  const handleImageChange = (idx: number) => {
    setCurrentImageIndex(idx);
  };
  
  // Zoom handlers removed (replaced by react-zoom-pan-pinch)

  // Handle completion without email
  const handleCompleteWithoutEmail = async () => {
    if (completionImages.length === 0 && !isAdmin) {
      setCompletionError('Dodaj przynajmniej 1 zdjęcie z realizacji');
      return;
    }

    setIsCompleting(true);
    setCompletionError(null);

    try {
      await jobsService.completeJob(job.id, {
        completionImages,
        completionNotes,
        clientEmail: '',
        sendEmail: false,
      });
      onBack();
    } catch (err) {
      setCompletionError('Wystąpił błąd podczas zapisywania');
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle completion with email
  const handleCompleteWithEmail = async () => {
    if (completionImages.length === 0) {
      setCompletionError('Dodaj przynajmniej 1 zdjęcie z realizacji');
      return;
    }

    if (!clientEmail || !clientEmail.includes('@')) {
      setCompletionError('Podaj poprawny adres email klienta');
      return;
    }

    setIsCompleting(true);
    setCompletionError(null);

    try {
      await jobsService.completeJob(job.id, {
        completionImages,
        completionNotes,
        clientEmail,
        sendEmail: true,
      });
      onBack();
    } catch (err) {
      setCompletionError('Wystąpił błąd podczas wysyłania');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div 
      className="h-full overflow-y-auto bg-white pb-32"
      style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={onBack}
          className="p-2 bg-slate-100 rounded-xl text-slate-600 active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="flex-1 text-center px-4">
          <div className="text-xs text-slate-400 font-medium">{job.friendlyId}</div>
          <div 
            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded text-white mt-0.5"
            style={{ background: paymentColor }}
          >
            {paymentLabel}
          </div>
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="p-2 bg-slate-100 rounded-xl text-slate-600 active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-2 bg-green-500 rounded-xl text-white active:scale-95 disabled:opacity-50"
            >
              <Save className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 bg-blue-500 rounded-xl text-white active:scale-95"
          >
            <Edit className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title Section */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4" />
            Nazwa zlecenia
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editData.jobTitle}
              onChange={(e) => setEditData({ ...editData, jobTitle: e.target.value })}
              className="w-full text-lg font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
            />
          ) : (
            <h1 className="text-xl font-bold text-slate-900">
              {job.data.jobTitle || 'Bez nazwy'}
            </h1>
          )}
        </div>

        {/* Client & Contact Section */}
        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Dane klienta
          </label>
          
          {isEditing ? (
            <>
              <input
                type="text"
                value={editData.clientName}
                onChange={(e) => setEditData({ ...editData, clientName: e.target.value })}
                placeholder="Nazwa klienta / firma"
                className="w-full text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
              />
              <input
                type="tel"
                value={editData.phoneNumber}
                onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                placeholder="Numer telefonu"
                className="w-full text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
              />
              <input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="Email"
                className="w-full text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
              />
            </>
          ) : (
            <>
              {job.data.clientName && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {job.data.clientName}
                </div>
              )}
              {job.data.email && (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {job.data.email}
                </div>
              )}
            </>
          )}
        </div>

        {/* Address Section - Prominent */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <label className="text-xs text-blue-500 font-medium uppercase tracking-wider flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4" />
            Adres montażu
          </label>
          
          {isEditing ? (
            <textarea
              value={editData.address}
              onChange={(e) => setEditData({ ...editData, address: e.target.value })}
              placeholder="Adres montażu"
              rows={2}
              className="w-full text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
            />
          ) : (
            <div className="text-slate-900">
              <div className="text-lg font-bold">{street}</div>
              {city && <div className="text-slate-600">{city}</div>}
            </div>
          )}
        </div>

        {/* Scope of Work */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Zakres prac
          </label>
          
          {isEditing ? (
            <textarea
              value={editData.scopeWorkText}
              onChange={(e) => setEditData({ ...editData, scopeWorkText: e.target.value })}
              placeholder="Opis zakresu prac..."
              rows={4}
              className="w-full text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
            />
          ) : (
            <div className="text-slate-700 whitespace-pre-wrap">
              {job.data.scopeWorkText || <span className="text-slate-400 italic">Brak opisu</span>}
            </div>
          )}
        </div>

        {/* Admin Notes */}
        {isAdmin && (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <label className="text-xs text-amber-600 font-medium uppercase tracking-wider flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" />
              Notatki wewnętrzne
            </label>
            
            {isEditing ? (
              <textarea
                value={editData.adminNotes}
                onChange={(e) => setEditData({ ...editData, adminNotes: e.target.value })}
                placeholder="Notatki dla zespołu..."
                rows={3}
                className="w-full text-slate-900 bg-white border border-slate-200 rounded-xl p-3"
              />
            ) : (
              <div className="text-slate-700 whitespace-pre-wrap">
                {job.adminNotes || <span className="text-slate-400 italic">Brak notatek</span>}
              </div>
            )}
          </div>
        )}

        {/* Payment & Amount */}
        {job.totalGross && job.totalGross > 0 && (
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <label className="text-xs text-green-600 font-medium uppercase tracking-wider flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4" />
              Kwota
            </label>
            <div className="text-2xl font-bold text-green-700">
              {job.totalGross.toFixed(2)} zł
            </div>
          </div>
        )}

        {/* Meta Info */}
        <div className="bg-slate-100 rounded-2xl p-4 flex justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {new Date(job.createdAt).toLocaleDateString('pl-PL')}
          </div>
          <div>
            {job.type === 'simple' ? 'Ręczne' : 'AI'}
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && !isEditing && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onDuplicate(job.id)}
              className="py-3 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm flex flex-col items-center gap-1 active:scale-95"
            >
              <Copy className="w-5 h-5" />
              Duplikuj
            </button>
            <button
              onClick={() => onArchive(job.id)}
              className="py-3 bg-slate-100 text-slate-600 rounded-xl font-medium text-sm flex flex-col items-center gap-1 active:scale-95"
            >
              <Archive className="w-5 h-5" />
              Archiwizuj
            </button>
            <button
              onClick={() => {
                if (window.confirm('Czy na pewno chcesz usunąć to zlecenie?')) {
                  onDelete(job.id);
                }
              }}
              className="py-3 bg-red-50 text-red-600 rounded-xl font-medium text-sm flex flex-col items-center gap-1 active:scale-95"
            >
              <Trash2 className="w-5 h-5" />
              Usuń
            </button>
          </div>
        )}

        {/* ============ ATTACHMENTS / IMAGES ============ */}
        {images.length > 0 && (
          <div className="bg-slate-50 rounded-2xl p-4">
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4" />
              Załączniki ({images.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    currentImageIndex === idx ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
                  }`}
                >
                  <img 
                    src={img} 
                    alt={`Zdjęcie ${idx + 1}`} 
                    className="w-full h-full object-cover" 
                    loading="lazy" 
                  />
                </button>
              ))}
            </div>
            
            {/* Enlarged Image Modal with Zoom */}
            {currentImageIndex >= 0 && (
              <div 
                className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                onClick={() => setCurrentImageIndex(-1)}
              >
                {/* Close button */}
                <button 
                  className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white z-10"
                  onClick={() => setCurrentImageIndex(-1)}
                >
                  <X className="w-6 h-6" />
                </button>
                
                {/* Image container with pinch-zoom support */}
                <div 
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TransformWrapper
                    initialScale={1}
                    minScale={1}
                    maxScale={4}
                    centerOnInit={true}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <React.Fragment>
                        <div className="absolute top-4 left-4 flex gap-2 z-10">
                          <button onClick={() => zoomOut()} className="p-2 bg-white/20 rounded-full text-white">
                            <ZoomOut className="w-6 h-6" />
                          </button>
                          <button onClick={() => zoomIn()} className="p-2 bg-white/20 rounded-full text-white">
                            <ZoomIn className="w-6 h-6" />
                          </button>
                        </div>
                        <TransformComponent
                          wrapperStyle={{ width: "100%", height: "100%" }}
                          contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <img 
                            src={images[currentImageIndex]} 
                            alt="Powiększone zdjęcie"
                            className="max-w-full max-h-full object-contain"
                          />
                        </TransformComponent>
                      </React.Fragment>
                    )}
                  </TransformWrapper>
                </div>
                
                {/* Navigation dots */}
                {images.length > 1 && (
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                        className={`w-3 h-3 rounded-full transition-all ${
                          idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Hint */}
                <div className="absolute bottom-16 left-0 right-0 text-center text-white/50 text-xs pointer-events-none">
                  Możesz przybliżać palcami (pinch-to-zoom)
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ COMPLETION SECTION ============ */}
        {job.status !== JobStatus.ARCHIVED && (
          <div className="bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-200 rounded-2xl p-4 mt-4">
            {!showCompletion ? (
              // Collapsed state - just a button
              <button
                onClick={() => setShowCompletion(true)}
                className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                <CheckCircle2 className="w-6 h-6" />
                ZAKOŃCZ ZLECENIE
              </button>
            ) : (
              // Expanded state - full form
              <>
                <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  Zakończenie zlecenia
                </h3>

                {/* Step 1: Photos */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    📷 Zdjęcia z realizacji <span className="text-red-500">*</span>
                    <span className="text-slate-400 font-normal ml-2">
                      ({completionImages.length}/10)
                    </span>
                  </label>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    {completionImages.map((img, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-300">
                        <img src={img} alt={`Zdjęcie ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        <button
                          onClick={() => setCompletionImages(prev => prev.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Dwa przyciski: Kamera i Galeria */}
                    {completionImages.length < 10 && (
                      <>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-20 h-20 border-2 border-dashed border-emerald-300 rounded-xl flex flex-col items-center justify-center text-emerald-600 active:bg-emerald-50 bg-emerald-50/50"
                        >
                          <Camera className="w-6 h-6" />
                          <span className="text-[10px] font-medium mt-1">Aparat</span>
                        </button>
                        <button
                          onClick={() => galleryInputRef.current?.click()}
                          className="w-20 h-20 border-2 border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center text-blue-600 active:bg-blue-50 bg-blue-50/50"
                        >
                          <ImagePlus className="w-6 h-6" />
                          <span className="text-[10px] font-medium mt-1">Galeria</span>
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Input dla kamery (z capture) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handleCompletionImageUpload}
                    className="hidden"
                  />
                  {/* Input dla galerii (bez capture) */}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleCompletionImageUpload}
                    className="hidden"
                  />
                  
                  {completionImages.length === 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Minimum 1 zdjęcie wymagane
                    </p>
                  )}
                </div>

                {/* Step 2: Notes */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    📝 Uwagi z montażu
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Np. 'Klient zadowolony', 'Szyba pęknięta'..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base resize-none"
                    rows={2}
                  />
                </div>

                {/* Step 3: Email */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ✉️ Email klienta <span className="text-slate-400 font-normal">(na prośbę o opinię)</span>
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="klient@firma.pl"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>

                {/* Error */}
                {completionError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {completionError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleCompleteWithEmail}
                    disabled={isCompleting || completionImages.length === 0}
                    className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                    {isCompleting ? 'Wysyłanie...' : 'WYŚLIJ I ZAKOŃCZ'}
                  </button>
                  
                  <button
                    onClick={handleCompleteWithoutEmail}
                    disabled={isCompleting}
                    className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isCompleting ? 'Zapisywanie...' : 'Zakończ bez maila'}
                  </button>
                  
                  <button
                    onClick={() => setShowCompletion(false)}
                    className="w-full py-2 text-slate-400 text-sm"
                  >
                    Anuluj
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 text-center mt-3">
                  Po zakończeniu zlecenie trafi do Archiwum
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Actions - Navigate & Call */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex gap-3 shadow-lg z-40">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.data.address || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-blue-500/30"
        >
          <Navigation className="w-6 h-6" />
          NAWIGUJ
        </a>
        
        <a
          href={`tel:${job.data.phoneNumber || ''}`}
          className={`flex-1 py-4 rounded-2xl font-bold text-lg flex flex-col items-center justify-center active:scale-95 shadow-lg ${
            job.data.phoneNumber 
              ? 'bg-green-500 text-white shadow-green-500/30' 
              : 'bg-slate-200 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Phone className="w-6 h-6" />
            ZADZWOŃ
          </div>
          <div className="text-sm font-normal opacity-80">
            {formatPhone(job.data.phoneNumber)}
          </div>
        </a>
      </div>
    </div>
  );
};

export default MobileJobDetail;
