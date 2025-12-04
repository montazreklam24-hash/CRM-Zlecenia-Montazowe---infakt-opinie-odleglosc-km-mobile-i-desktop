
import React from 'react';
import { Navigation, Plus, AlertTriangle, MapPin } from 'lucide-react';
import { JobLocation } from '../../types';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface JobAddressProps {
  address: string;
  locations: JobLocation[];
  coordinates?: { lat: number; lng: number };
  isEditing: boolean;
  onUpdateLocations: (newLocations: JobLocation[]) => void;
  onUpdateAddress?: (newAddress: string) => void;
}

// Prosty marker dla mini-mapy
const icon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 flex items-center justify-center -ml-4 -mt-8">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e58e35" stroke="white" stroke-width="2" class="w-8 h-8 drop-shadow-lg">
             <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
             <circle cx="12" cy="10" r="3" fill="white"></circle>
           </svg>
         </div>`,
});

export const JobAddress: React.FC<JobAddressProps> = ({ address, locations, coordinates, isEditing, onUpdateLocations, onUpdateAddress }) => {
  return (
    <div className="space-y-3">
      {/* GŁÓWNY ADRES */}
      <div className="bg-[#e58e35] rounded-xl shadow-md transition-all hover:bg-[#d4802d] overflow-hidden">
          {isEditing ? (
             <div className="p-5 flex items-start gap-5">
               <div className="p-3 bg-white/20 rounded-lg border border-white/30">
                 <Navigation className="w-8 h-8 text-white transform -rotate-45" />
               </div>
               <div className="flex-1">
                 <label className="text-white/70 text-[10px] font-bold uppercase mb-1 block">Adres Montażu (Główny - Mapowany)</label>
                 <textarea
                   value={address}
                   onChange={(e) => onUpdateAddress && onUpdateAddress(e.target.value)}
                   className="w-full bg-black/20 text-white placeholder-white/50 border border-white/30 rounded-lg p-3 text-lg font-bold focus:outline-none focus:bg-black/30 resize-none"
                   rows={2}
                   placeholder="Wpisz adres (np. Piękna 16a, Warszawa)"
                 />
                 <div className="text-white/60 text-xs mt-1 font-medium">Zmieniając ten adres, zaktualizujesz pinezkę na mapie.</div>
               </div>
             </div>
          ) : (
             <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="block p-5 flex items-center gap-5">
                  <div className="p-3 bg-white/20 rounded-lg border border-white/30">
                    <Navigation className="w-8 h-8 text-white transform -rotate-45" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold leading-none text-white">{address || "Brak adresu"}</span>
                    <div className="text-[#7a4310] text-xs font-bold mt-2 bg-black/10 w-fit px-3 py-1 rounded uppercase">
                      Adres montażu
                    </div>
                  </div>
             </a>
          )}
          
          {/* MINI MAPA W KARCIE (Tylko podgląd, gdy nie edytujemy i mamy koordynaty) */}
          {coordinates && !isEditing && (
             <div className="h-40 w-full relative border-t-2 border-[#d4802d]">
               <MapContainer 
                  center={[coordinates.lat, coordinates.lng]} 
                  zoom={14} 
                  scrollWheelZoom={false}
                  dragging={false}
                  zoomControl={false}
                  style={{ height: '100%', width: '100%' }}
               >
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 <Marker position={[coordinates.lat, coordinates.lng]} icon={icon} />
               </MapContainer>
               <a 
                 href={`https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`} 
                 target="_blank" 
                 rel="noreferrer"
                 className="absolute inset-0 z-[1000] cursor-pointer"
                 title="Otwórz w Google Maps"
               ></a>
             </div>
          )}
      </div>

      {/* DODATKOWE LOKALIZACJE */}
      {locations && locations.map((loc, idx) => (
        <div key={idx} className="bg-[#e58e35] rounded-xl shadow-md mb-2">
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.fullAddress)}`} target="_blank" rel="noreferrer" className="block p-5 flex items-center gap-5">
            <div className="p-3 bg-white/20 rounded-lg border border-white/30">
              <Navigation className="w-8 h-8 text-white transform -rotate-45" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold leading-none text-white">{loc.shortLabel || loc.fullAddress}</span>
              <div className="text-white/90 text-xs font-medium mt-1 flex items-center gap-2">
                {loc.fullAddress} {loc.distance && <span className="bg-black/20 px-2 py-0.5 rounded font-bold">{loc.distance}</span>}
              </div>
            </div>
          </a>
          {isEditing && (
            <div className="bg-black/10 p-3 flex gap-2 hide-on-print">
              <input 
                value={loc.shortLabel} 
                onChange={e => { const newLocs = [...locations]; newLocs[idx].shortLabel = e.target.value; onUpdateLocations(newLocs); }} 
                className="text-xs p-2 rounded text-gray-900 !bg-white w-40" 
                placeholder="Etykieta" 
              />
              <input 
                value={loc.distance || ''} 
                onChange={e => { const newLocs = [...locations]; newLocs[idx].distance = e.target.value; onUpdateLocations(newLocs); }} 
                className="text-xs p-2 rounded text-gray-900 !bg-white w-32" 
                placeholder="Dystans" 
              />
            </div>
          )}
        </div>
      ))}

      {isEditing && (
        <button onClick={() => { const newLocs = [...(locations || [])]; newLocs.push({ fullAddress: '', shortLabel: 'Nowy Adres', distance: '' }); onUpdateLocations(newLocs); }} className="w-full py-3 bg-white border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-xl text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Dodaj kolejną lokalizację
        </button>
      )}

      {/* WARNING STRIP */}
      <div className="bg-[#fdeded] border-l-8 border-[#d32f2f] p-4 rounded-r-xl flex items-center gap-4 shadow-sm mt-4">
        <div className="bg-white p-2 rounded-full shadow-sm border border-[#f5c6c6]">
          <AlertTriangle className="w-6 h-6 text-[#d32f2f]" />
        </div>
        <div>
          <span className="text-[#c62828] font-black text-base block uppercase tracking-wide mb-1">ZADZWOŃ I POTWIERDŹ ADRES</span>
          <span className="text-[#c62828]/80 text-xs font-medium">To może być siedziba firmy, a nie miejsce montażu</span>
        </div>
      </div>
    </div>
  );
};
