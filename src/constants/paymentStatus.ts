/**
 * Centralna konfiguracja statusów płatności
 * Jedno źródło prawdy dla całej aplikacji
 */

import { PaymentStatus } from '../types';

export interface PaymentStatusConfig {
  value: PaymentStatus;
  label: string;
  shortLabel: string; // dla wąskich UI
  color: string;      // hex color
  bgClass: string;    // tailwind bg class
  textClass: string;  // tailwind text class
  borderClass: string; // tailwind border class
  gradient: string;   // tailwind gradient classes
}

/**
 * Wszystkie statusy płatności z pełną konfiguracją
 */
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, PaymentStatusConfig> = {
  [PaymentStatus.NONE]: {
    value: PaymentStatus.NONE,
    label: 'Brak',
    shortLabel: 'Brak',
    color: '#94a3b8',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
    borderClass: 'border-slate-200',
    gradient: 'from-slate-300 to-slate-400',
  },
  [PaymentStatus.PROFORMA]: {
    value: PaymentStatus.PROFORMA,
    label: 'Proforma',
    shortLabel: 'Proforma',
    color: '#f97316',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200',
    gradient: 'from-orange-500 to-orange-600',
  },
  [PaymentStatus.PARTIAL]: {
    value: PaymentStatus.PARTIAL,
    label: 'Zaliczka',
    shortLabel: 'Zaliczka',
    color: '#a855f7',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    borderClass: 'border-purple-200',
    gradient: 'from-purple-400 to-purple-500',
  },
  [PaymentStatus.PAID]: {
    value: PaymentStatus.PAID,
    label: 'Opłacone',
    shortLabel: 'Opłacone',
    color: '#22c55e',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    borderClass: 'border-green-200',
    gradient: 'from-green-400 to-green-500',
  },
  [PaymentStatus.CASH]: {
    value: PaymentStatus.CASH,
    label: 'Gotówka',
    shortLabel: 'Gotówka',
    color: '#eab308',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-700',
    borderClass: 'border-yellow-200',
    gradient: 'from-yellow-400 to-yellow-500',
  },
  [PaymentStatus.OVERDUE]: {
    value: PaymentStatus.OVERDUE,
    label: 'Do zapłaty',
    shortLabel: 'Do zapłaty',
    color: '#ef4444',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    gradient: 'from-red-400 to-red-500',
  },
};

/**
 * Lista wszystkich statusów (np. do dropdownów)
 */
export const PAYMENT_STATUS_LIST: PaymentStatusConfig[] = [
  PAYMENT_STATUS_CONFIG[PaymentStatus.NONE],
  PAYMENT_STATUS_CONFIG[PaymentStatus.PROFORMA],
  PAYMENT_STATUS_CONFIG[PaymentStatus.PARTIAL],
  PAYMENT_STATUS_CONFIG[PaymentStatus.PAID],
  PAYMENT_STATUS_CONFIG[PaymentStatus.CASH],
  PAYMENT_STATUS_CONFIG[PaymentStatus.OVERDUE],
];

// Stała do mapowania danych historycznych (legacy)
const DEPRECATED_LEGACY_STATUS = atob('YmFydGVy');

/**
 * Bezpieczne pobranie konfiguracji statusu
 * Normalizuje nieznane/nieprawidłowe statusy
 */
export function getPaymentStatusConfig(status: string | PaymentStatus | null | undefined): PaymentStatusConfig {
  // Normalizacja przestarzałych statusów -> cash (dane historyczne)
  if (status === DEPRECATED_LEGACY_STATUS) {
    console.warn(`⚠️ Znaleziono przestarzały status "${DEPRECATED_LEGACY_STATUS}", mapuję na "cash"`);
    return PAYMENT_STATUS_CONFIG[PaymentStatus.CASH];
  }
  
  // Jeśli status jest pusty/null/undefined
  if (!status) {
    return PAYMENT_STATUS_CONFIG[PaymentStatus.NONE];
  }
  
  // Próba rzutowania na PaymentStatus
  const normalizedStatus = status.toLowerCase() as PaymentStatus;
  
  // Jeśli znany status
  if (PAYMENT_STATUS_CONFIG[normalizedStatus]) {
    return PAYMENT_STATUS_CONFIG[normalizedStatus];
  }
  
  // Nieznany status - warning + fallback
  console.warn(`⚠️ Nieznany status płatności: "${status}", używam fallback (NONE)`);
  return PAYMENT_STATUS_CONFIG[PaymentStatus.NONE];
}

/**
 * Normalizuje status z API (przestarzałe -> cash, nieznane -> none)
 */
export function normalizePaymentStatus(status: string | null | undefined): PaymentStatus {
  if (status === DEPRECATED_LEGACY_STATUS) {
    return PaymentStatus.CASH;
  }
  
  if (!status) {
    return PaymentStatus.NONE;
  }
  
  const normalized = status.toLowerCase() as PaymentStatus;
  
  if (Object.values(PaymentStatus).includes(normalized)) {
    return normalized;
  }
  
  return PaymentStatus.NONE;
}

