import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Job, JobColumnId } from '../types';
import L from 'leaflet';
import { jobsService } from '../services/apiService';
import { Loader2, Navigation, Phone } from 'lucide-react';

// Custom marker icons for different statuses
const createCustomIcon = (colorClass: string, label: string) => {
    let hexColor = '#3b82f6';
    if (colorClass.includes('rose')) hexColor = '#f43f5e';
    if (colorClass.includes('red')) hexColor = '#ef4444';
    if (colorClass.includes('emerald')) hexColor = '#10b981';
    if (colorClass.includes('violet')) hexColor = '#8b5cf6';
    if (colorClass.includes('purple')) hexColor = '#a855f7';
    if (colorClass.includes('amber')) hexColor = '#f59e0b';
    if (colorClass.includes('yellow')) hexColor = '#eab308';
    if (colorClass.includes('orange')) hexColor = '#f97316';
    if (colorClass.includes('blue')) hexColor = '#3b82f6';
    if (colorClass.includes('green')) hexColor = '#22c55e';
    if (colorClass.includes('slate')) hexColor = '#64748b';

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${hexColor}" stroke="white" stroke-width="1.5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>`;

    return L.divIcon({
        className: 'custom-icon',
        html: `<div class="relative w-8 h-8 hover:scale-110 transition-transform cursor-pointer group drop-shadow-lg">
                 ${svg}
                 <span class="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-[9px] font-bold px-2 py-1 rounded-lg shadow-lg z-50 text-slate-700 border border-slate-200 whitespace-nowrap tracking-tight opacity-0 group-hover:opacity-100 transition-opacity">${label}</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

const COLUMN_COLORS: Record<string, string> = {
  PREPARE: 'slate',
  ANYTIME: 'slate',
  MON: 'rose',
  TUE: 'emerald',
  WED: 'violet',
  THU: 'amber',
  FRI: 'blue',
  SAT: 'orange',
  SUN: 'amber',
  COMPLETED: 'green'
};

const COLUMN_NAMES: Record<string, string> = {
  PREPARE: 'DO PRZYGOTOWANIA',
  ANYTIME: 'DOWOLNY TERMIN',
  MON: 'PONIEDZIAŁEK',
  TUE: 'WTOREK',
  WED: 'ŚRODA',
  THU: 'CZWARTEK',
  FRI: 'PIĄTEK',
  SAT: 'SOBOTA',
  SUN: 'NIEDZIELA',
  COMPLETED: 'WYKONANE'
};

interface MapBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onJobsUpdated: () => void;
}

// Auto-fit map to markers
const MapBounds: React.FC<{ jobs: Job[] }> = ({ jobs }) => {
    const map = useMap();
    useEffect(() => {
        const markers = jobs
            .filter(j => j.data.coordinates)
            .map(j => [j.data.coordinates!.lat, j.data.coordinates!.lng] as [number, number]);
        if (markers.length > 0) {
            const bounds = L.latLngBounds(markers);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [jobs, map]);
    return null;
};

const MapBoard: React.FC<MapBoardProps> = ({ jobs, onSelectJob, onJobsUpdated }) => {
  const [geocodingQueue, setGeocodingQueue] = useState<Job[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Initialize geocoding queue for jobs without coordinates
  useEffect(() => {
    const toGeocode = jobs.filter(j => 
        !j.data.coordinates && 
        j.data.address && 
        j.data.address.length > 3 && 
        j.status !== 'ARCHIVED'
    );
    if (toGeocode.length > 0) {
        setGeocodingQueue(toGeocode);
    }
  }, [jobs]);

  // Geocoding queue processor
  useEffect(() => {
    if (geocodingQueue.length === 0 || isGeocoding) return;

    const processQueue = async () => {
        setIsGeocoding(true);
        const job = geocodingQueue[0];
        
        try {
            let queryAddress = job.data.address;
            if (!queryAddress.toLowerCase().includes('polska') && !queryAddress.toLowerCase().includes('poland')) {
                queryAddress += ", Polska";
            }

            console.log(`Geocoding: ${queryAddress}...`);
            
            const params = new URLSearchParams({
                format: 'json',
                limit: '1',
                addressdetails: '1',
                countrycodes: 'pl',
                q: queryAddress
            });

            const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
                headers: {
                    'User-Agent': 'MontazReklam24-CRM/2.0',
                    'Accept-Language': 'pl-PL'
                }
            });

            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                
                // Update job with coordinates
                await jobsService.updateJob(job.id, {
                    data: { ...job.data, coordinates: { lat, lng } }
                });
                
                onJobsUpdated();
            } else {
                console.warn("Address not found:", queryAddress);
            }
        } catch (e) {
            console.error("Geocoding error:", e);
        } finally {
            setGeocodingQueue(prev => prev.slice(1));
            setTimeout(() => setIsGeocoding(false), 1500);
        }
    };

    processQueue();
  }, [geocodingQueue, isGeocoding, onJobsUpdated]);

  const defaultCenter: [number, number] = [52.0693, 19.4803];

  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden h-[600px] relative animate-fade-in z-0">
        <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {jobs.map(job => {
                if (!job.data.coordinates) return null;
                const colorClass = COLUMN_COLORS[job.columnId || 'PREPARE'];
                const statusLabel = COLUMN_NAMES[job.columnId || 'PREPARE'];
                
                const rawTitle = job.data.jobTitle || job.friendlyId || '#';
                const titleLabel = rawTitle.length > 20 ? rawTitle.substring(0, 18) + '...' : rawTitle;
                
                return (
                    <Marker 
                        key={job.id} 
                        position={[job.data.coordinates.lat, job.data.coordinates.lng]}
                        icon={createCustomIcon(colorClass, titleLabel)}
                        eventHandlers={{
                            click: () => onSelectJob(job)
                        }}
                    >
                        <Popup>
                            <div className="font-sans min-w-[200px]">
                                <div className="font-bold text-sm text-slate-800 mb-1">{job.data.jobTitle || 'Bez Nazwy'}</div>
                                <div className="text-xs text-slate-500 mb-3">{job.data.address}</div>
                                
                                <div className="flex gap-2 mb-3">
                                    <span className={`text-[10px] font-bold text-white px-2 py-1 rounded-lg bg-${colorClass}-500`}>
                                        {statusLabel}
                                    </span>
                                </div>
                                
                                <div className="flex gap-2">
                                    {job.data.address && (
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.data.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600"
                                        >
                                            <Navigation className="w-3 h-3" />
                                            Nawiguj
                                        </a>
                                    )}
                                    {job.data.phoneNumber && (
                                        <a
                                            href={`tel:${job.data.phoneNumber}`}
                                            className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600"
                                        >
                                            <Phone className="w-3 h-3" />
                                            Zadzwoń
                                        </a>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            <MapBounds jobs={jobs} />
        </MapContainer>

        {/* Geocoding progress indicator */}
        {geocodingQueue.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-4 py-3 rounded-xl shadow-xl z-[500] flex items-center gap-3 border border-blue-100">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div className="text-xs">
                    <p className="font-bold text-slate-800">Aktualizuję mapę ({geocodingQueue.length})...</p>
                    <p className="text-slate-500 max-w-[200px] truncate">{geocodingQueue[0].data.address}</p>
                </div>
            </div>
        )}
    </div>
  );
};

export default MapBoard;

