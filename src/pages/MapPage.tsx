import React, { useEffect, useState } from 'react';
import MapBoardGoogle from '../components/MapBoardGoogle';
import { jobsService } from '../services/apiService';
import { Job } from '../types';

interface MapPageProps {
  onSelectJob: (job: Job) => void;
}

const MapPage: React.FC<MapPageProps> = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await jobsService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs for map:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Ładowanie mapy i zleceń...</div>;
  }

  return (
    <div className="h-[calc(100vh-100px)]">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Mapa Zleceń</h2>
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


