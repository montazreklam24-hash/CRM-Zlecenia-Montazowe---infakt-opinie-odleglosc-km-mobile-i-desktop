import React, { useEffect, useRef, useState } from 'react';
import { Job, JobStatus, PaymentStatus } from '../../types';
import { ArrowLeft, Navigation, Phone, X, Locate, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import JobPlaceholder from '../JobPlaceholder';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MobileMapViewProps {
  jobs: Job[];
  onBack: () => void;
  onOpenJob: (job: Job) => void;
}

// Payment status colors for markers
const getMarkerColor = (status: PaymentStatus | undefined): string => {
  switch (status) {
    case PaymentStatus.PAID: return '#22c55e';
    case PaymentStatus.PROFORMA: return '#f97316';
    case PaymentStatus.PARTIAL: return '#a855f7';
    case PaymentStatus.CASH: return '#eab308';
    case PaymentStatus.OVERDUE: return '#ef4444';
    default: return '#3b82f6';
  }
};

// Create custom marker icon
const createMarkerIcon = (color: string, number: number) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">${number}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const MobileMapView: React.FC<MobileMapViewProps> = ({ jobs, onBack, onOpenJob }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  const handleLocateMe = () => {
    if (!mapRef.current) return;
    
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert('Twoja przeglądarka nie obsługuje geolokalizacji');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const latLng = new L.LatLng(latitude, longitude);
        
        mapRef.current?.setView(latLng, 13);
        
        // Update or create user marker
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(latLng);
        } else {
          const userIcon = L.divIcon({
            className: 'bg-transparent border-none',
            html: `
              <div class="relative flex items-center justify-center w-6 h-6">
                <div class="absolute w-full h-full bg-blue-500/30 rounded-full animate-ping"></div>
                <div class="relative w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm"></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          
          userMarkerRef.current = L.marker(latLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(mapRef.current!);
        }
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Nie udało się pobrać lokalizacji. Sprawdź uprawnienia GPS.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Filter jobs with coordinates
  const jobsWithCoords = jobs.filter(j => 
    j.status !== JobStatus.ARCHIVED && 
    j.data.coordinates?.lat && 
    j.data.coordinates?.lng
  );

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Default to Warsaw center
    const defaultCenter: L.LatLngExpression = [52.2297, 21.0122];
    
    // Initialize map with proper scroll/zoom settings
    const map = L.map(mapContainer.current, {
      center: defaultCenter,
      zoom: 11,
      zoomControl: false, // Hide default zoom control
      scrollWheelZoom: true, // Enable scroll wheel zoom
      dragging: true, // Enable dragging
      touchZoom: true, // Enable touch zoom (pinch)
      doubleClickZoom: true, // Enable double-click zoom
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    // Add markers for each job
    const markers: L.Marker[] = [];
    
    jobsWithCoords.forEach((job, index) => {
      if (!job.data.coordinates) return;
      
      const { lat, lng } = job.data.coordinates;
      const color = getMarkerColor(job.paymentStatus);
      const icon = createMarkerIcon(color, index + 1);
      
      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedJob(job);
        });
      
      markers.push(marker);
    });

    // Close card on map background click
    map.on('click', () => {
      setSelectedJob(null);
    });

    // Fit bounds if there are markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    setIsLoading(false);

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [jobsWithCoords]);

  // Format address
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

  // Format phone
  const formatPhone = (phone: string | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/[\s-]/g, '');
    const match = cleaned.match(/^(\+48)?(\d{9})$/);
    if (match) {
      const num = match[2];
      return `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 9)}`;
    }
    return phone;
  };

  const { street, city } = selectedJob ? formatAddress(selectedJob.data.address) : { street: '', city: '' };
  const phone = selectedJob ? formatPhone(selectedJob.data.phoneNumber) : '';

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-900 text-white p-3 flex items-center gap-3 shadow-lg z-20">
        <button
          onClick={onBack}
          className="p-2 bg-slate-800 rounded-lg active:bg-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Mapa zleceń</h1>
          <p className="text-xs text-slate-400">
            {jobsWithCoords.length} zleceń na mapie
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        
        {/* Locate Me Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute top-4 right-4 z-[400] p-3 bg-white text-slate-700 rounded-xl shadow-lg active:scale-95 disabled:opacity-70"
        >
          {isLocating ? (
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          ) : (
            <Locate className="w-6 h-6" />
          )}
        </button>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm">Ładowanie mapy...</p>
            </div>
          </div>
        )}

        {/* No coordinates warning */}
        {!isLoading && jobsWithCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
            <div className="text-center text-white p-6">
              <p className="text-lg font-bold mb-2">Brak zleceń na mapie</p>
              <p className="text-sm text-slate-400">
                Zlecenia muszą mieć uzupełnione współrzędne GPS
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Selected Job Card */}
      {selectedJob && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-30 animate-slide-up">
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
          
          {/* Close button */}
          <button
            onClick={() => setSelectedJob(null)}
            className="absolute top-3 right-3 p-2 bg-slate-100 rounded-full"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          {/* Content */}
          <div className="px-4 pb-4">
            {/* Thumbnail + Title */}
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
                <h3 className="font-bold text-slate-900 line-clamp-1">
                  {selectedJob.data.jobTitle || 'Bez nazwy'}
                </h3>
                <p className="text-sm text-slate-600">{street}</p>
                {city && <p className="text-xs text-slate-400">{city}</p>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.data.coordinates?.lat},${selectedJob.data.coordinates?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white font-bold rounded-xl active:bg-blue-600"
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

      {/* Map Legend */}
      <div className="absolute top-16 left-3 bg-white/90 backdrop-blur rounded-lg shadow-lg p-2 z-20 text-[10px]">
        <div className="font-bold text-slate-700 mb-1">Legenda:</div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" /> Opłacone
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-500" /> Proforma
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500" /> Barter
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" /> Do zapłaty
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMapView;
