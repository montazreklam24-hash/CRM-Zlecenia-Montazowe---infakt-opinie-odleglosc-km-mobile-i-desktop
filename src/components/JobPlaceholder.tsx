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
  // Dane z obiektu job mają priorytet (są w job.data)
  const displayTitle = job?.data?.jobTitle || title || 'Zlecenie';
  const displayClient = job?.data?.clientName || clientName || 'Klient';
  
  // ID jest stringiem w Job ('24' lub '#2024/001') -> konwersja na number dla koloru
  const numericId = job?.id ? parseInt(job.id.replace(/\D/g, '') || '0') : jobId || 0;

  // Generuj stabilny kolor na podstawie ID zlecenia
  const gradientClass = useMemo(() => {
    const gradients = [
      'from-blue-500 to-cyan-400',
      'from-emerald-500 to-teal-400',
      'from-orange-500 to-amber-400',
      'from-purple-500 to-pink-400',
      'from-indigo-500 to-blue-400',
      'from-rose-500 to-red-400',
    ];
    // Użyj reszty z dzielenia, lub losowo jeśli brak ID
    const index = numericId ? numericId % gradients.length : Math.floor(Math.random() * gradients.length);
    return gradients[index];
  }, [numericId]);

  // Rozmiary tekstu zależne od size
  const titleSize = size === 'small' ? 'text-xs' : 'text-sm';
  const clientSize = size === 'small' ? 'text-[10px]' : 'text-xs';

  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradientClass} p-3 flex flex-col justify-between text-white ${className}`}>
      <div className={`font-bold ${titleSize} line-clamp-2 leading-tight drop-shadow-md`}>
        {displayTitle}
      </div>
      <div className={`${clientSize} opacity-90 truncate font-medium drop-shadow-sm`}>
        {displayClient}
      </div>
    </div>
  );
};

export default JobPlaceholder;
