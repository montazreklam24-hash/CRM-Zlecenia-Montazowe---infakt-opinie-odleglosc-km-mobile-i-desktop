import React, { useState } from 'react';
import { authService } from '../services/apiService';
import { X, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [login, setLogin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!login.trim()) {
      setError('Podaj adres email lub numer telefonu');
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(login.trim());
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setLogin('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Błąd podczas resetowania hasła');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">Zapomniałeś hasła?</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Email wysłany!</h3>
                <p className="text-slate-500 mt-2">
                  Jeśli konto istnieje, na podany adres zostały wysłane instrukcje resetu hasła.
                </p>
                <p className="text-slate-400 text-sm mt-2">
                  Sprawdź swoją skrzynkę mailową.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="text-center mb-4">
                <p className="text-slate-600 text-sm">
                  Podaj swój adres email lub numer telefonu, a my wyślemy Ci nowe hasło tymczasowe.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Email lub telefon</label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  placeholder="twoj@email.pl lub 500 000 000"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  ANULUJ
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>WYSYŁANIE...</span>
                    </>
                  ) : (
                    <span>RESETUJ HASŁO</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
