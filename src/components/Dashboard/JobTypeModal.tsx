import React from 'react';

interface JobTypeModalProps {
  onClose: () => void;
  onCreateNewSimple: () => void;
  onCreateNewAI: () => void;
}

export const JobTypeModal: React.FC<JobTypeModalProps> = ({
  onClose,
  onCreateNewSimple,
  onCreateNewAI
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 text-center">
          <h2 className="text-2xl font-bold">Wybierz typ zlecenia</h2>
          <p className="text-slate-300 mt-1">Jak chcesz dodać nowe zlecenie?</p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Opcja: Proste zlecenie */}
          <button
            onClick={() => {
              onClose();
              onCreateNewSimple();
            }}
            className="w-full p-5 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">📋</span>
              <div>
                <h3 className="text-xl font-bold text-green-700 group-hover:text-green-800">Proste zlecenie</h3>
                <p className="text-slate-600 text-sm mt-1">Ręczne wypełnianie pól - szybkie i proste</p>
              </div>
            </div>
          </button>
          
          {/* Opcja: AI zlecenie */}
          <button
            onClick={() => {
              onClose();
              onCreateNewAI();
            }}
            className="w-full p-5 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">🤖</span>
              <div>
                <h3 className="text-xl font-bold text-blue-700 group-hover:text-blue-800">Zlecenie AI</h3>
                <p className="text-slate-600 text-sm mt-1">Wklej mail - Gemini wypełni dane automatycznie</p>
              </div>
            </div>
          </button>
        </div>
        
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
};

