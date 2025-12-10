import React, { useMemo } from 'react';
import { Job } from '../types';

interface JobPlaceholderProps {
  job?: Job;
  title?: string;
  clientName?: string;
  className?: string;
  jobId?: number; // do generowania koloru
  size?: 'small' | 'medium' | 'large';
}

const JobPlaceholder: React.FC<JobPlaceholderProps> = ({ 
  job, 
  title, 
  clientName, 
  className = '', 
  jobId = 0,
  size = 'medium'
}) => {
  // 1. ADRES (Priorytet: Ulica)
  const rawAddress = job?.data?.address || '';
  // Weź tylko ulicę (przed przecinkiem) lub nazwę klienta jeśli brak adresu
  const street = rawAddress.split(',')[0].trim() || job?.data?.clientName || clientName || 'Zlecenie';

  // 2. TREŚĆ (Priorytet: Zakres Prac -> Tytuł -> Notatki)
  // User request: "ogólny opis zlecenia tak żeby się zmieścił"
  let description = job?.data?.scopeWorkText || job?.data?.jobTitle || title || '';
  
  // Jeśli brak opisu, spróbuj notatki
  if (!description && job?.adminNotes) {
    description = job.adminNotes;
  }
  
  // Oczyść tekst (usuń nowe linie, nadmiar spacji) dla lepszego wyświetlania
  description = description.replace(/\s+/g, ' ').trim();

  // Jeśli opis jest bardzo krótki, a są notatki, dodaj je
  if (description.length < 30 && job?.adminNotes && !description.includes(job.adminNotes)) {
     description += ` • ⚠️ ${job.adminNotes}`;
  }

  // ID jest stringiem w Job ('24' lub '#2024/001') -> konwersja na number dla koloru
  const numericId = job?.id ? parseInt(job.id.replace(/\D/g, '') || '0') : jobId || 0;

  // Generuj stabilny kolor na podstawie ID zlecenia
  const gradientClass = useMemo(() => {
    const gradients = [
      'from-blue-600 to-blue-400',
      'from-emerald-600 to-emerald-400',
      'from-orange-500 to-amber-500',
      'from-violet-600 to-purple-500',
      'from-pink-600 to-rose-400',
      'from-cyan-600 to-sky-400',
      'from-indigo-600 to-indigo-400',
      'from-teal-600 to-teal-400'
    ];
    // Użyj reszty z dzielenia
    const index = numericId ? numericId % gradients.length : Math.floor(Math.random() * gradients.length);
    return gradients[index];
  }, [numericId]);

  // Rozmiary tekstu zależne od size
  const streetSize = size === 'small' ? 'text-[10px]' : 'text-sm';
  const descSize = size === 'small' ? 'text-[9px]' : 'text-xs';
  const maxLines = size === 'small' ? 'line-clamp-3' : 'line-clamp-4';

  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradientClass} p-2 flex flex-col text-white ${className}`}>
      {/* Góra: Ulica / Główny identyfikator */}
      <div className={`font-black uppercase tracking-tight ${streetSize} leading-tight drop-shadow-md mb-1 break-words`}>
        {street}
      </div>
      
      {/* Dół: Opis czynności */}
      <div className={`${descSize} leading-tight opacity-90 font-medium ${maxLines} break-words overflow-hidden`}>
        {description}
      </div>
    </div>
  );
};

export default JobPlaceholder;
