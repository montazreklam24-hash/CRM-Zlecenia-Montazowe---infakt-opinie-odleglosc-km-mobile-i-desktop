import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Job, JobColumnId } from '../types';
import { Locate, Loader2 } from 'lucide-react';

interface MapBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onJobsUpdated: () => void;
  onChangeColumn: (jobId: string, newColumnId: JobColumnId) => void;
}

const COLUMN_COLORS: Record<string, string> = {
  PREPARE: '#475569', MON: '#f43f5e', TUE: '#10b981',     
  WED: '#8b5cf6', THU: '#f59e0b', FRI: '#3b82f6', COMPLETED: '#22c55e'
};

const COLUMN_NAMES: Record<string, string> = {
  PREPARE: 'PRZYG.', MON: 'PN', TUE: 'WT',
  WED: 'ŚR', THU: 'CZW', FRI: 'PT', COMPLETED: 'OK'
};

declare global {
  interface Window {
    google: any;
  }
}

// Komponent dymka z inteligentnym pozycjonowaniem
const SmartPopup = ({ job, position, onClose, onSelect, mapSize }: { job: Job, position: { x: number, y: number }, onClose: () => void, onSelect: () => void, mapSize: { width: number, height: number } }) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');

  useLayoutEffect(() => {
    if (!popupRef.current) return;
    
    const { width, height } = popupRef.current.getBoundingClientRect();
    const MARKER_HEIGHT = 40;
    const PADDING = 10;

    let top = position.y - height - PADDING; // Domyślnie nad markerem
    let left = position.x - (width / 2); // Wyśrodkowany
    let newPlacement: 'top' | 'bottom' = 'top';

    // Sprawdź czy mieści się u góry
    if (top < 0) {
      top = position.y + MARKER_HEIGHT + PADDING; // Pokaż pod markerem
      newPlacement = 'bottom';
    }

    // Sprawdź czy mieści się z lewej
    if (left < PADDING) {
      left = PADDING;
    }

    // Sprawdź czy mieści się z prawej
    if (left + width > mapSize.width - PADDING) {
      left = mapSize.width - width - PADDING;
    }

    setCoords({ top, left });
    setPlacement(newPlacement);
  }, [position, mapSize]);

  const color = COLUMN_COLORS[job.columnId || 'PREPARE'] || '#475569';
  const colName = COLUMN_NAMES[job.columnId || 'PREPARE'];
  const imgUrl = job.projectImages?.[0];

  return (
    <div 
      ref={popupRef}
      className="absolute bg-white rounded-lg shadow-xl border border-slate-200 z-50 pointer-events-auto flex flex-col"
      style={{ 
        top: coords.top, 
        left: coords.left,
        width: '180px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onMouseLeave={onClose}
    >
      {/* Zdjęcie */}
      <div className="p-2 pb-0">
        {imgUrl ? (
          <div 
            className="w-full aspect-square bg-cover bg-center rounded border border-slate-200"
            style={{ backgroundImage: `url('${imgUrl}')` }}
          />
        ) : (
          <div className="w-full aspect-square bg-slate-50 flex items-center justify-center rounded border border-slate-200 text-slate-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* Treść */}
      <div className="p-2">
        <div className="flex justify-between items-center mb-1">
          <span 
            className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
            style={{ backgroundColor: color }}
          >
            {colName}
          </span>
          <span className="text-[10px] font-semibold text-slate-500">
            {job.friendlyId}
          </span>
        </div>

        <h3 className="text-xs font-bold text-slate-900 leading-tight mb-1 line-clamp-2">
          {job.data.jobTitle || 'Bez nazwy'}
        </h3>
        
        <div className="text-[10px] text-slate-500 mb-2 truncate">
          📍 {job.data.address || 'Brak adresu'}
        </div>

        <div className="flex gap-1 mb-1">
          {job.data.address && (
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.data.address)}`}
              target="_blank"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
            >
              <span>🧭</span> Nawiguj
            </a>
          )}
          {job.data.phoneNumber && (
            <a 
              href={`tel:${job.data.phoneNumber}`}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
            >
              <span>📞</span> Zadzwoń
            </a>
          )}
        </div>

        <button 
          onClick={onSelect}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold py-1.5 rounded border border-slate-200 transition-colors"
        >
          Otwórz kartę
        </button>
      </div>

      {/* Strzałka */}
      <div 
        className="absolute w-3 h-3 bg-white border-l border-t border-slate-200 transform rotate-45"
        style={{
          left: '50%',
          marginLeft: '-6px',
          [placement === 'top' ? 'bottom' : 'top']: '-5px',
          [placement === 'top' ? 'borderTop' : 'borderBottom']: 'none',
          [placement === 'top' ? 'borderLeft' : 'borderRight']: 'none',
          backgroundColor: 'white',
          borderBottom: placement === 'top' ? '1px solid #e2e8f0' : 'none',
          borderRight: placement === 'top' ? '1px solid #e2e8f0' : 'none',
          borderTop: placement === 'bottom' ? '1px solid #e2e8f0' : 'none',
          borderLeft: placement === 'bottom' ? '1px solid #e2e8f0' : 'none',
        }}
      />
    </div>
  );
};

const MapBoardGoogle: React.FC<MapBoardProps> = ({ jobs, onSelectJob, onJobsUpdated, onChangeColumn }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlayRef = useRef<any>(null); // Helper do przeliczania współrzędnych

  // Stan dla dymka
  const [hoveredJob, setHoveredJob] = useState<Job | null>(null);
  const [popupPos, setPopupPos] = useState<{x: number, y: number} | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const [isLocating, setIsLocating] = useState(false);

  const handleLocateMe = () => {
    if (!googleMapRef.current) return;
    
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert('Twoja przeglądarka nie obsługuje geolokalizacji');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const pos = { lat: latitude, lng: longitude };
        
        googleMapRef.current.setCenter(pos);
        googleMapRef.current.setZoom(14);
        
        // Add user marker
        new window.google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          title: 'Twoja lokalizacja',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }
        });
        
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Nie udało się pobrać lokalizacji. Sprawdź uprawnienia GPS.');
        setIsLocating(false);
      }
    );
  };

  // Inicjalizacja mapy
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    if (!googleMapRef.current) {
      const mapOptions = {
        center: { lat: 52.2297, lng: 21.0122 }, // Warszawa
        zoom: 11,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        scrollwheel: false, // Disabled by default, enabled only with Ctrl
        gestureHandling: 'cooperative', // Shows message "Use Ctrl + scroll to zoom"
      };

      googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);

      // Fix Ctrl+Scroll behavior: Prevent browser page zoom so map can zoom
      const mapDiv = mapRef.current;
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault(); // Stop browser zoom
        }
      };
      
      // Use passive: false to allow preventDefault
      mapDiv.addEventListener('wheel', handleWheel, { passive: false });

      // Inicjalizacja OverlayView do konwersji LatLng -> Pixel
      const Overlay = new window.google.maps.OverlayView();
      Overlay.onAdd = function() {};
      Overlay.onRemove = function() {};
      Overlay.draw = function() {};
      Overlay.setMap(googleMapRef.current);
      overlayRef.current = Overlay;

      // Obsługa zmiany rozmiaru mapy
      const updateSize = () => {
        if (mapRef.current) {
          setMapSize({ 
            width: mapRef.current.offsetWidth, 
            height: mapRef.current.offsetHeight 
          });
        }
      };
      
      updateSize();
      window.addEventListener('resize', updateSize);
      
      // Nasłuchiwanie zmian bounds/zoomu żeby zamknąć popup lub go przesunąć (dla uproszczenia zamykamy)
      googleMapRef.current.addListener('bounds_changed', () => {
        setHoveredJob(null);
      });
    }
  }, []);

  // Aktualizacja pinezek
  useEffect(() => {
    if (!googleMapRef.current || !jobs) return;

    // Wyczyść stare pinezki
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidMarkers = false;

    jobs.forEach(async (job) => {
      let position: { lat: number; lng: number } | null = null;

      if (job.data.coordinates && job.data.coordinates.lat && job.data.coordinates.lng) {
        position = job.data.coordinates;
      } else if (job.data.address && job.data.address.length > 5) {
        const geocoder = new window.google.maps.Geocoder();
        try {
          const result = await geocoder.geocode({ address: job.data.address });
          if (result.results && result.results[0]) {
            const location = result.results[0].geometry.location;
            position = { lat: location.lat(), lng: location.lng() };
          }
        } catch (e) {}
      }

      if (position) {
        const color = COLUMN_COLORS[job.columnId || 'PREPARE'] || '#475569';
        
        const svgMarker = {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 1.5,
          strokeColor: "#FFFFFF",
          rotation: 0,
          scale: 1.8,
          anchor: new window.google.maps.Point(12, 24),
        };

        const marker = new window.google.maps.Marker({
          position: position,
          map: googleMapRef.current,
          icon: svgMarker,
          title: job.data.jobTitle || job.friendlyId,
          // animation: window.google.maps.Animation.DROP // Wyłączamy animację drop przy każdym odświeżeniu, bo irytuje
        });

        const handleHover = () => {
          if (overlayRef.current) {
            const projection = overlayRef.current.getProjection();
            if (projection) {
              const pixel = projection.fromLatLngToContainerPixel(marker.getPosition());
              setPopupPos({ x: pixel.x, y: pixel.y });
              setHoveredJob(job);
            }
          }
        };

        marker.addListener('mouseover', handleHover);
        marker.addListener('click', handleHover); // Dla mobile

        markersRef.current.push(marker);
        bounds.extend(position);
        hasValidMarkers = true;
      }
    });

    // Dopasuj mapę tylko przy pierwszym załadowaniu lub dużej zmianie (opcjonalne)
    // Tu zostawiamy logikę "fitBounds" tylko jeśli to pierwsze ładowanie lub użytkownik wymusi
    if (hasValidMarkers && googleMapRef.current && markersRef.current.length > 0 && !googleMapRef.current.getBounds()) {
       googleMapRef.current.fitBounds(bounds);
    }

  }, [jobs]);

  return (
    <div className="w-full h-[500px] bg-slate-100 rounded-xl overflow-hidden shadow-inner relative border border-slate-200 isolate">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Custom Popup Layer */}
      {hoveredJob && popupPos && (
        <SmartPopup 
          job={hoveredJob}
          position={popupPos}
          mapSize={mapSize}
          onClose={() => setHoveredJob(null)}
          onSelect={() => onSelectJob(hoveredJob)}
        />
      )}

      {!window.google && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
          <p className="text-slate-500">Ładowanie mapy Google...</p>
        </div>
      )}
      
      {/* Ctrl hint overlay */}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md pointer-events-none z-20">
        Ctrl + scroll = zoom
      </div>

      {/* Locate Me Button */}
      <button
        onClick={handleLocateMe}
        disabled={isLocating}
        className="absolute bottom-6 right-14 z-10 p-3 bg-white text-slate-700 rounded-lg shadow-md hover:bg-slate-50 active:bg-slate-100 disabled:opacity-70 transition-colors"
        title="Moja lokalizacja"
      >
        {isLocating ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        ) : (
          <Locate className="w-6 h-6" />
        )}
      </button>
    </div>
  );
};

export default MapBoardGoogle;
