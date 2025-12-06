import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, X, Type, Sparkles } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface InputFormProps {
  onSubmit: (title: string, text: string, images: string[]) => void;
  isProcessing: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isProcessing }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);

  // Paste support (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const newFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type === 'application/pdf') {
          const file = items[i].getAsFile();
          if (file) newFiles.push(file);
        }
      }

      if (newFiles.length > 0) {
        processFiles(newFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // PDF to images conversion
  const convertPdfToImages = async (file: File): Promise<string[]> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const extractedImages: string[] = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          extractedImages.push(canvas.toDataURL('image/jpeg', 0.8));
        }
      }
      return extractedImages;
    } catch (error) {
      console.error("PDF conversion error:", error);
      return [];
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    setIsConvertingPdf(true);
    const newImages: string[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf') {
        const pdfImages = await convertPdfToImages(file);
        if (pdfImages.length > 0) {
          newImages.push(...pdfImages);
        } else {
          // Fallback: add as base64 PDF
          const reader = new FileReader();
          await new Promise<void>((resolve) => {
            reader.onloadend = () => {
              newImages.push(reader.result as string);
              resolve();
            };
            reader.readAsDataURL(file);
          });
        }
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onloadend = () => {
            newImages.push(reader.result as string);
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
    }

    setImages(prev => [...prev, ...newImages]);
    setIsConvertingPdf(false);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || "Do analizy...";
    if (!text.trim() && images.length === 0) return;
    onSubmit(finalTitle, text, images);
  };

  const isPdf = (dataUrl: string) => dataUrl.startsWith('data:application/pdf');
  const canSubmit = (text.trim().length > 0 || images.length > 0) && !isConvertingPdf;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            Nowe Zlecenie
          </h2>
          <p className="text-slate-400 text-sm mt-1">Wklej treść maila i załączniki - AI wypełni resztę</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Job Title */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Type className="w-4 h-4 text-blue-500" />
              NAZWA ZLECENIA
              <span className="text-slate-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-lg font-medium"
              placeholder="AI wygeneruje tytuł jeśli zostawisz puste..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Email Text */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Treść wątku Gmail / opis zlecenia
            </label>
            <textarea
              rows={6}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 resize-none transition-all"
              placeholder="Wklej tutaj skopiowany wątek mailowy lub opisz zlecenie..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* File Dropzone */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Załączniki (PDF, zdjęcia projektów)
            </label>
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive 
                  ? "border-orange-500 bg-orange-50" 
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                accept="image/*,application/pdf" 
                multiple 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={handleFileChange} 
              />
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
                  <Upload className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-orange-600">Kliknij</span>, wklej (Ctrl+V) lub przeciągnij
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isConvertingPdf 
                      ? <span className="text-orange-600 font-semibold animate-pulse">Konwertuję PDF na zdjęcia...</span> 
                      : "PDF zostanie automatycznie rozpakowany na strony"
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Image previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4">
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square group bg-white shadow-sm"
                  >
                    {isPdf(img) ? (
                      <div className="flex flex-col items-center justify-center w-full h-full bg-slate-50 p-2">
                        <FileText className="w-8 h-8 text-red-400 mb-1" />
                        <span className="text-[8px] font-bold text-slate-500">PDF</span>
                      </div>
                    ) : (
                      <img src={img} alt="preview" className="w-full h-full object-cover" />
                    )}
                    
                    <button 
                      type="button" 
                      onClick={() => removeImage(idx)} 
                      className="absolute top-1 right-1 p-1.5 bg-red-500 rounded-lg text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-1 font-medium">
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isProcessing || !canSubmit}
            className={`w-full py-4 px-6 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-3 ${
              isProcessing || !canSubmit 
                ? "bg-slate-300 cursor-not-allowed" 
                : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/25 active:scale-[0.98]"
            }`}
          >
            {isProcessing || isConvertingPdf ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> 
                <span>AI analizuje dane...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> 
                <span>Generuj Kartę Zlecenia</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputForm;



