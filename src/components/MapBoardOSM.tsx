import React, { useEffect, useRef, useState } from 'react';
import { Job } from '../types';
import { getJobThumbnailUrl } from '../utils/imageUtils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';

// Fix icons for Vite/Bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Override default icon URLs for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: icon,
    iconRetinaUrl: icon2x,
    shadowUrl: iconShadow,
});

interface MapBoardOSMProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onJobsUpdated?: () => void;
}

const COLUMN_COLORS: Record<string, string> = {
  PREPARE: '#475569', MON: '#f43f5e', TUE: '#10b981',     
  WED: '#8b5cf6', THU: '#f59e0b', FRI: '#3b82f6', COMPLETED: '#22c55e'
};

const COLUMN_NAMES: Record<string, string> = {
  PREPARE: 'PRZYG.', MON: 'PN', TUE: 'WT',
  WED: 'ŚR', THU: 'CZW', FRI: 'PT', COMPLETED: 'OK'
};

// Geokodowanie przez Nominatim (OSM)
const geocodeWithNominatim = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Polska')}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CRM-MontazReklam24'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Nominatim HTTP error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error('❌ Geocoding error:', error);
  }
  return null;
};

const MapBoardOSM: React.FC<MapBoardOSMProps> = ({ jobs, onSelectJob, onJobsUpdated }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedJobForList, setSelectedJobForList] = useState<Job | null>(null);
  const [jobsWithCoords, setJobsWithCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    console.log('🗺️ MapBoardOSM: Inicjalizacja mapy');
    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false // Disable by default
    }).setView([52.2297, 21.0122], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    setMapReady(true);
    
    // Enable scroll zoom only with Ctrl key
    const container = mapContainerRef.current;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault(); // Prevent browser zoom
        map.scrollWheelZoom.enable();
      } else {
        map.scrollWheelZoom.disable();
      }
    };
    
    const handleKeyUp = () => {
      map.scrollWheelZoom.disable();
    };
    
    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keyup', handleKeyUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Geokodowanie zleceń bez współrzędnych
  useEffect(() => {
    let isMounted = true;

    const geocodeJobs = async () => {
      // Najpierw dodaj wszystkie istniejące współrzędne
      const coordsToAdd = new Map<string, { lat: number; lng: number }>();
      
      for (const job of jobs) {
        if (job.data.coordinates) {
          coordsToAdd.set(job.id, job.data.coordinates);
        }
      }

      // Zaktualizuj state jednorazowo dla wszystkich istniejących współrzędnych
      if (coordsToAdd.size > 0 && isMounted) {
        setJobsWithCoords(prev => {
          const updated = new Map(prev);
          let hasChanges = false;
          coordsToAdd.forEach((coords, jobId) => {
            if (!updated.has(jobId)) {
              updated.set(jobId, coords);
              hasChanges = true;
            }
          });
          console.log('📍 MapBoardOSM: Załadowano współrzędne z danych', { count: coordsToAdd.size });
          return hasChanges ? updated : prev;
        });
      }

      // Następnie geokoduj brakujące adresy (po kolei z opóźnieniem)
      for (const job of jobs) {
        if (!isMounted) break;
        
        if (!job.data.coordinates && job.data.address) {
          // Sprawdź czy już nie mamy w cache
          let alreadyHas = false;
          setJobsWithCoords(prev => {
            alreadyHas = prev.has(job.id);
            return prev;
          });
          
          if (alreadyHas) continue;

          // Opóźnienie dla rate limiting Nominatim
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const coords = await geocodeWithNominatim(job.data.address);
          
          if (coords && isMounted) {
            setJobsWithCoords(prev => {
              const updated = new Map(prev);
              updated.set(job.id, coords);
              return updated;
            });

            // Zapisz do API w tle
            fetch(`/api/jobs.php/${job.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: { coordinates: coords }
              })
            }).catch(e => console.error('❌ Nie udało się zapisać współrzędnych:', e));
          }
        }
      }
    };

    if (jobs.length > 0) {
      geocodeJobs();
    }

    return () => {
      isMounted = false;
    };
  }, [jobs]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) {
      return;
    }

    markersLayerRef.current.clearLayers();
    const bounds = L.latLngBounds([]);

    console.log('🗺️ Renderowanie markerów:', {
      total: jobs.length,
      withCoords: jobs.filter(j => j.data.coordinates || jobsWithCoords.get(j.id)).length
    });

    let markersAdded = 0;
    jobs.forEach(job => {
      // Użyj współrzędnych z cache lub z job.data
      const coords = job.data.coordinates || jobsWithCoords.get(job.id);
      if (!coords) {
        return;
      }
      
      const lat = Number(coords.lat);
      const lng = Number(coords.lng);

      if (isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Nieprawidłowe współrzędne:', { jobId: job.id, coords });
        return;
      }
      
      markersAdded++;
      
      const color = COLUMN_COLORS[job.columnId || 'PREPARE'] || '#475569';
      const colName = COLUMN_NAMES[job.columnId || 'PREPARE'];

      const svgIcon = L.divIcon({
        className: 'custom-marker-icon',
        html: `<div style="display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([lat, lng], { icon: svgIcon });

      // Card Style Popup
      const imgUrl = getJobThumbnailUrl(job.projectImages?.[0]);
      const imgHtml = imgUrl 
        ? `<div style="width:100%;aspect-ratio:1/1;background-image:url('${imgUrl}');background-size:cover;background-position:center;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0;"></div>`
        : `<div style="width:100%;aspect-ratio:1/1;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;

      const popupContent = document.createElement('div');
      popupContent.className = 'custom-popup-card';
      popupContent.style.width = '160px';
      
      const jobTitle = job.data?.jobTitle || 'Bez nazwy';
      const address = job.data?.address || 'Brak adresu';
      const phoneNumber = job.data?.phoneNumber;
      
      popupContent.innerHTML = `
        ${imgHtml}
        <div style="padding:0 2px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="background:${color};color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;text-transform:uppercase;">${colName}</span>
            <span style="font-size:9px;color:#64748b;font-weight:600;">${job.friendlyId || ''}</span>
          </div>
          <h3 style="margin:0 0 4px 0;font-size:12px;font-weight:800;line-height:1.3;color:#0f172a;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${jobTitle}</h3>
          <div style="font-size:10px;color:#475569;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ${address}</div>
          <div style="display:flex;gap:4px;margin-top:8px;">
            ${address && address !== 'Brak adresu' ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}" target="_blank" style="flex:1;background:#3b82f6;color:white;text-decoration:none;font-size:10px;font-weight:700;text-align:center;padding:6px 0;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px;">🧭 Nawiguj</a>` : ''}
            ${phoneNumber ? `<a href="tel:${phoneNumber}" style="flex:1;background:#22c55e;color:white;text-decoration:none;font-size:10px;font-weight:700;text-align:center;padding:6px 0;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px;">📞 Zadzwoń</a>` : ''}
          </div>
          <button class="btn-open" style="width:100%;margin-top:4px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-size:10px;font-weight:700;padding:6px 0;border-radius:6px;cursor:pointer;">Otwórz kartę</button>
        </div>
      `;

      popupContent.querySelector('.btn-open')?.addEventListener('click', () => onSelectJob(job));
      
      // Blokuj wheel events na popupie, żeby nie powiększał strony
      popupContent.addEventListener('wheel', (e) => {
        e.stopPropagation();
      }, { passive: true });

      marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoPan: false  // Wyłączamy autoPan Leafleta, bo robimy własne centrowanie panTo
      });
      
      const handleInteraction = function(this: L.Marker) {
        this.openPopup();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(this.getLatLng());
        }
      };

      marker.on('mouseover', handleInteraction);
      marker.on('click', handleInteraction);
      marker.on('mouseout', function (this: L.Marker) { this.closePopup(); }); // Zamknij po zjechaniu myszką

      markersLayerRef.current?.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    console.log('✅ Dodano markerów:', markersAdded);

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [jobs, jobsWithCoords, mapReady]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen().then(() => {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 100);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleRefresh = () => {
    if (onJobsUpdated) {
      onJobsUpdated();
    }
  };

  const visibleJobs = jobs.filter(job => {
    const coords = job.data.coordinates || jobsWithCoords.get(job.id);
    return !!coords;
  });

  return (
    <div className="relative flex gap-4">
      {/* Panel listy zleceń */}
      <div className="w-64 flex-shrink-0 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-800 text-white px-4 py-2 font-bold text-sm">
          Zlecenia na mapie ({visibleJobs.length})
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {visibleJobs.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">Brak zleceń z adresami</div>
          ) : (
            visibleJobs.map(job => {
              const color = COLUMN_COLORS[job.columnId || 'PREPARE'] || '#475569';
              const colName = COLUMN_NAMES[job.columnId || 'PREPARE'];
              const imgUrl = getJobThumbnailUrl(job.projectImages?.[0]);
              const isSelected = selectedJobForList?.id === job.id;
              
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJobForList(job);
                    onSelectJob(job);
                    // Centruj mapę na markerze
                    const coords = job.data.coordinates || jobsWithCoords.get(job.id);
                    if (coords && mapInstanceRef.current) {
                      mapInstanceRef.current.panTo([coords.lat, coords.lng]);
                    }
                  }}
                  className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex gap-2">
                    {imgUrl && (
                      <img 
                        src={imgUrl} 
                        alt="" 
                        className="w-12 h-12 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <span 
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: color }}
                        >
                          {colName}
                        </span>
                        <span className="text-[9px] text-slate-500 font-semibold">
                          {job.friendlyId}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                        {job.data.jobTitle || 'Bez nazwy'}
                      </h4>
                      <div className="text-[10px] text-slate-600 truncate">
                        📍 {job.data.address?.split(',')[0] || 'Brak'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="w-full h-[500px] z-0 bg-slate-100 rounded-lg overflow-hidden" />
        
        {/* Controls */}
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <button
            onClick={handleRefresh}
            className="bg-white hover:bg-slate-50 text-slate-700 p-2 rounded-lg shadow-md transition-colors"
            title="Odśwież"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="bg-white hover:bg-slate-50 text-slate-700 p-2 rounded-lg shadow-md transition-colors"
            title={isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Ctrl hint overlay */}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md pointer-events-none z-10">
          Ctrl + scroll = zoom
        </div>
      </div>
    </div>
  );
};

export default MapBoardOSM;
