import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Job, JobColumnId } from '../types';
import L from 'leaflet';
import { apiService } from '../services/apiService';
import { Loader2, MapPin, Phone, ExternalLink } from 'lucide-react';

// Ikony dla różnych statusów
const createCustomIcon = (colorClass: string, label: string) => {
  let hexColor = '#3b82f6';
  if (colorClass.includes('rose')) hexColor = '#e11d48';
  if (colorClass.includes('red')) hexColor = '#dc2626';
  if (colorClass.includes('emerald')) hexColor = '#059669';
  if (colorClass.includes('violet')) hexColor = '#7c3aed';
  if (colorClass.includes('purple')) hexColor = '#7c3aed';
  if (colorClass.includes('amber')) hexColor = '#d97706';
  if (colorClass.includes('yellow')) hexColor = '#eab308';
  if (colorClass.includes('orange')) hexColor = '#f97316';
  if (colorClass.includes('green')) hexColor = '#16a34a';
  if (colorClass.includes('gray')) hexColor = '#6b7280';
  if (colorClass.includes('slate')) hexColor = '#475569';
  if (colorClass.includes('blue')) hexColor = '#2563eb';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${hexColor}" stroke="white" stroke-width="1.5">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3" fill="white"></circle>
  </svg>`;

  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="relative w-8 h-8 hover:scale-110 transition-transform cursor-pointer group" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
             ${svg}
             <span class="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg z-50 text-gray-800 border border-gray-100 whitespace-nowrap tracking-tight opacity-0 group-hover:opacity-100 transition-opacity">${label}</span>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const COLUMN_COLORS: Record<string, string> = {
  PREPARE: 'slate',
  ANYTIME: 'gray',
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

const COLUMN_GRADIENTS: Record<string, string> = {
  PREPARE: 'from-slate-500 to-slate-700',
  ANYTIME: 'from-gray-400 to-gray-600',
  MON: 'from-rose-500 to-rose-700',
  TUE: 'from-emerald-500 to-emerald-700',
  WED: 'from-violet-500 to-violet-700',
  THU: 'from-amber-400 to-amber-600',
  FRI: 'from-blue-500 to-blue-700',
  SAT: 'from-orange-400 to-orange-600',
  SUN: 'from-amber-700 to-amber-900',
  COMPLETED: 'from-green-600 to-green-800'
};

interface MapBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onJobsUpdated: () => void;
}

// Komponent do automatycznego dopasowania widoku do pinezek
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

  // Inicjalizacja kolejki geokodowania
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

  // Procesor kolejki geokodowania
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

        console.log(`Geokodowanie: ${queryAddress}...`);
        
        const params = new URLSearchParams({
          format: 'json',
          limit: '1',
          addressdetails: '1',
          countrycodes: 'pl',
          q: queryAddress
        });

        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: {
            'User-Agent': 'MontazReklam24-CRM/1.0',
            'Accept-Language': 'pl-PL'
          }
        });

        const data = await response.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          
          await apiService.updateJob(job.id, { 
            data: { ...job.data, coordinates: { lat, lng } } 
          });
          
          onJobsUpdated();
        } else {
          console.warn("Nie znaleziono adresu:", queryAddress);
        }
      } catch (e) {
        console.error("Błąd geokodowania:", e);
      } finally {
        setGeocodingQueue(prev => prev.slice(1));
        setTimeout(() => setIsGeocoding(false), 1500);
      }
    };

    processQueue();
  }, [geocodingQueue, isGeocoding, onJobsUpdated]);

  const defaultCenter: [number, number] = [52.0693, 19.4803];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden h-[650px] relative animate-fade-in z-0">
      <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {jobs.map(job => {
          if (!job.data.coordinates) return null;
          const colorClass = COLUMN_COLORS[job.columnId || 'PREPARE'];
          const statusLabel = COLUMN_NAMES[job.columnId || 'PREPARE'];
          const gradient = COLUMN_GRADIENTS[job.columnId || 'PREPARE'];
          
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
              <Popup className="font-poppins">
                <div className="min-w-[200px]">
                  <div className="font-bold text-sm text-gray-900 mb-1">{job.data.jobTitle || 'Bez Nazwy'}</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <MapPin className="w-3 h-3 text-orange-500" />
                    {job.data.address}
                  </div>
                  {job.data.phoneNumber && (
                    <a 
                      href={`tel:${job.data.phoneNumber}`} 
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-3"
                    >
                      <Phone className="w-3 h-3" />
                      {job.data.phoneNumber}
                    </a>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg bg-gradient-to-r ${gradient}`}>
                      {statusLabel}
                    </span>
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.data.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Nawiguj <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapBounds jobs={jobs} />
      </MapContainer>

      {/* Info Box o geokodowaniu */}
      {geocodingQueue.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl z-[500] flex items-center gap-3 border border-blue-100">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div className="text-xs">
            <p className="font-bold text-gray-900">Aktualizuję mapę ({geocodingQueue.length})...</p>
            <p className="text-gray-500 max-w-[200px] truncate">{geocodingQueue[0].data.address}</p>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg z-[500] border border-gray-100">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Legenda</p>
        <div className="space-y-1">
          {Object.entries(COLUMN_NAMES).slice(0, 5).map(([key, name]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${COLUMN_GRADIENTS[key]}`}></div>
              <span className="text-[10px] text-gray-600">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapBoard;
