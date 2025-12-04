import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, CheckCircle2, Loader2, Camera, Save, Edit2, 
  ListTodo, Plus, Trash2, Copy, MessageSquare, Star, FileText,
  Download, X, GripVertical, Share2, Upload, ScanEye, ScrollText,
  Navigation, Phone, MapPin, ExternalLink
} from 'lucide-react';
import { Job, JobOrderData, JobStatus, UserRole, ChecklistItem } from '../types';
import { apiService } from '../services/apiService';

// Import Sub-Components
import { JobHeader } from './job/JobHeader';
import { JobAddress } from './job/JobAddress';
import { JobContact } from './job/JobContact';

interface JobCardProps {
  job?: Job;
  initialData?: JobOrderData;
  initialImages?: string[];
  role: UserRole;
  onBack: () => void;
  onJobSaved?: () => void;
}

declare global {
  interface Window {
    html2canvas: any;
  }
}

const JobCard: React.FC<JobCardProps> = ({ job, initialData, initialImages, role, onBack, onJobSaved }) => {
  const isAdmin = role === UserRole.ADMIN;
  const [isEditing, setIsEditing] = useState(!job);
  
  const normalizeData = (d: any): JobOrderData => ({
    ...d,
    locations: d.locations || [],
    scopeWorkText: d.scopeWorkText || (Array.isArray(d.scopeOfWork) ? d.scopeOfWork.join('\n') : ''),
    scopeWorkImages: d.scopeWorkImages || ''
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
  
  const cardRef = useRef<HTMLDivElement>(null);

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
      return newData;
    });
  };

  // Checklist Logic
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist(prev => [...prev, { id: Date.now().toString(), task: newChecklistItem, isChecked: false, addedBy: isAdmin ? 'Admin' : 'Pracownik' }]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = async (id: string) => {
    const newList = checklist.map(i => i.id === id ? { ...i, isChecked: !i.isChecked } : i);
    setChecklist(newList);
    if (!isEditing && job) {
      try { 
        await apiService.updateJob(job.id, { checklist: newList }); 
      } catch {}
    }
  };

  const removeChecklistItem = (id: string) => setChecklist(prev => prev.filter(i => i.id !== id));

  // Save Logic
  const handleSave = async () => {
    setIsProcessing(true);
    try {
      if (job) {
        await apiService.updateJob(job.id, { data: editedData, adminNotes, checklist, projectImages });
        alert('Zapisano!');
        setIsEditing(false);
      } else {
        await apiService.createJob(editedData, projectImages, undefined, adminNotes, checklist);
        if (onJobSaved) onJobSaved();
      }
    } catch (e) { 
      alert('Błąd zapisu'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleCompleteJob = async () => {
    if (!job) return;
    setIsProcessing(true);
    try {
      await apiService.completeJob(job.id, completionNotes, completionImages);
      alert('Raport wysłany!');
      onBack();
    } catch { 
      alert('Błąd zapisu raportu'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleCompletionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setCompletionImages(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const handleProjectImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setProjectImages(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const handleDuplicate = async () => {
    if (!job) return;
    if (window.confirm("Duplikować?")) {
      const newId = await apiService.duplicateJob(job.id);
      if (newId) { 
        alert("Zduplikowano!"); 
        onBack(); 
      }
    }
  };

  const handleSmartShare = async () => {
    if (!cardRef.current || !window.html2canvas) return;
    setIsProcessing(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        window.html2canvas(cardRef.current!, { useCORS: true, scale: 2, backgroundColor: '#f8fafc' })
          .then((canvas: HTMLCanvasElement) => {
            canvas.toBlob(resolve, 'image/png');
          });
      });

      if (!blob) {
        setIsProcessing(false);
        return;
      }
      
      const file = new File([blob], 'Zlecenie.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else { 
        const link = document.createElement('a'); 
        link.href = URL.createObjectURL(blob); 
        link.download = 'Karta.png'; 
        link.click(); 
      }
      setIsProcessing(false);
    } catch { 
      setIsProcessing(false); 
    }
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const jobUrl = `${baseUrl}?jobId=${job?.id || 'new'}`;
    const message = `🔧 *${editedData.jobTitle}*\n📍 ${editedData.address}\n📞 ${editedData.phoneNumber}\n\n🔗 ${jobUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const isPdf = (url: string) => url?.startsWith('data:application/pdf');
  
  const setCoverImage = async (index: number) => {
    const newImages = [...projectImages];
    const selected = newImages.splice(index, 1)[0];
    newImages.unshift(selected);
    setProjectImages(newImages);
    if (!isEditing && job) {
      try { 
        await apiService.updateJob(job.id, { projectImages: newImages }); 
      } catch {}
    }
  };

  const removeProjectImage = async (index: number) => {
    if (!window.confirm("Usunąć to zdjęcie?")) return;
    const newImages = projectImages.filter((_, i) => i !== index);
    setProjectImages(newImages);
    if (!isEditing && job) {
      try { 
        await apiService.updateJob(job.id, { projectImages: newImages }); 
      } catch {}
    }
  };

  // Helper to get image URL
  const getImageUrl = (img: string | { path: string }) => {
    if (typeof img === 'string') return img;
    return `/uploads/${img.path}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-40 px-0 sm:px-0 font-poppins">
      
      {/* LIGHTBOX */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-center items-center p-4 animate-fade-in">
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-8 h-8"/>
          </button>
          {isPdf(lightboxImage) ? (
            <iframe src={lightboxImage} className="w-full h-full bg-white rounded-xl" title="pdf"/>
          ) : (
            <img src={lightboxImage} className="max-h-full max-w-full object-contain shadow-2xl rounded-xl" alt="view"/>
          )}
        </div>
      )}

      {/* NAV BAR */}
      <div className="flex justify-between items-center mb-4 px-2 sticky top-16 z-30 py-3 bg-gradient-to-b from-slate-100 to-slate-100/80 backdrop-blur-sm">
        <button onClick={onBack} className="flex items-center text-gray-700 font-bold bg-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100">
          <ArrowLeft className="w-4 h-4 mr-2" /> Wróć
        </button>
        <div className="flex gap-2">
          {isAdmin && job && !isEditing && (
            <>
              <button onClick={handleDuplicate} className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-violet-500/20 transition-all">
                <Copy className="w-3.5 h-3.5 inline mr-1"/> Duplikuj
              </button>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">
                <Edit2 className="w-3.5 h-3.5" /> Edytuj
              </button>
            </>
          )}
          {isEditing && (
            <span className="text-xs bg-amber-400 text-amber-900 px-4 py-2.5 rounded-xl font-black uppercase shadow-sm">
              TRYB EDYCJI
            </span>
          )}
        </div>
      </div>

      {/* --- MAIN CARD --- */}
      <div ref={cardRef} className="bg-slate-50 w-full mx-auto shadow-xl overflow-hidden font-poppins rounded-2xl pb-10 border border-slate-200/50">
        
        <JobHeader job={job} friendlyId={job?.friendlyId || '#NEW'} createdAt={job?.createdAt || Date.now()} />

        <div className="p-5 space-y-4">
          {/* 1. TITLE SECTION */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            {isEditing ? (
              <input 
                value={editedData.jobTitle} 
                onChange={(e) => handleDataChange('jobTitle', e.target.value)} 
                className="w-full text-2xl font-black text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-xl p-3 focus:border-blue-500 focus:bg-white outline-none transition-all" 
                placeholder="NAZWA ZLECENIA" 
              />
            ) : (
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{editedData.jobTitle}</h1>
            )}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-2">NAZWA ZLECENIA</p>
          </div>

          {/* 2. ADDRESS SECTION */}
          <JobAddress 
            address={editedData.address} 
            locations={editedData.locations} 
            coordinates={editedData.coordinates}
            isEditing={isEditing} 
            onUpdateLocations={(locs) => handleDataChange('locations', locs)} 
            onUpdateAddress={(addr) => handleDataChange('address', addr)}
          />

          {/* 3. CONTACT SECTION */}
          <JobContact 
            phoneNumber={editedData.phoneNumber} 
            contactPerson={editedData.contactPerson} 
            clientName={editedData.clientName}
            isEditing={isEditing}
            onUpdate={handleDataChange}
          />

          {/* 4. AI ANALYSIS (ZAKRES PRAC) */}
          {(editedData.scopeWorkText || isEditing) && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 shadow-sm">
              <p className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-wide flex items-center gap-2">
                <ScrollText className="w-4 h-4" /> ZAKRES PRAC (Z MAILA/PDF)
              </p>
              {isEditing ? (
                <textarea 
                  value={editedData.scopeWorkText} 
                  onChange={(e) => handleDataChange('scopeWorkText', e.target.value)}
                  className="w-full min-h-[100px] bg-white border border-blue-200 rounded-xl p-4 text-sm text-gray-800 focus:border-blue-400 outline-none"
                  placeholder="Tutaj pojawi się treść wyciągnięta przez AI..."
                />
              ) : (
                <div className="prose prose-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{editedData.scopeWorkText || "Brak opisu."}</div>
              )}
            </div>
          )}

          {/* 5. AI IMAGE ANALYSIS */}
          {(editedData.scopeWorkImages || isEditing) && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-xl p-6 shadow-sm">
              <p className="text-xs font-bold text-violet-600 mb-3 uppercase tracking-wide flex items-center gap-2">
                <ScanEye className="w-4 h-4" /> ANALIZA TECHNICZNA ZAŁĄCZNIKÓW
              </p>
              {isEditing ? (
                <textarea 
                  value={editedData.scopeWorkImages} 
                  onChange={(e) => handleDataChange('scopeWorkImages', e.target.value)}
                  className="w-full min-h-[80px] bg-white border border-violet-200 rounded-xl p-4 text-sm text-gray-800 focus:border-violet-400 outline-none"
                  placeholder="Tu AI wpisze wymiary odczytane z rysunków..."
                />
              ) : (
                <div className="text-sm text-gray-800 italic">{editedData.scopeWorkImages || "Brak analizy technicznej."}</div>
              )}
            </div>
          )}

          {/* 6. ADMIN NOTES */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <p className="text-xs font-bold text-amber-700 mb-3 uppercase tracking-wide flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> UWAGI WEWNĘTRZNE
            </p>
            {isEditing ? (
              <textarea 
                value={adminNotes} 
                onChange={(e) => setAdminNotes(e.target.value)} 
                className="w-full min-h-[80px] bg-white text-gray-900 border border-amber-200 p-4 rounded-xl text-sm focus:border-amber-400 outline-none" 
                placeholder="Wpisz uwagi dla montażystów..." 
              />
            ) : (
              <p className="text-base font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">{adminNotes || 'Brak dodatkowych uwag.'}</p>
            )}
          </div>

          {/* 7. CHECKLIST */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ListTodo className="w-4 h-4" /> Checklista
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  <input 
                    value={newChecklistItem} 
                    onChange={(e) => setNewChecklistItem(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 outline-none" 
                    placeholder="Dodaj zadanie..." 
                  />
                  <button onClick={addChecklistItem} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {checklist.length === 0 && <p className="text-sm text-gray-400 italic">Brak zadań.</p>}
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border bg-slate-50 transition-colors hover:bg-white hover:border-blue-200">
                  <div 
                    onClick={() => toggleChecklistItem(item.id)} 
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                      item.isChecked 
                        ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30' 
                        : 'bg-white border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {item.isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`flex-1 text-sm font-medium ${item.isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.task}
                  </span>
                  {isEditing && (
                    <button onClick={() => removeChecklistItem(item.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 8. IMAGES (GALLERY) */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4" /> Pliki i Projekty
              </h3>
              {isEditing && (
                <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-100 transition-colors shadow-sm border border-blue-100">
                  <Plus className="w-4 h-4" /> DODAJ PLIKI
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleProjectImageUpload}/>
                </label>
              )}
            </div>

            {projectImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {projectImages.map((img, idx) => {
                  const imgUrl = getImageUrl(img);
                  return (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group bg-slate-50">
                      <div onClick={() => setLightboxImage(imgUrl)} className="w-full h-full cursor-zoom-in">
                        {isPdf(imgUrl) ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4 bg-gradient-to-br from-red-50 to-rose-50">
                            <FileText className="w-12 h-12 mb-2 text-red-400" />
                            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded shadow-sm text-red-600">PDF</span>
                          </div>
                        ) : (
                          <img src={imgUrl} className="w-full h-full object-cover" alt="attachment"/>
                        )}
                      </div>

                      {(isEditing || isAdmin) && (
                        <div className={`absolute inset-0 flex flex-col justify-between p-2 pointer-events-none transition-all duration-200 ${isEditing ? 'bg-black/10' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
                          <div className="flex justify-between pointer-events-auto">
                            <button 
                              onClick={(e) => {e.stopPropagation(); setCoverImage(idx)}} 
                              className={`p-2 rounded-lg shadow-md transition-all ${idx === 0 ? 'bg-amber-400 text-amber-900' : 'bg-white text-gray-400 hover:bg-amber-100 hover:text-amber-600'}`}
                              title="Ustaw jako okładkę"
                            >
                              <Star className={`w-5 h-5 ${idx === 0 ? 'fill-current' : ''}`} />
                            </button>
                            <button 
                              onClick={(e) => {e.stopPropagation(); removeProjectImage(idx)}} 
                              className="p-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition-all"
                              title="Usuń"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          {idx === 0 && (
                            <span className="bg-amber-400 text-amber-900 text-[10px] font-black text-center py-1.5 rounded-lg shadow-sm uppercase tracking-wider pointer-events-none">
                              Okładka
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-slate-50">
                <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Brak załączników.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="mt-8 px-4 space-y-4">
        {isAdmin && isEditing && (
          <button 
            onClick={handleSave} 
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-3 transition-all text-lg disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Save />} 
            ZAPISZ ZMIANY
          </button>
        )}
        
        {isAdmin && !isEditing && (
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleSmartShare} 
              disabled={isProcessing}
              className="py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <Download className="w-5 h-5" />} 
              Pobierz PNG
            </button>
            <button 
              onClick={handleWhatsAppShare}
              className="py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <Share2 className="w-5 h-5" /> 
              WhatsApp
            </button>
          </div>
        )}
        
        {/* WORKER COMPLETION */}
        {!isAdmin && !isEditing && job?.status !== JobStatus.COMPLETED && (
          <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-blue-500">
            <h3 className="font-bold text-xl text-slate-800 mb-4">Raport Montażowy</h3>
            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 focus:border-blue-400 outline-none" 
              value={completionNotes} 
              onChange={(e) => setCompletionNotes(e.target.value)} 
              placeholder="Opisz co zostało zrobione..." 
            />
            <label className="flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-xl mb-4 cursor-pointer hover:bg-slate-200 border-2 border-dashed border-slate-300 font-bold text-slate-600 transition-colors">
              <Camera className="w-5 h-5"/>
              <span>Dodaj Zdjęcia z Realizacji</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleCompletionImageUpload}/>
            </label>
            {completionImages.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {completionImages.map((img, i) => (
                  <img key={i} src={img} className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-md" alt="done"/>
                ))}
              </div>
            )}
            <button 
              onClick={handleCompleteJob} 
              disabled={isProcessing} 
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} 
              Zakończ Zlecenie
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobCard;
