import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Job, JobColumnId } from '../types';
import L from 'leaflet';
import { jobsService } from '../services/apiService';
import { Loader2, Navigation, Phone, Box } from 'lucide-react';

// Column configuration
const COLUMNS: { id: JobColumnId; name: string; shortName: string; color: string }[] = [
  { id: 'PREPARE', name: 'DO PRZYGOTOWANIA', shortName: 'PRZYG.', color: '#475569' },
  { id: 'MON', name: 'PONIEDZIAŁEK', shortName: 'PN', color: '#f43f5e' },
  { id: 'TUE', name: 'WTOREK', shortName: 'WT', color: '#10b981' },
  { id: 'WED', name: 'ŚRODA', shortName: 'ŚR', color: '#8b5cf6' },
  { id: 'THU', name: 'CZWARTEK', shortName: 'CZW', color: '#f59e0b' },
  { id: 'FRI', name: 'PIĄTEK', shortName: 'PT', color: '#3b82f6' },
  { id: 'COMPLETED', name: 'WYKONANE', shortName: 'OK', color: '#22c55e' },
];

const COLUMN_COLORS: Record<string, string> = {
  PREPARE: '#475569',
  MON: '#f43f5e',
  TUE: '#10b981',
  WED: '#8b5cf6',
  THU: '#f59e0b',
  FRI: '#3b82f6',
  COMPLETED: '#22c55e'
};

// Custom marker icons
const createCustomIcon = (color: string, label: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>`;

  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="relative w-8 h-8 hover:scale-125 transition-transform cursor-pointer drop-shadow-lg" style="z-index: 1000;">
             ${svg}
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

interface MapBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onJobsUpdated: () => void;
  onChangeColumn?: (jobId: string, columnId: JobColumnId) => void;
}

// Auto-fit map to markers with smart zoom
const MapBounds: React.FC<{ jobs: Job[] }> = ({ jobs }) => {
  const map = useMap();
  useEffect(() => {
    const markers = jobs
      .filter(j => j.data.coordinates)
      .map(j => [j.data.coordinates!.lat, j.data.coordinates!.lng] as [number, number]);
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers);
      // Fit bounds with padding, max zoom 15 (city level), min zoom 5 (country)
      map.fitBounds(bounds, { 
        padding: [60, 60],
        maxZoom: 15,  // Nie za blisko nawet dla jednej pinezki
        animate: true
      });
    } else {
      // Default: Poland view
      map.setView([52.0693, 19.4803], 6);
    }
  }, [jobs, map]);
  return null;
};

// Ctrl+Scroll zoom handler
const CtrlScrollZoom: React.FC<{ onShowHint: () => void }> = ({ onShowHint }) => {
  const map = useMap();
  
  useEffect(() => {
    const container = map.getContainer();
    
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd held - allow zoom
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) {
          // Scroll up = zoom in
          map.zoomIn(1);
        } else {
          // Scroll down = zoom out
          map.zoomOut(1);
        }
      } else {
        // No Ctrl - show hint and let page scroll
        onShowHint();
      }
    };
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [map, onShowHint]);
  
  return null;
};

const MapBoard: React.FC<MapBoardProps> = ({ jobs, onSelectJob, onJobsUpdated, onChangeColumn }) => {
  const [geocodingQueue, setGeocodingQueue] = useState<Job[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [hoveredJob, setHoveredJob] = useState<Job | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ job: Job; x: number; y: number } | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollHintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Show scroll hint temporarily
  const handleShowScrollHint = () => {
    setShowScrollHint(true);
    if (scrollHintTimeout.current) {
      clearTimeout(scrollHintTimeout.current);
    }
    scrollHintTimeout.current = setTimeout(() => {
      setShowScrollHint(false);
    }, 2000);
  };

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
          
          await jobsService.updateJob(job.id, {
            data: { ...job.data, coordinates: { lat, lng } }
          });
          
          onJobsUpdated();
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

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, job: Job) => {
    e.preventDefault();
    setContextMenu({ job, x: e.clientX, y: e.clientY });
  };

  const handleChangeColumn = async (columnId: JobColumnId) => {
    if (contextMenu && onChangeColumn) {
      await onChangeColumn(contextMenu.job.id, columnId);
      setContextMenu(null);
    }
  };

  const defaultCenter: [number, number] = [52.0693, 19.4803];

  return (
    <div 
      ref={mapContainerRef}
      className="theme-surface overflow-hidden relative animate-fade-in z-0"
      style={{ borderRadius: 'var(--radius-lg)', height: '70vh', minHeight: '500px' }}
    >
      <MapContainer 
        center={defaultCenter} 
        zoom={6} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CtrlScrollZoom onShowHint={handleShowScrollHint} />
        
        {jobs.map(job => {
          if (!job.data.coordinates) return null;
          const color = COLUMN_COLORS[job.columnId || 'PREPARE'] || '#475569';
          const rawTitle = job.data.jobTitle || job.friendlyId || '#';
          const titleLabel = rawTitle.length > 25 ? rawTitle.substring(0, 23) + '...' : rawTitle;
          
          return (
            <Marker 
              key={job.id} 
              position={[job.data.coordinates.lat, job.data.coordinates.lng]}
              icon={createCustomIcon(color, titleLabel)}
              eventHandlers={{
                click: () => onSelectJob(job),
                contextmenu: (e) => {
                  const event = e.originalEvent as MouseEvent;
                  event.preventDefault();
                  setContextMenu({ job, x: event.clientX, y: event.clientY });
                },
                mouseover: (e) => {
                  const event = e.originalEvent as MouseEvent;
                  setHoveredJob(job);
                  setHoverPosition({ x: event.clientX, y: event.clientY });
                },
                mouseout: () => {
                  setHoveredJob(null);
                  setHoverPosition(null);
                }
              }}
            >
              <Popup>
                <div className="font-sans min-w-[200px]">
                  <div className="font-bold text-sm text-slate-800 mb-1">{job.data.jobTitle || 'Bez Nazwy'}</div>
                  <div className="text-xs text-slate-500 mb-3">{job.data.address}</div>
                  
                  <div className="flex gap-2 mb-3">
                    <span 
                      className="text-[10px] font-bold text-white px-2 py-1 rounded"
                      style={{ background: color }}
                    >
                      {COLUMNS.find(c => c.id === (job.columnId || 'PREPARE'))?.name || 'NIEZNANY'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {job.data.address && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.data.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600"
                      >
                        <Navigation className="w-3 h-3" />
                        Nawiguj
                      </a>
                    )}
                    {job.data.phoneNumber && (
                      <a
                        href={`tel:${job.data.phoneNumber}`}
                        className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600"
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

      {/* Scroll hint */}
      {showScrollHint && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div 
            className="px-4 py-3 text-sm font-medium animate-fade-in"
            style={{ 
              background: 'rgba(0,0,0,0.75)', 
              color: 'white', 
              borderRadius: 'var(--radius-lg)',
              backdropFilter: 'blur(4px)'
            }}
          >
            Użyj <kbd className="px-2 py-0.5 mx-1 bg-white/20 rounded text-xs">Ctrl</kbd> + scroll aby przybliżyć/oddalić
          </div>
        </div>
      )}

      {/* Hover Preview - Card with photo - smart positioning */}
      {hoveredJob && hoverPosition && mapContainerRef.current && (() => {
        const mapRect = mapContainerRef.current.getBoundingClientRect();
        const cardWidth = 140; // Taka sama szerokość jak w kolumnach
        const cardHeight = 220;
        const padding = 10;
        
        // Calculate position relative to map container
        let left = hoverPosition.x - mapRect.left + padding;
        let top = hoverPosition.y - mapRect.top - cardHeight / 2;
        
        // Keep card within map bounds
        if (left + cardWidth > mapRect.width - padding) {
          left = hoverPosition.x - mapRect.left - cardWidth - padding;
        }
        if (left < padding) left = padding;
        if (top < padding) top = padding;
        if (top + cardHeight > mapRect.height - padding) {
          top = mapRect.height - cardHeight - padding;
        }
        
        return (
          <div 
            className="absolute z-[10000] pointer-events-none animate-fade-in"
            style={{ left, top, width: cardWidth }}
          >
            <div className="theme-card shadow-2xl overflow-hidden">
              {/* Square Image */}
              <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                {hoveredJob.projectImages?.[0] ? (
                  <img 
                    src={hoveredJob.projectImages[0]} 
                    className="w-full h-full object-cover" 
                    alt="" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Box className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
                {/* Job ID badge */}
                <div 
                  className="absolute bottom-1 right-1 text-[7px] font-medium px-1 py-0.5 backdrop-blur-sm" 
                  style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.9)', borderRadius: '2px' }}
                >
                  {hoveredJob.friendlyId}
                </div>
              </div>
              {/* Info */}
              <div className="p-2">
                <div className="font-bold text-[10px] line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>
                  {hoveredJob.data.jobTitle || 'Bez nazwy'}
                </div>
                <div className="text-[8px] truncate mb-1" style={{ color: 'var(--text-secondary)' }}>
                  📍 {hoveredJob.data.address?.split(',')[0] || 'Brak adresu'}
                </div>
                {hoveredJob.data.phoneNumber && (
                  <div className="text-[9px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    📞 {hoveredJob.data.phoneNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Context Menu - Change Column - smart positioning */}
      {contextMenu && mapContainerRef.current && (() => {
        const mapRect = mapContainerRef.current.getBoundingClientRect();
        const menuWidth = 160;
        const menuHeight = 280; // approx height
        const padding = 10;
        
        // Calculate position relative to map
        let left = contextMenu.x - mapRect.left;
        let top = contextMenu.y - mapRect.top;
        
        // Keep within bounds
        if (left + menuWidth > mapRect.width - padding) {
          left = mapRect.width - menuWidth - padding;
        }
        if (top + menuHeight > mapRect.height - padding) {
          top = mapRect.height - menuHeight - padding;
        }
        if (left < padding) left = padding;
        if (top < padding) top = padding;
        
        return (
        <div 
          className="absolute z-[10001] theme-card shadow-2xl py-1 min-w-[160px]"
          style={{ 
            left: left, 
            top: top,
            borderRadius: 'var(--radius-md)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Przenieś do:
          </div>
          {COLUMNS.map(col => (
            <button
              key={col.id}
              onClick={() => handleChangeColumn(col.id)}
              className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-black/5 transition-colors"
              style={{ 
                color: 'var(--text-primary)',
                background: contextMenu.job.columnId === col.id ? 'var(--bg-surface)' : 'transparent'
              }}
            >
              <span 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: col.color }}
              />
              {col.shortName}
              {contextMenu.job.columnId === col.id && (
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>✓</span>
              )}
            </button>
          ))}
        </div>
        );
      })()}

      {/* Geocoding progress indicator */}
      {geocodingQueue.length > 0 && (
        <div className="absolute bottom-4 left-4 theme-card px-4 py-3 shadow-xl z-[500] flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <div className="text-xs">
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Aktualizuję mapę ({geocodingQueue.length})...</p>
            <p className="max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>{geocodingQueue[0].data.address}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapBoard;
