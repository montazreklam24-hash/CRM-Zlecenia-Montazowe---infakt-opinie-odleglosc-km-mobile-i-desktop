import React, { useState, useEffect } from 'react';
import { usersService } from '../services/apiService';
import { User, UserRole } from '../types';
import { 
  Search, Plus, User as UserIcon, Mail, Phone, 
  ChevronRight, Loader2, Trash2, Edit3, ArrowLeft, 
  Shield, ShieldCheck, Lock, CheckCircle2, XCircle,
  AlertCircle
} from 'lucide-react';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.WORKER]: 'Montażysta',
  [UserRole.PRINTER]: 'Drukarz'
};

const UserModule: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (formData.id) {
        await usersService.updateUser(formData.id, formData);
      } else {
        if (!formData.password || formData.password.length < 6) {
          setError('Hasło musi mieć minimum 6 znaków');
          return;
        }
        await usersService.createUser(formData);
      }
      setShowForm(false);
      setFormData({});
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Błąd zapisu użytkownika');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego użytkownika?')) return;
    try {
      await usersService.deleteUser(id);
      loadUsers();
    } catch (error) {
      alert('Błąd usuwania użytkownika');
    }
  };

  const handleEditUser = (user: User) => {
    setFormData(user);
    setShowForm(true);
  };

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase().includes(search.toLowerCase())) ||
    (u.email?.toLowerCase().includes(search.toLowerCase())) ||
    (u.phone?.toLowerCase().includes(search.toLowerCase()))
  );

  if (showForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <button 
          onClick={() => { setShowForm(false); setFormData({}); setError(null); }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Powrót
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden max-w-2xl mx-auto">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
            <h2 className="text-2xl font-bold">{formData.id ? 'Edytuj użytkownika' : 'Nowy użytkownik'}</h2>
          </div>
          
          <form onSubmit={handleSaveUser} className="p-6 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Imię i Nazwisko</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                <input 
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required={!formData.phone}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telefon</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.phone || ''}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  required={!formData.email}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Rola</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                  value={formData.role || UserRole.WORKER}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.ADMIN}>Administrator</option>
                  <option value={UserRole.WORKER}>Montażysta</option>
                  <option value={UserRole.PRINTER}>Drukarz</option>
                </select>
              </div>
              {!formData.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Hasło</label>
                  <input 
                    type="password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                    value={formData.password || ''}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="Min. 6 znaków"
                    required
                  />
                </div>
              )}
              {formData.id && (
                <div className="flex items-center gap-2 pt-6">
                  <input 
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active !== false}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                    className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Konto aktywne</label>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button 
                type="button"
                onClick={() => { setShowForm(false); setFormData({}); setError(null); }}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                ANULUJ
              </button>
              <button 
                type="submit"
                className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md"
              >
                ZAPISZ UŻYTKOWNIKA
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Zarządzanie Użytkownikami</h1>
          <p className="text-slate-500">Zarządzaj kontami pracowników i ich uprawnieniami</p>
        </div>
        <button 
          onClick={() => { setFormData({}); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md shadow-orange-200"
        >
          <Plus className="w-5 h-5" />
          DODAJ UŻYTKOWNIKA
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Szukaj po nazwisku, emailu lub telefonie..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-orange-500 transition-all outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="text-slate-500 font-medium">Ładowanie użytkowników...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider w-16">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Użytkownik</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Kontakt</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Rola</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider">Ostatnie logowanie</th>
                  <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      {user.is_active ? (
                        <span title="Aktywny">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </span>
                      ) : (
                        <span title="Nieaktywny">
                          <XCircle className="w-5 h-5 text-slate-300" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{user.name}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">ID: {user.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {user.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail className="w-3 h-3 text-slate-300" /> {user.email}
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="w-3 h-3 text-slate-300" /> {user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.role === UserRole.ADMIN ? (
                          <ShieldCheck className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Shield className="w-4 h-4 text-slate-400" />
                        )}
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          user.role === UserRole.ADMIN ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ROLE_LABELS[user.role as UserRole] || user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {user.last_login ? new Date(user.last_login).toLocaleString('pl-PL') : 'Nigdy'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                          title="Edytuj"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Usuń"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserModule;

