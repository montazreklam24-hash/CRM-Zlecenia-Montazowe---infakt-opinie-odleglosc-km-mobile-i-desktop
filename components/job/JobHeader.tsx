import React from 'react';
import { Calendar } from 'lucide-react';
import { Job } from '../../types';

interface JobHeaderProps {
  job?: Job;
  friendlyId: string;
  createdAt: number;
}

export const JobHeader: React.FC<JobHeaderProps> = ({ job, friendlyId, createdAt }) => {
  return (
    <div className="bg-[#1a1f2e] px-6 py-5 flex justify-between items-center border-b-4 border-[#e58e35]">
      <div className="text-white">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
          NUMER ZLECENIA
        </div>
        <div className="text-4xl font-black tracking-tight text-white">
          {friendlyId || '#NEW'}
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 text-[#e58e35] font-bold text-sm">
          <Calendar className="w-4 h-4" />
          {new Date(createdAt || Date.now()).toLocaleDateString('pl-PL')}
        </div>
      </div>
    </div>
  );
};