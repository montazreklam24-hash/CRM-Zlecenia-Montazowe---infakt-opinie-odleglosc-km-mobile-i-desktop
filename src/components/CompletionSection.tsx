import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Job } from '../types';
import { Camera, X, Send, CheckCircle, Upload, AlertCircle } from 'lucide-react';
import { processImageFile, compressImage } from '../utils/imageUtils';

interface CompletionSectionProps {
  job: Job;
  onComplete: (data: {
    completionImages: string[];
    completionNotes: string;
    clientEmail: string;
    sendEmail: boolean;
    archiveJob?: boolean; // false = tylko wyślij email, nie archiwizuj
  }) => Promise<void>;
  isAdmin?: boolean;
}

const CompletionSection: React.FC<CompletionSectionProps> = ({
  job,
  onComplete,
  isAdmin = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true); // Domyślnie rozwinięte
  const [completionImages, setCompletionImages] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [clientEmail, setClientEmail] = useState(job.data.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Limit to 10 images
    const remainingSlots = 10 - completionImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      try {
        // Napraw orientację EXIF i kompresuj
        const processed = await processImageFile(file);
        setCompletionImages(prev => [...prev, processed]);
      } catch (err) {
        console.error('Błąd przetwarzania obrazu:', err);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // compressImage jest teraz importowana z ../utils/imageUtils

  // Process files (shared by upload, paste, and drag-drop)
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const remainingSlots = 10 - completionImages.length;
    const filesToProcess = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .slice(0, remainingSlots);

    for (const file of filesToProcess) {
      try {
        // Napraw orientację EXIF i kompresuj
        const processed = await processImageFile(file);
        setCompletionImages(prev => [...prev, processed]);
      } catch (err) {
        console.error('Błąd przetwarzania obrazu:', err);
      }
    }
  }, [completionImages.length]);

  // Handle paste (Ctrl+V) - TYLKO gdy sekcja jest rozwinięta
  useEffect(() => {
    if (!isExpanded) return; // Nie aktywuj paste gdy sekcja jest zwinięta
    
    const handlePaste = (e: ClipboardEvent) => {
      // Sprawdź czy focus jest w sekcji completion
      const activeElement = document.activeElement;
      if (!dropZoneRef.current || !dropZoneRef.current.contains(activeElement as Node)) {
        return; // Paste nie jest dla tej sekcji
      }
      
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
        e.stopPropagation(); // Zatrzymaj propagację
        processFiles(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste, true); // capture phase
    return () => document.removeEventListener('paste', handlePaste, true);
  }, [processFiles, isExpanded]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setCompletionImages(prev => prev.filter((_, i) => i !== index));
  };

  // Handle completion without email
  const handleCompleteWithoutEmail = async () => {
    if (completionImages.length === 0 && !isAdmin) {
      setError('Dodaj przynajmniej 1 zdjęcie z realizacji');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onComplete({
        completionImages,
        completionNotes,
        clientEmail: '',
        sendEmail: false,
        archiveJob: !isArchived, // Nie archiwizuj ponownie jeśli już zarchiwizowane
      });
    } catch (err) {
      setError('Wystąpił błąd podczas zapisywania');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle completion with email
  const handleCompleteWithEmail = async () => {
    if (completionImages.length === 0) {
      setError('Dodaj przynajmniej 1 zdjęcie z realizacji');
      return;
    }

    if (!clientEmail || !clientEmail.includes('@')) {
      setError('Podaj poprawny adres email klienta');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onComplete({
        completionImages,
        completionNotes,
        clientEmail,
        sendEmail: true,
        archiveJob: !isArchived, // Nie archiwizuj ponownie jeśli już zarchiwizowane
      });
    } catch (err) {
      setError('Wystąpił błąd podczas wysyłania');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Email template preview
  const emailSubject = `Realizacja montażu - ${job.data.jobTitle || 'Zlecenie'}`;
  const emailBody = `Dzień dobry,

Czy mogę mieć do Państwa małą prośbę o pozostawienie pozytywnej opinii w Google?

Będzie mi bardzo miło – każda opinia wiele nam daje 😊

Jeśli dodadzą Państwo także zdjęcia z realizacji, będzie to dodatkowa forma reklamy także Państwa lokalu lub marki.

Oczywiście każda opinia, nawet bez zdjęć, jest dla nas cenna.


👉 Link do wystawienia opinii:
https://g.page/r/CS69RHgLcp94EB0/review

Jeśli mają Państwo ochotę, zapraszam także do obserwowania naszych profili:

📸 Instagram: https://www.instagram.com/montazreklam24/
📘 Facebook: https://www.facebook.com/montazreklam24

Dziękuję za pomoc – bardzo nam to pomaga rozwijać firmę i docierać do nowych Klientów.

Serdecznie pozdrawiam,
Montaż Reklam 24`;

  const isArchived = job.status === 'ARCHIVED';
  const reviewAlreadySent = !!job.reviewRequestSentAt;

  return (
    <div className="bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-200 rounded-xl p-4 mt-4">
      {/* Header with expand/collapse button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {isArchived ? 'Prośba o opinię' : 'Zakończenie zlecenia'}
        </h3>
        
        <div className="flex items-center gap-2">
          {reviewAlreadySent && (
            <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
              ✅ Prośba wysłana
              <span className="text-blue-500 font-normal">
                {new Date(job.reviewRequestSentAt!).toLocaleDateString('pl-PL')}
              </span>
            </div>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            title={isExpanded ? "Zwiń sekcję" : "Rozwiń sekcję"}
          >
            {isExpanded ? '▼ Zwiń' : '▶ Rozwiń'}
          </button>
        </div>
      </div>
      
      {/* Sekcja rozwija się tylko gdy isExpanded === true */}
      {!isExpanded && (
        <div className="text-sm text-slate-600 italic mb-2">
          Kliknij "Rozwiń" aby dodać zdjęcia z realizacji i zakończyć zlecenie
        </div>
      )}
      
      {isExpanded && (
        <>
      
      {/* Warning if already sent */}
      {reviewAlreadySent && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Uwaga:</strong> Prośba o opinię została już wysłana na adres <strong>{job.reviewRequestEmail}</strong>.
            Wysłanie kolejnej może być odebrane negatywnie przez klienta.
          </div>
        </div>
      )}

          {/* Step 1: Photos - with drag & drop and paste support */}
          <div className="mb-4" data-completion-section>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              📷 Zdjęcia z realizacji {!isAdmin && <span className="text-red-500">*</span>}
              <span className="text-slate-400 font-normal ml-2">
                ({completionImages.length}/10)
              </span>
            </label>
            
            {/* Drop zone */}
            <div
              ref={dropZoneRef}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-3 transition-all ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-100' 
                  : 'border-emerald-300 bg-emerald-50/50'
              }`}
            >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-emerald-500/20 rounded-xl flex items-center justify-center z-10">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg text-emerald-700 font-bold flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upuść zdjęcia tutaj
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            {completionImages.map((img, index) => (
              <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-emerald-300 shadow-sm">
                <img src={img} alt={`Zdjęcie ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            
            {completionImages.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-emerald-400 rounded-lg flex flex-col items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors bg-white"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[10px] font-medium mt-1">Dodaj</span>
              </button>
            )}
          </div>
          
          {/* Hints */}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
            <span className="bg-slate-100 px-2 py-0.5 rounded">📋 Ctrl+V - wklej</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded">📁 Przeciągnij i upuść</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded">📷 Kliknij aby wybrać</span>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
        
        {completionImages.length === 0 && (
          <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" />
            Minimum 1 zdjęcie wymagane {isAdmin && '(admin może pominąć)'}
          </p>
        )}
      </div>

      {/* Step 2: Notes */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-2">
          📝 Uwagi z montażu <span className="text-slate-400 font-normal">(opcjonalne)</span>
        </label>
        <textarea
          value={completionNotes}
          onChange={(e) => setCompletionNotes(e.target.value)}
          placeholder="Np. 'Klient bardzo zadowolony', 'Szyba była pęknięta', 'Trzeba wrócić dokończyć'..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          rows={2}
        />
      </div>

      {/* Step 3: Client Email */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-slate-700 mb-2">
          ✉️ Email klienta <span className="text-slate-400 font-normal">(wklej z maila)</span>
        </label>
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="klient@firma.pl"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Email Preview Toggle */}
      <button
        onClick={() => setShowEmailPreview(!showEmailPreview)}
        className="text-xs text-emerald-600 hover:text-emerald-800 mb-3 flex items-center gap-1"
      >
        {showEmailPreview ? '▼ Ukryj podgląd maila' : '▶ Pokaż podgląd maila'}
      </button>

      {showEmailPreview && (
        <div className="mb-4 p-3 bg-white border border-slate-200 rounded-lg text-xs">
          <div className="font-bold text-slate-700 mb-1">Temat: {emailSubject}</div>
          <div className="whitespace-pre-wrap text-slate-600 text-[11px] leading-relaxed max-h-40 overflow-y-auto">
            {emailBody}
          </div>
          <div className="mt-2 text-emerald-600 font-medium">
            + Załącznik: zdjęcie z realizacji
          </div>
        </div>
      )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isArchived && (
              <button
                onClick={handleCompleteWithoutEmail}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? 'Zapisywanie...' : 'Zakończ bez maila'}
              </button>
            )}
        
        <button
          onClick={handleCompleteWithEmail}
          disabled={isSubmitting || completionImages.length === 0}
          className={`${isArchived ? 'w-full' : 'flex-1'} py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Wysyłanie...' : isArchived ? 'Wyślij prośbę o opinię' : 'Wyślij i zakończ'}
        </button>
      </div>

      {!isArchived && (
        <p className="text-[10px] text-slate-400 text-center mt-3">
          Po zakończeniu zlecenie zostanie przeniesione do Archiwum
        </p>
      )}
      
      {isArchived && (
          <p className="text-[10px] text-slate-400 text-center mt-3">
            Zlecenie jest już w Archiwum • możesz wysłać prośbę o opinię
          </p>
        )}
        </>
      )}
    </div>
  );
};

export default CompletionSection;
