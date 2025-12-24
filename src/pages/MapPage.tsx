import React, { useEffect, useState } from 'react';
import MapBoardGoogle from '../components/MapBoardGoogle';
import { jobsService } from '../services/apiService';
import { Job } from '../types';
import { RefreshCw, Radio } from 'lucide-react';

interface MapPageProps {
  onSelectJob: (job: Job) => void;
}

const MapPage: React.FC<MapPageProps> = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveRefresh, setLiveRefresh] = useState(false);

  const fetchJobs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await jobsService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs for map:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Broadcast zmian przez localStorage
  const broadcastChange = () => {
    localStorage.setItem('crm_last_change', Date.now().toString());
  };

  // Nasłuchuj zmian z innych okien
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crm_last_change' && e.newValue) {
        fetchJobs(true); // Silent refresh
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Live refresh polling
  useEffect(() => {
    if (!liveRefresh) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchJobs(true); // Silent refresh
      }
    }, 12000); // Co 12 sekund

    return () => clearInterval(interval);
  }, [liveRefresh]);

  useEffect(() => {
    fetchJobs();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Ładowanie mapy i zleceń...</div>;
  }

  return (
    <div className="h-[calc(100vh-100px)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Mapa Zleceń</h2>
        <div className="flex items-center gap-2">
          {/* Live Refresh Toggle */}
          <button
            onClick={() => setLiveRefresh(!liveRefresh)}
            className={`px-3 py-2 font-bold flex items-center gap-2 transition-all rounded-lg ${
              liveRefresh 
                ? 'bg-green-500 text-white shadow-md' 
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            title={liveRefresh ? 'Wyłącz live odświeżanie' : 'Włącz live odświeżanie'}
          >
            <Radio className={`w-4 h-4 ${liveRefresh ? 'fill-white' : ''}`} />
            <span className="text-xs">LIVE</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchJobs()}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 transition-all rounded-lg border border-slate-300 shadow-sm"
            title="Odśwież ręcznie"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs">Odśwież</span>
          </button>
        </div>
      </div>
      <MapBoardGoogle 
        jobs={jobs}
        onSelectJob={onSelectJob}
        onJobsUpdated={fetchJobs}
        onChangeColumn={async () => {}} 
      />
    </div>
  );
};

export default MapPage;


