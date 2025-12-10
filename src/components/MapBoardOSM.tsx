import React, { useEffect, useRef } from 'react';
import { Job } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapBoardOSMProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
}

const COLUMN_COLORS: Record<string, string> = {
  PREPARE: '#475569', MON: '#f43f5e', TUE: '#10b981',     
  WED: '#8b5cf6', THU: '#f59e0b', FRI: '#3b82f6', COMPLETED: '#22c55e'
};

const COLUMN_NAMES: Record<string, string> = {
  PREPARE: 'PRZYG.', MON: 'PN', TUE: 'WT',
  WED: 'ŚR', THU: 'CZW', FRI: 'PT', COMPLETED: 'OK'
};

const MapBoardOSM: React.FC<MapBoardOSMProps> = ({ jobs, onSelectJob }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false // Disable by default
    }).setView([52.2297, 21.0122], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;
    
    // Enable scroll zoom only with Ctrl key
    const container = mapContainerRef.current;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        map.scrollWheelZoom.enable();
      } else {
        map.scrollWheelZoom.disable();
      }
    };
    
    const handleKeyUp = () => {
      map.scrollWheelZoom.disable();
    };
    
    container.addEventListener('wheel', handleWheel, { passive: true });
    document.addEventListener('keyup', handleKeyUp);
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keyup', handleKeyUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    const bounds = L.latLngBounds([]);

    jobs.forEach(job => {
      if (!job.data.coordinates) return;
      const { lat, lng } = job.data.coordinates;
      const color = COLUMN_COLORS[job.columnId || 'PREPARE'] || '#475569';
      const colName = COLUMN_NAMES[job.columnId || 'PREPARE'];

      const svgIcon = L.divIcon({
        className: '',
        html: `<div style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">
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
      const imgUrl = job.projectImages?.[0];
      const imgHtml = imgUrl 
        ? `<div style="width:100%;aspect-ratio:1/1;background-image:url('${imgUrl}');background-size:cover;background-position:center;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0;"></div>`
        : `<div style="width:100%;aspect-ratio:1/1;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;

      const popupContent = document.createElement('div');
      popupContent.className = 'custom-popup-card';
      popupContent.style.width = '160px';
      popupContent.innerHTML = `
        ${imgHtml}
        <div style="padding:0 2px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="background:${color};color:white;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;text-transform:uppercase;">${colName}</span>
            <span style="font-size:9px;color:#64748b;font-weight:600;">${job.friendlyId}</span>
          </div>
          <h3 style="margin:0 0 4px 0;font-size:12px;font-weight:800;line-height:1.3;color:#0f172a;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${job.data.jobTitle || 'Bez nazwy'}</h3>
          <div style="font-size:10px;color:#475569;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ${job.data.address || 'Brak'}</div>
          <div style="display:flex;gap:4px;margin-top:8px;">
            ${job.data.address ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.data.address)}" target="_blank" style="flex:1;background:#3b82f6;color:white;text-decoration:none;font-size:10px;font-weight:700;text-align:center;padding:6px 0;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px;">🧭 Nawiguj</a>` : ''}
            ${job.data.phoneNumber ? `<a href="tel:${job.data.phoneNumber}" style="flex:1;background:#22c55e;color:white;text-decoration:none;font-size:10px;font-weight:700;text-align:center;padding:6px 0;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px;">📞 Zadzwoń</a>` : ''}
          </div>
          <button class="btn-open" style="width:100%;margin-top:4px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-size:10px;font-weight:700;padding:6px 0;border-radius:6px;cursor:pointer;">Otwórz kartę</button>
        </div>
      `;

      popupContent.querySelector('.btn-open')?.addEventListener('click', () => onSelectJob(job));

      marker.bindPopup(popupContent);
      marker.on('mouseover', function (this: L.Marker) { this.openPopup(); });
      // marker.on('mouseout', function (e) { this.closePopup(); }); // Opcjonalnie: zamykanie po zjechaniu

      markersLayerRef.current?.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [jobs]);

  return (
    <div className="relative">
      <div ref={mapContainerRef} className="w-full h-[500px] z-0 bg-slate-100" />
      {/* Ctrl hint overlay */}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md pointer-events-none">
        Ctrl + scroll = zoom
      </div>
    </div>
  );
};

export default MapBoardOSM;
