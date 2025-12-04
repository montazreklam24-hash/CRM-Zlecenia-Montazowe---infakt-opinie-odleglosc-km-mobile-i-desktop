import React from 'react';
import { Phone, User } from 'lucide-react';

interface JobContactProps {
  phoneNumber: string;
  contactPerson: string;
  clientName: string;
  isEditing: boolean;
  onUpdate: (field: string, value: string) => void;
}

export const JobContact: React.FC<JobContactProps> = ({ phoneNumber, contactPerson, clientName, isEditing, onUpdate }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      {/* PHONE BUTTON */}
      <a href={`tel:${phoneNumber.replace(/[^0-9+]/g, '')}`} className="bg-[#4f8d5e] hover:bg-[#437a50] text-white rounded-xl p-5 flex items-center justify-center gap-4 shadow-md transition-all hover:-translate-y-0.5">
        <div className="p-2 bg-white/20 rounded-full border border-white/30">
          <Phone className="w-6 h-6 fill-white" />
        </div>
        {isEditing ? (
           <input 
             value={phoneNumber} 
             onChange={(e) => onUpdate('phoneNumber', e.target.value)}
             onClick={(e) => e.preventDefault()}
             className="bg-white/20 text-white text-2xl font-bold w-full p-1 rounded"
           />
        ) : (
           <span className="text-3xl font-bold tracking-tight">{phoneNumber}</span>
        )}
      </a>

      {/* CONTACT PERSON CARD */}
      <div className="bg-white rounded-xl p-5 flex flex-col justify-center shadow-sm border border-gray-200">
        {isEditing ? (
          <>
            <input 
              value={contactPerson} 
              onChange={(e) => onUpdate('contactPerson', e.target.value)} 
              className="w-full font-bold text-xl !bg-white text-gray-900 border border-gray-300 p-1 mb-2" 
              placeholder="Osoba Kontaktowa" 
            />
            <input 
              value={clientName} 
              onChange={(e) => onUpdate('clientName', e.target.value)} 
              className="w-full text-sm !bg-white text-gray-600 border border-gray-300 p-1" 
              placeholder="Nazwa Firmy / Klienta" 
            />
          </>
        ) : (
          <>
            <div className="font-bold text-2xl text-slate-900 flex items-center gap-3">
              <User className="w-6 h-6 text-slate-400" /> {contactPerson}
            </div>
            <div className="text-sm text-slate-500 font-medium mt-1 ml-9">{clientName}</div>
          </>
        )}
        <div className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-wide ml-9">OSOBA ZAMAWIAJĄCA</div>
      </div>
    </div>
  );
};