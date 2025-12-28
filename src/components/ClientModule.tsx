import React, { useState, useEffect } from 'react';
import { clientsService, Client } from '../services/apiService';
import { 
  Search, Plus, User, Building2, Mail, Phone, 
  MapPin, FileText, ChevronRight, Loader2,
  Trash2, Edit3, ArrowLeft, History, Users, 
  ExternalLink
} from 'lucide-react';

const ClientModule: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});

  useEffect(() => {
    loadClients();
  }, [search]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await clientsService.getClients(search);
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = async (client: Client) => {
    try {
      const fullClient = await clientsService.getClient(client.id);
      setSelectedClient(fullClient);
    } catch (error) {
      console.error('Failed to load client details:', error);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await clientsService.updateClient(formData.id, formData);
      } else {
        await clientsService.createClient(formData);
      }
      setShowForm(false);
      setFormData({});
      loadClients();
      if (selectedClient && formData.id === selectedClient.id) {
        handleSelectClient(selectedClient);
      }
    } catch (error) {
      alert('Błąd zapisu kontrahenta');
    }
  };

  const handleEditClient = (client: Client) => {
    setFormData(client);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <button 
          onClick={() => { setShowForm(false); setFormData({}); }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Powrót
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
            <h2 className="text-2xl font-bold">{formData.id ? 'Edytuj kontrahenta' : 'Nowy kontrahent'}</h2>
          </div>
          
          <form onSubmit={handleSaveClient} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nazwa firmy</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.company_name || ''}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Imię i Nazwisko / Reprezentant</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">NIP</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.nip || ''}
                  onChange={e => setFormData({...formData, nip: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                <input 
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telefon</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.phone || ''}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Adres</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  rows={2}
                  value={formData.address || ''}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notatki</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button 
                type="button"
                onClick={() => { setShowForm(false); setFormData({}); }}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                ANULUJ
              </button>
              <button 
                type="submit"
                className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md"
              >
                ZAPISZ KONTRAHENTA
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (selectedClient) {
    return (
      <div className="animate-fade-in space-y-6">
        <button 
          onClick={() => setSelectedClient(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Powrót do listy
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedClient.company_name || selectedClient.name}</h2>
                    <p className="text-slate-300 mt-1 flex items-center gap-2">
                      <User className="w-4 h-4" /> {selectedClient.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditClient(selectedClient)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                    <div className="flex items-center gap-3 mt-1 text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>{selectedClient.email || 'Brak adresu email'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefon</label>
                    <div className="flex items-center gap-3 mt-1 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{selectedClient.phone || 'Brak numeru telefonu'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">NIP</label>
                    <div className="flex items-center gap-3 mt-1 text-slate-700">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>{selectedClient.nip || 'Brak numeru NIP'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adres</label>
                    <div className="flex items-center gap-3 mt-1 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{selectedClient.address || 'Brak adresu'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* History of Jobs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-800">Historia zleceń</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {selectedClient.jobs && selectedClient.jobs.length > 0 ? (
                  selectedClient.jobs.map((job: any) => (
                    <div key={job.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-slate-800">{job.title}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                          <span>{job.friendly_id}</span>
                          <span>•</span>
                          <span>{new Date(job.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-600 uppercase">
                          {job.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-400 italic">
                    Brak zleceń dla tego klienta
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Contacts & Addresses */}
          <div className="space-y-6">
            {/* Contacts */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-400" />
                  <h3 className="font-bold text-slate-800">Kontakty</h3>
                </div>
                <button className="text-blue-600 hover:text-blue-800 p-1">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {selectedClient.contacts && selectedClient.contacts.length > 0 ? (
                  selectedClient.contacts.map((contact: any) => (
                    <div key={contact.id} className="text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="font-bold text-slate-800">{contact.name}</div>
                      <div className="text-slate-500 mt-1">{contact.role}</div>
                      <div className="flex items-center gap-2 mt-2 text-blue-600">
                        <Phone className="w-3 h-3" /> {contact.phone}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 text-sm py-4">Brak osób kontaktowych</div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-800">Notatki</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-slate-600 italic">
                  {selectedClient.notes || 'Brak notatek ogólnych'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Baza Kontrahentów</h1>
          <p className="text-slate-500">Zarządzaj swoimi klientami i ich historią</p>
        </div>
        <button 
          onClick={() => { setFormData({}); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md shadow-orange-200"
        >
          <Plus className="w-5 h-5" />
          DODAJ KONTRAHENTA
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Szukaj po nazwie, NIP, emailu..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-orange-500 transition-all outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Clients List */}
      {loading && clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-slate-500 font-medium">Ładowanie kontrahentów...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(client => (
            <div 
              key={client.id}
              onClick={() => handleSelectClient(client)}
              className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-50 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <Building2 className="w-6 h-6 text-slate-400 group-hover:text-orange-500" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Zlecenia</span>
                  <span className="text-lg font-black text-slate-700">{client.jobs_count || 0}</span>
                </div>
              </div>
              
              <h3 className="font-bold text-slate-800 line-clamp-1 mb-1 group-hover:text-orange-600 transition-colors">
                {client.company_name || client.name}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1 mb-4">
                <User className="w-3 h-3" /> {client.name}
              </p>

              <div className="space-y-2 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="w-3 h-3 text-slate-300" />
                  <span className="truncate">{client.email || '---'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3 h-3 text-slate-300" />
                  <span>{client.phone || '---'}</span>
                </div>
                {client.nip && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <FileText className="w-3 h-3 text-slate-300" />
                    <span>NIP: {client.nip}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && clients.length === 0 && (
        <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 italic">Nie znaleziono kontrahentów spełniających kryteria</p>
        </div>
      )}
    </div>
  );
};

export default ClientModule;
