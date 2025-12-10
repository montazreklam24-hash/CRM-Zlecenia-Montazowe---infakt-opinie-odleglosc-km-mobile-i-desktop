import React from 'react';
import { Job, JobColumnId, JobStatus } from '../../types';
import { Plus, CheckCircle2, Package } from 'lucide-react';

interface MobileHomeProps {
  jobs: Job[];
  onCreateNew: () => void;
  onSelectColumn: (columnId: JobColumnId) => void;
}

// Column configuration
const DAY_COLUMNS: { id: JobColumnId; shortLabel: string; fullLabel: string; color: string }[] = [
  { id: 'MON', shortLabel: 'Pn', fullLabel: 'Poniedziałek', color: '#f43f5e' },
  { id: 'TUE', shortLabel: 'Wt', fullLabel: 'Wtorek', color: '#10b981' },
  { id: 'WED', shortLabel: 'Śr', fullLabel: 'Środa', color: '#8b5cf6' },
  { id: 'THU', shortLabel: 'Cz', fullLabel: 'Czwartek', color: '#f59e0b' },
  { id: 'FRI', shortLabel: 'Pt', fullLabel: 'Piątek', color: '#3b82f6' },
];

const MobileHome: React.FC<MobileHomeProps> = ({ jobs, onCreateNew, onSelectColumn }) => {
  // Count jobs per column
  const getJobCount = (columnId: JobColumnId): number => {
    return jobs.filter(j => 
      (j.columnId || 'PREPARE') === columnId && 
      j.status !== JobStatus.ARCHIVED
    ).length;
  };

  const prepareCount = getJobCount('PREPARE');
  const completedCount = getJobCount('COMPLETED');
  const totalActive = jobs.filter(j => j.status !== JobStatus.ARCHIVED).length;

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 pb-8"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Logo & Header */}
      <div className="flex items-center justify-center gap-3 mb-6 pt-2">
        <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/30">
          <span className="text-xl font-black text-white">M24</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Montaż Reklam 24</h1>
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider">CRM Mobile</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-6 flex justify-around text-center">
        <div>
          <div className="text-3xl font-bold text-white">{totalActive}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Aktywnych</div>
        </div>
        <div className="w-px bg-white/20" />
        <div>
          <div className="text-3xl font-bold text-orange-400">{prepareCount}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Do przyg.</div>
        </div>
        <div className="w-px bg-white/20" />
        <div>
          <div className="text-3xl font-bold text-green-400">{completedCount}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Ukończone</div>
        </div>
      </div>

      {/* Add New Job Button - Big CTA */}
      <button
        onClick={onCreateNew}
        className="w-full py-5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-3 mb-4 active:scale-[0.98] transition-transform"
      >
        <div className="p-2 bg-white/20 rounded-xl">
          <Plus className="w-7 h-7 text-white" />
        </div>
        <span className="text-xl font-bold text-white">DODAJ NOWE ZLECENIE</span>
      </button>

      {/* Prepare Button */}
      <button
        onClick={() => onSelectColumn('PREPARE')}
        className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl flex items-center justify-between px-5 mb-4 active:scale-[0.98] transition-all shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-600 rounded-xl">
            <Package className="w-5 h-5 text-slate-300" />
          </div>
          <span className="text-lg font-bold text-white">DO PRZYGOTOWANIA</span>
        </div>
        <div className="bg-white/20 px-3 py-1 rounded-full">
          <span className="text-lg font-bold text-white">{prepareCount}</span>
        </div>
      </button>

      {/* Day Buttons Grid - Square */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {DAY_COLUMNS.map(col => {
          const count = getJobCount(col.id);
          return (
            <button
              key={col.id}
              onClick={() => onSelectColumn(col.id)}
              className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-md relative overflow-hidden"
              style={{ background: col.color }}
            >
              {/* Day Label */}
              <span className="text-2xl font-black text-white">{col.shortLabel}</span>
              {/* Count Badge */}
              <div className="bg-white/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                <span className="text-sm font-bold text-white">{count}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Completed Button */}
      <button
        onClick={() => onSelectColumn('COMPLETED')}
        className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl flex items-center justify-between px-5 active:scale-[0.98] transition-transform shadow-lg shadow-green-600/30"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">UKOŃCZONE</span>
        </div>
        <div className="bg-white/20 px-3 py-1 rounded-full">
          <span className="text-lg font-bold text-white">{completedCount}</span>
        </div>
      </button>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-slate-500 text-xs">
          Montaż Reklam 24 &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default MobileHome;
