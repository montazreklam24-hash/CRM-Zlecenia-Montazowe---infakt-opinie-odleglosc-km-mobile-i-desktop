import React, { useState, useEffect } from 'react';
import { clientsService, Client } from '../services/apiService';
import { Job } from '../types';
import { 
  Search, Plus, User, Building2, Mail, Phone, 
  MapPin, FileText, ChevronRight, Loader2,
  Trash2, Edit3, ArrowLeft, History, Users, 
  ExternalLink, LayoutList, Grid, Receipt,
  Map as MapIcon, Layers
} from 'lucide-react';
import MapBoardGoogle from './MapBoardGoogle';
import MapBoardOSM from './MapBoardOSM';

interface ClientModuleProps {
  onSelectJob?: (job: Job) => void;
}

const ClientModule: React.FC<ClientModuleProps> = ({ onSelectJob }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'jobs' | 'invoices' | 'map'>('info');
  const [mapProvider, setMapProvider] = useState<'GOOGLE' | 'OSM'>('GOOGLE');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('clients_view_mode') as 'list' | 'grid') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('clients_view_mode', viewMode);
  }, [viewMode]);

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
      setActiveTab('info');
    } catch (error) {
      console.error('Failed to load client details:', error);
    }
  };

  const handleSyncInfakt = async () => {
    if (!selectedClient) return;
    try {
      setLoading(true);
      const updatedData = await clientsService.syncInfakt(selectedClient.id);
      setSelectedClient({ ...selectedClient, ...updatedData });
      alert('Dane zsynchronizowane z inFakt');
    } catch (error: any) {
      alert('Błąd synchronizacji: ' + error.message);
    } finally {
      setLoading(false);
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

  const handleDeleteClient = async () => {
    if (!formData.id || !window.confirm('Czy na pewno chcesz usunąć tego kontrahenta?')) return;
    try {
      await clientsService.deleteClient(formData.id);
      setShowForm(false);
      setFormData({});
      setSelectedClient(null);
      loadClients();
    } catch (error) {
      alert('Błąd usuwania kontrahenta');
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
              {formData.id && (
                <button 
                  type="button"
                  onClick={handleDeleteClient}
                  className="mr-auto flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" /> USUŃ KONTRAHENTA
                </button>
              )}
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
                      onClick={handleSyncInfakt}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-xs font-bold shadow-md"
                      title="Pobierz dane z inFakt po NIP"
                    >
                      <Receipt className="w-4 h-4" />
                      SYNCHRONIZUJ INFAKT
                    </button>
                    <button 
                      onClick={() => handleEditClient(selectedClient)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-slate-50 border-b border-slate-100 px-6">
                {[
                  { id: 'info', label: 'Informacje', icon: User },
                  { id: 'jobs', label: 'Zlecenia', icon: History },
                  { id: 'invoices', label: 'Dokumenty', icon: Receipt },
                  { id: 'map', label: 'Mapa', icon: MapIcon },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 ${
                      activeTab === tab.id 
                        ? 'border-orange-500 text-orange-600 bg-white' 
                        : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="p-6">
                {activeTab === 'info' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-3 text-slate-700">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>{selectedClient.email || 'Brak adresu email'}</span>
                          </div>
                          {selectedClient.gmail_thread_id && (
                            <a 
                              href={`https://mail.google.com/mail/u/0/#inbox/${selectedClient.gmail_thread_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              GMAIL
                            </a>
                          )}
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
                )}

                {activeTab === 'jobs' && (
                  <div className="divide-y divide-slate-50 animate-fade-in">
                    {selectedClient.jobs && selectedClient.jobs.length > 0 ? (
                      selectedClient.jobs.map((job: any) => (
                        <div 
                          key={job.id} 
                          onClick={() => onSelectJob?.(job)}
                          className="py-4 hover:bg-slate-50 transition-colors flex justify-between items-center group cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-800 group-hover:text-orange-600 transition-colors">{job.data?.jobTitle || 'Bez tytułu'}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                              <span>{job.friendlyId}</span>
                              <span>•</span>
                              <span>{new Date(job.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
                      <div className="py-12 text-center text-slate-400 italic">
                        Brak zleceń dla tego klienta
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'invoices' && (
                  <div className="animate-fade-in space-y-4">
                    {selectedClient.invoices && selectedClient.invoices.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedClient.invoices.map((inv: any) => (
                          <div key={inv.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm text-slate-400 group-hover:text-blue-500 transition-colors">
                                <Receipt className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-800">{inv.infakt_number || inv.number}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-black">{inv.type}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="font-black text-slate-700">{inv.total_gross} zł</div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  inv.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                }`}>
                                  {inv.status === 'paid' ? 'OPŁACONA' : 'NIEOPŁACONA'}
                                </span>
                              </div>
                              {inv.infakt_link && (
                                <a 
                                  href={inv.infakt_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                  title="Otwórz w inFakt"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 italic">
                        Brak dokumentów powiązanych z tym kontrahentem
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'map' && (
                  <div className="h-[400px] rounded-xl overflow-hidden border border-slate-100 animate-fade-in relative">
                    <div className="absolute top-4 right-4 z-[1000] flex gap-1 bg-white/90 p-1 rounded-lg shadow-lg border border-slate-200">
                      <button 
                        onClick={() => setMapProvider('GOOGLE')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded ${mapProvider === 'GOOGLE' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        Google
                      </button>
                      <button 
                        onClick={() => setMapProvider('OSM')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded ${mapProvider === 'OSM' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        OSM
                      </button>
                    </div>
                    {mapProvider === 'GOOGLE' ? (
                      <MapBoardGoogle 
                        jobs={selectedClient.jobs || []} 
                        onSelectJob={(job) => onSelectJob?.(job)} 
                        onJobsUpdated={() => {}}
                        onChangeColumn={async () => {}}
                      />
                    ) : (
                      <MapBoardOSM 
                        jobs={selectedClient.jobs || []} 
                        onSelectJob={(job) => onSelectJob?.(job)} 
                        onJobsUpdated={() => {}}
                      />
                    )}
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
                  <div className="text-center text-slate-400 text-sm py-4 italic">Brak osób kontaktowych</div>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-800">Adresy</h3>
              </div>
              <div className="p-4 space-y-4">
                {selectedClient.addresses && selectedClient.addresses.length > 0 ? (
                  selectedClient.addresses.map((addr: any) => (
                    <div key={addr.id} className="text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="font-black text-[10px] uppercase text-slate-400 mb-1">
                        {addr.type === 'billing' ? 'Faktura' : addr.type === 'install' ? 'Montaż' : 'Inny'}
                      </div>
                      <div className="text-slate-800 font-medium">{addr.address_text}</div>
                      {addr.note && <div className="text-slate-500 mt-1 italic text-xs">{addr.note}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-700 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="font-black text-[10px] uppercase text-slate-400 mb-1">Główny adres</div>
                    {selectedClient.address || 'Brak adresu'}
                  </div>
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
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Szukaj po nazwie, NIP, emailu..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-orange-500 transition-all outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            title="Widok listy"
          >
            <LayoutList className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            title="Widok kafelków"
          >
            <Grid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Clients List */}
      {loading && clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-slate-500 font-medium">Ładowanie kontrahentów...</p>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map(client => (
              <div 
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-50 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors overflow-hidden">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-400 group-hover:text-orange-500" />
                    )}
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
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-16">Logo</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Kontrahent</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Kontakt</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">NIP</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-center">Zlecenia</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clients.map(client => (
                    <tr 
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="hover:bg-orange-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                          {client.logo_url ? (
                            <img src={client.logo_url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Building2 className="w-5 h-5 text-slate-400 group-hover:text-orange-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                          {client.company_name || client.name}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> {client.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {client.email && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Mail className="w-3 h-3 text-slate-300" /> {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Phone className="w-3 h-3 text-slate-300" /> {client.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {client.nip || '---'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                          {client.jobs_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
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
