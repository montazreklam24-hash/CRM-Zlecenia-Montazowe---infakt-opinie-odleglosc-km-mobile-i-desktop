/**
 * Guard/confirm dla ręcznej zmiany statusu płatności
 * Chroni przed przypadkowym nadpisaniem automatyki inFakt
 */

import { Job, PaymentStatus } from '../types';

/**
 * Sprawdza czy status płatności był prawdopodobnie ustawiony automatycznie
 * na podstawie dokumentów inFakt i zwraca powód (reason) jeśli tak.
 */
export function getAutoPaymentReason(job: Job): string | null {
  const status = job.paymentStatus;
  const invoices = job.invoices || [];
  
  // Brak statusu lub NONE - nie ostrzegaj
  if (!status || status === PaymentStatus.NONE) {
    return null;
  }
  
  // Status PROFORMA + istnieje proforma w inFakt
  if (status === PaymentStatus.PROFORMA) {
    const hasProforma = invoices.some(inv => inv.type === 'proforma');
    if (hasProforma) {
      return 'Wystawiona proforma w inFakt';
    }
  }
  
  // Status PAID + istnieje opłacona faktura w inFakt
  if (status === PaymentStatus.PAID) {
    const hasPaidInvoice = invoices.some(
      inv => (inv.type === 'invoice' || inv.type === 'advance') && inv.paymentStatus === 'paid'
    );
    if (hasPaidInvoice) {
      return 'Faktura opłacona w inFakt';
    }
    // Jeśli jest faktura VAT, nawet nieopłacona, może być auto-status
    const hasInvoice = invoices.some(inv => inv.type === 'invoice' || inv.type === 'advance');
    if (hasInvoice) {
      return 'Wystawiona faktura w inFakt';
    }
  }
  
  // Status PARTIAL + częściowo opłacona faktura
  if (status === PaymentStatus.PARTIAL) {
    const hasPartialInvoice = invoices.some(
      inv => inv.paymentStatus === 'partial' && inv.paidAmount > 0
    );
    if (hasPartialInvoice) {
      return 'Faktura częściowo opłacona w inFakt';
    }
  }
  
  // Status OVERDUE + faktura przeterminowana
  if (status === PaymentStatus.OVERDUE) {
    const hasOverdueInvoice = invoices.some(inv => inv.paymentStatus === 'overdue');
    if (hasOverdueInvoice) {
      return 'Faktura przeterminowana w inFakt';
    }
  }
  
  // Jeśli są jakiekolwiek dokumenty inFakt i status nie jest CASH/NONE
  // Ostrzegaj delikatnie, bo może być ręczna zmiana z powodu
  if (invoices.length > 0 && status !== PaymentStatus.CASH) {
    return 'Zlecenie ma powiązane dokumenty w inFakt';
  }
  
  return null;
}

/**
 * Pokazuje confirm dialog z ostrzeżeniem o nadpisaniu automatyki
 * Zwraca true jeśli użytkownik potwierdził, false jeśli anulował
 */
export function confirmManualOverride(reason: string): boolean {
  const message = `Ten status został ustawiony automatycznie na podstawie dokumentów w inFakt (${reason}).\n\n` +
    `Zmiana ręczna NIE zmieni dokumentów w inFakt.\n` +
    `Czy na pewno chcesz zmienić status?`;
  
  return window.confirm(message);
}

/**
 * Sprawdza czy zmiana statusu wymaga potwierdzenia
 * i pokazuje dialog jeśli tak.
 * 
 * @returns true jeśli można kontynuować, false jeśli użytkownik anulował
 */
export function checkPaymentStatusChange(
  job: Job,
  newStatus: PaymentStatus,
  source: 'manual' | 'auto'
): boolean {
  // Automatyczne zmiany zawsze przepuszczamy
  if (source === 'auto') {
    console.log(`[PaymentStatus] Auto change: ${job.paymentStatus} -> ${newStatus} (source: ${source})`);
    return true;
  }
  
  // Brak zmiany - przepuszczamy
  if (job.paymentStatus === newStatus) {
    return true;
  }
  
  // Sprawdź czy obecny status mógł być auto-ustawiony
  const reason = getAutoPaymentReason(job);
  
  if (!reason) {
    // Brak powodu do ostrzeżenia - przepuszczamy
    console.log(`[PaymentStatus] Manual change: ${job.paymentStatus} -> ${newStatus} (no auto-reason)`);
    return true;
  }
  
  // Jest powód - pytamy użytkownika
  console.log(`[PaymentStatus] Manual override attempt: ${job.paymentStatus} -> ${newStatus}, reason: ${reason}`);
  const confirmed = confirmManualOverride(reason);
  
  if (confirmed) {
    console.log(`[PaymentStatus] User confirmed manual override`);
  } else {
    console.log(`[PaymentStatus] User cancelled manual override`);
  }
  
  return confirmed;
}

