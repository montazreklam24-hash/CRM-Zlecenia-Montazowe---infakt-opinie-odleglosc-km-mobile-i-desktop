import React, { useState } from 'react';
import { User } from '../types';
import { authService } from '../services/apiService';
import { Loader2, LogIn, Phone, Mail, Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginType, setLoginType] = useState<'email' | 'phone'>('email');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!login.trim() || !password) {
      setError('Wprowadź login i hasło');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { user } = await authService.login(login.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd logowania');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-2xl shadow-orange-500/20 mb-4">
            <span className="text-3xl font-black text-white tracking-tight">M24</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Montaż Reklam 24</h1>
          <p className="text-slate-400 text-sm">System zarządzania zleceniami</p>
        </div>
        
        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Login type toggle */}
            <div className="flex bg-slate-800/50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLoginType('email')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  loginType === 'email'
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setLoginType('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  loginType === 'phone'
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="w-4 h-4" />
                Telefon
              </button>
            </div>
            
            {/* Login input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                {loginType === 'email' ? 'Adres email' : 'Numer telefonu'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  {loginType === 'email' ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                </div>
                <input
                  type={loginType === 'email' ? 'email' : 'tel'}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder={loginType === 'email' ? 'twoj@email.pl' : '500 000 000'}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                  autoComplete={loginType === 'email' ? 'email' : 'tel'}
                />
              </div>
            </div>
            
            {/* Password input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Hasło</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logowanie...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Zaloguj się</span>
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Montaż Reklam 24 CRM v2.0<br />
          © 2024 Wszelkie prawa zastrzeżone
        </p>
      </div>
    </div>
  );
};

export default Login;



