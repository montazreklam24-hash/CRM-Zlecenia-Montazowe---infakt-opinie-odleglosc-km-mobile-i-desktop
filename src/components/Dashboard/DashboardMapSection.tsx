import React from 'react';
import { MapPin, Map as MapIcon, Layers } from 'lucide-react';
import MapBoardGoogle from '../MapBoardGoogle';
import MapBoardOSM from '../MapBoardOSM';
import { Job, JobColumnId } from '../../types';
import { jobsService } from '../../services/apiService';

interface DashboardMapSectionProps {
  mapProvider: 'GOOGLE' | 'OSM';
  setMapProvider: (v: 'GOOGLE' | 'OSM') => void;
  filteredJobs: Job[];
  onSelectJob: (job: Job) => void;
  loadJobs: () => void;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

export const DashboardMapSection: React.FC<DashboardMapSectionProps> = ({
  mapProvider,
  setMapProvider,
  filteredJobs,
  onSelectJob,
  loadJobs,
  setJobs
}) => {
  return (
    <div className="mt-4 theme-surface overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
      <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 flex justify-between items-center">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          MAPA ZLECEŃ
        </h3>
        <div className="flex gap-1 bg-white/20 p-1" style={{ borderRadius: 'var(--radius-md)' }}>
          <button 
            onClick={() => setMapProvider('GOOGLE')} 
            className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
            style={{ 
              borderRadius: 'var(--radius-sm)',
              background: mapProvider === 'GOOGLE' ? 'white' : 'transparent',
              color: mapProvider === 'GOOGLE' ? 'var(--accent-primary)' : 'white'
            }}
          >
            <MapIcon className="w-3 h-3" /> Google
          </button>
          <button 
            onClick={() => setMapProvider('OSM')} 
            className="px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
            style={{ 
              borderRadius: 'var(--radius-sm)',
              background: mapProvider === 'OSM' ? 'white' : 'transparent',
              color: mapProvider === 'OSM' ? 'var(--accent-primary)' : 'white'
            }}
          >
            <Layers className="w-3 h-3" /> OSM
          </button>
        </div>
      </div>
      <div className="p-2">
        {mapProvider === 'GOOGLE' ? (
          <MapBoardGoogle 
            jobs={filteredJobs} 
            onSelectJob={onSelectJob} 
            onJobsUpdated={loadJobs}
            onChangeColumn={async (jobId, newColumnId) => {
              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, columnId: newColumnId } : j));
              await jobsService.updateJobColumn(jobId, newColumnId, undefined);
            }}
          />
        ) : (
          <MapBoardOSM 
            jobs={filteredJobs} 
            onSelectJob={onSelectJob}
            onJobsUpdated={loadJobs}
          />
        )}
      </div>
    </div>
  );
};

