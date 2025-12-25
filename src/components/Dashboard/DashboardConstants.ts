import { JobColumnId } from '../../types';

export interface RowConfig {
  id: JobColumnId;
  title: string;
  shortTitle: string;
  headerBg: string;
  dotColor: string;
  borderColor: string;
  bodyBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
}

export const ROWS_CONFIG: RowConfig[] = [
  { id: 'PREPARE', title: 'DO PRZYGOTOWANIA', shortTitle: 'PRZYG.', headerBg: 'bg-gradient-to-r from-slate-700 to-slate-800', headerText: 'text-white', dotColor: 'text-slate-600', bodyBg: 'bg-slate-50/50', borderColor: 'border-slate-600', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700' },
  { id: 'MON', title: 'PONIEDZIAŁEK', shortTitle: 'PN', headerBg: 'bg-gradient-to-r from-rose-500 to-rose-600', headerText: 'text-white', dotColor: 'text-rose-500', bodyBg: 'bg-rose-50/50', borderColor: 'border-rose-500', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700' },
  { id: 'TUE', title: 'WTOREK', shortTitle: 'WT', headerBg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', headerText: 'text-white', dotColor: 'text-emerald-500', bodyBg: 'bg-emerald-50/50', borderColor: 'border-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  { id: 'WED', title: 'ŚRODA', shortTitle: 'ŚR', headerBg: 'bg-gradient-to-r from-violet-500 to-violet-600', headerText: 'text-white', dotColor: 'text-violet-500', bodyBg: 'bg-violet-50/50', borderColor: 'border-violet-500', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  { id: 'THU', title: 'CZWARTEK', shortTitle: 'CZW', headerBg: 'bg-gradient-to-r from-amber-400 to-amber-500', headerText: 'text-amber-900', dotColor: 'text-amber-500', bodyBg: 'bg-amber-50/50', borderColor: 'border-amber-400', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
  { id: 'FRI', title: 'PIĄTEK', shortTitle: 'PT', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-600', headerText: 'text-white', dotColor: 'text-blue-500', bodyBg: 'bg-blue-50/50', borderColor: 'border-blue-500', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  { id: 'SAT', title: 'SOBOTA', shortTitle: 'SB', headerBg: 'bg-gradient-to-r from-indigo-500 to-indigo-600', headerText: 'text-white', dotColor: 'text-indigo-500', bodyBg: 'bg-indigo-50/50', borderColor: 'border-indigo-500', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700' },
  { id: 'SUN', title: 'NIEDZIELA', shortTitle: 'ND', headerBg: 'bg-gradient-to-r from-purple-500 to-purple-600', headerText: 'text-white', dotColor: 'text-purple-500', bodyBg: 'bg-purple-50/50', borderColor: 'border-purple-500', badgeBg: 'bg-purple-100', badgeText: 'text-purple-700' },
  { id: 'COMPLETED', title: 'WYKONANE', shortTitle: 'OK', headerBg: 'bg-gradient-to-r from-green-600 to-green-700', headerText: 'text-white', dotColor: 'text-green-600', bodyBg: 'bg-green-50/50', borderColor: 'border-green-600', badgeBg: 'bg-green-100', badgeText: 'text-green-700' },
];

export const EXTENDED_ROWS_CONFIG = ROWS_CONFIG;
export const KANBAN_ROWS_CONFIG = ROWS_CONFIG;

export const BASE_COORDS = { lat: 52.2297, lng: 21.0122 }; // ul. Poprawna 39R, Warszawa

export const MOVE_COLUMNS: { id: JobColumnId; label: string; shortLabel: string; icon: string }[] = [
  { id: 'PREPARE', label: 'Przygot.', shortLabel: 'P', icon: '📋' },
  { id: 'MON', label: 'Pon', shortLabel: 'Pn', icon: '🔴' },
  { id: 'TUE', label: 'Wt', shortLabel: 'Wt', icon: '🟢' },
  { id: 'WED', label: 'Śr', shortLabel: 'Śr', icon: '🟣' },
  { id: 'THU', label: 'Czw', shortLabel: 'Cz', icon: '🟡' },
  { id: 'FRI', label: 'Pt', shortLabel: 'Pt', icon: '🔵' },
  { id: 'COMPLETED', label: 'OK', shortLabel: '✓', icon: '✅' },
];

