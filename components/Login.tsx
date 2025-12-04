import React, { useState } from 'react';
import { UserRole } from '../types';
import { apiService } from '../services/apiService';
import { ShieldCheck, HardHat, Loader2, Mail, Phone, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!login.trim() || !password.trim()) {
      setError('Wypełnij wszystkie pola');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await apiService.login(login.trim(), password);
      
      // Konwertuj rolę z API na enum
      const role = user.role === 'admin' ? UserRole.ADMIN : UserRole.WORKER;
      onLogin(role);
    } catch (err: any) {
      setError(err.message || 'Błąd logowania. Sprawdź dane i spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4">
      {/* Logo i nagłówek */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-2xl shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <span className="text-3xl font-black text-white tracking-tight">M24</span>
            </div>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Montaż Reklam 24</h1>
        <p className="text-gray-500 font-medium">System zarządzania zleceniami</p>
      </div>

      {/* Formularz logowania */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Tabs - Email / Telefon */}
          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => { setLoginMethod('email'); setLogin(''); }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                loginMethod === 'email' 
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('phone'); setLogin(''); }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                loginMethod === 'phone' 
                  ? 'bg-green-50 text-green-600 border-b-2 border-green-600' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Phone className="w-4 h-4" />
              Telefon
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Błąd */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Login */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {loginMethod === 'email' ? 'Adres email' : 'Numer telefonu'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  {loginMethod === 'email' ? (
                    <Mail className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Phone className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <input
                  type={loginMethod === 'email' ? 'email' : 'tel'}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder={loginMethod === 'email' ? 'jan@firma.pl' : '500 100 200'}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoComplete={loginMethod === 'email' ? 'email' : 'tel'}
                  autoFocus
                />
              </div>
            </div>

            {/* Hasło */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Hasło
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Przycisk logowania */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logowanie...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Zaloguj się
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info o rolach */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-bold text-gray-800 text-sm">Admin</span>
            </div>
            <p className="text-xs text-gray-500">Tworzenie zleceń, zarządzanie</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <HardHat className="w-4 h-4 text-orange-600" />
              </div>
              <span className="font-bold text-gray-800 text-sm">Pracownik</span>
            </div>
            <p className="text-xs text-gray-500">Podgląd zleceń, raportowanie</p>
          </div>
        </div>

        {/* Wersja */}
        <p className="mt-8 text-xs text-gray-400 text-center">
          CRM Montaż Reklam 24 &bull; v1.0.0
        </p>
      </div>

      {/* Animacja tła */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;
