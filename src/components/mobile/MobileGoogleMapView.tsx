import React, { useEffect, useRef, useState } from 'react';
import { Job, JobStatus, PaymentStatus } from '../../types';
import { ArrowLeft, Navigation, Phone, X, Locate, Loader2 } from 'lucide-react';
import JobPlaceholder from '../JobPlaceholder';

interface MobileGoogleMapViewProps {
  jobs: Job[];
  onBack: () => void;
  onOpenJob: (job: Job) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

// Kolory markerów (skopiowane z MapBoardGoogle)
const COLUMN_COLORS: Record<string, string> = {
  PREPARE: '#475569', MON: '#f43f5e', TUE: '#10b981',     
  WED: '#8b5cf6', THU: '#f59e0b', FRI: '#3b82f6', COMPLETED: '#22c55e'
};

const MobileGoogleMapView: React.FC<MobileGoogleMapViewProps> = ({ jobs, onBack, onOpenJob }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filtruj zlecenia z koordynatami
  const jobsWithCoords = jobs.filter(j => 
    j.status !== JobStatus.ARCHIVED && 
    j.data.coordinates?.lat && 
    j.data.coordinates?.lng
  );

  // Inicjalizacja mapy
  useEffect(() => {
    if (!mapRef.current || !window.google) {
        // Jeśli Google API nie załadowane, spróbuj za chwilę (choć powinno być w index.html)
        if (!window.google) setIsLoading(true);
        return;
    }

    if (!googleMapRef.current) {
      const mapOptions = {
        center: { lat: 52.2297, lng: 21.0122 }, // Warszawa
        zoom: 11,
        mapId: 'MOBILE_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false, // Własne sterowanie lub gesty
        clickableIcons: false,
        gestureHandling: 'greedy', // Na mobile chcemy żeby mapa przejmowała dotyk od razu
      };

      googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
      setIsLoading(false);

      // Trigger resize after a short delay to fix rendering issues on PC browsers
      setTimeout(() => {
        if (window.google && window.google.maps && googleMapRef.current) {
          window.google.maps.event.trigger(googleMapRef.current, 'resize');
        }
      }, 500);

      // Kliknięcie w tło mapy zamyka kartę
      googleMapRef.current.addListener('click', () => {
        setSelectedJob(null);
      });
    }
  }, []);

  // Aktualizacja markerów
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Wyczyść stare
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidMarkers = false;

    jobsWithCoords.forEach((job) => {
      const position = job.data.coordinates;
      if (!position) return;

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
      });

      // Obsługa kliknięcia w marker
      marker.addListener('click', (e: any) => {
        if (e && e.stop) e.stop(); 
        
        setSelectedJob(job);
        
        // Zgodnie z zasadami repo: ZAWSZE środkuj mapę na markerze
        // Na mobile przesuwamy marker nieco do góry (panBy(0, 150)), 
        // bo na dole wyskakuje karta o wysokości ok. 300px.
        if (googleMapRef.current && position) {
          googleMapRef.current.panTo(position);
          setTimeout(() => {
            googleMapRef.current.panBy(0, 150); // Przesuwa marker do góry
          }, 100);
        }
      });

      markersRef.current.push(marker);
      bounds.extend(position);
      hasValidMarkers = true;
    });

    // Fit bounds tylko przy pierwszym załadowaniu lub dużej zmianie
    if (hasValidMarkers && !selectedJob) {
       googleMapRef.current.fitBounds(bounds);
    }

  }, [jobsWithCoords, selectedJob]);

  // Lokalizacja użytkownika
  const handleLocateMe = () => {
    if (!googleMapRef.current) return;
    
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert('Brak wsparcia geolokalizacji');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { 
          lat: position.coords.latitude, 
          lng: position.coords.longitude 
        };
        
        googleMapRef.current.setCenter(pos);
        googleMapRef.current.setZoom(14);
        
        if (userMarkerRef.current) userMarkerRef.current.setMap(null);

        userMarkerRef.current = new window.google.maps.Marker({
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
        console.error(error);
        alert('Błąd lokalizacji');
        setIsLocating(false);
      }
    );
  };

  // Helpery do formatowania (skopiowane z MobileMapView)
  const formatAddress = (address: string | undefined): { street: string; city: string } => {
    if (!address) return { street: 'Brak adresu', city: '' };
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const street = parts[0];
      let city = parts[1].replace(/\d{2}-\d{3}\s*/g, '').trim();
      return { street, city };
    }
    return { street: address, city: '' };
  };

  const formatPhone = (phone: string | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/[\s-]/g, '');
    const match = cleaned.match(/^(\+48)?(\d{9})$/);
    if (match) return `${match[2].slice(0, 3)} ${match[2].slice(3, 6)} ${match[2].slice(6, 9)}`;
    return phone;
  };

  const { street, city } = selectedJob ? formatAddress(selectedJob.data.address) : { street: '', city: '' };
  const phone = selectedJob ? formatPhone(selectedJob.data.phoneNumber) : '';

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-900 text-white p-3 flex items-center gap-3 shadow-lg z-20">
        <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg active:bg-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Mapa Google</h1>
          <p className="text-xs text-slate-400">{jobsWithCoords.length} zleceń</p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        
        {/* Locate Me */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute top-4 right-4 z-[10] p-3 bg-white text-slate-700 rounded-xl shadow-lg active:scale-95 disabled:opacity-70"
        >
          {isLocating ? <Loader2 className="w-6 h-6 animate-spin text-orange-500" /> : <Locate className="w-6 h-6" />}
        </button>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
            <p className="text-white text-sm">Ładowanie mapy...</p>
          </div>
        )}
      </div>

      {/* Selected Job Card (identyczna jak w MobileMapView) */}
      {selectedJob && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-30 animate-slide-up">
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
          <button
            onClick={() => setSelectedJob(null)}
            className="absolute top-3 right-3 p-2 bg-slate-100 rounded-full"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          <div className="px-4 pb-4">
            <div className="flex gap-3 mb-3" onClick={() => onOpenJob(selectedJob)}>
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                {selectedJob.projectImages?.[0] ? (
                  <img src={selectedJob.projectImages[0]} className="w-full h-full object-cover" alt="" loading="lazy" />
                ) : (
                  <JobPlaceholder job={selectedJob} size="small" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 font-medium">{selectedJob.friendlyId}</p>
                <h3 className="font-bold text-slate-900 line-clamp-1">{selectedJob.data.jobTitle || 'Bez nazwy'}</h3>
                <p className="text-sm text-slate-600">{street}</p>
                {city && <p className="text-xs text-slate-400">{city}</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.data.coordinates?.lat},${selectedJob.data.coordinates?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold rounded-xl active:bg-orange-600"
              >
                <Navigation className="w-5 h-5" />
                NAWIGUJ
              </a>
              
              {phone ? (
                <a
                  href={`tel:${selectedJob.data.phoneNumber}`}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white font-bold rounded-xl active:bg-green-600"
                >
                  <Phone className="w-5 h-5" />
                  ZADZWOŃ
                </a>
              ) : (
                <button
                  onClick={() => onOpenJob(selectedJob)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold rounded-xl active:bg-orange-600"
                >
                  OTWÓRZ
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileGoogleMapView;
