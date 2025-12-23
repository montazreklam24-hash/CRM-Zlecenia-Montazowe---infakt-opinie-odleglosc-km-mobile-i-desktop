/**
 * Invoice Service - Serwis do obsługi faktur
 * Integracja z API /api/invoices
 */

import { Invoice, InvoiceItem, PaymentStatus } from '../types';

// Base API URL
const API_BASE = '/api';

// Helper do requestów
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Dodaj token jeśli jest
  const token = localStorage.getItem('authToken');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

// Interfejsy dla danych klienta
export interface InvoiceClientData {
  companyName?: string;
  firstName?: string;
  lastName?: string;
  nip?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postCode?: string;
}

// Interfejs dla pozycji faktury
export interface InvoiceItemData {
  name: string;
  quantity: number;
  unitPriceNet: number;
  vatRate: number;
  unit?: string;
}

// Interfejs dla odpowiedzi z API
export interface InvoiceResponse {
  success: boolean;
  invoice?: {
    id: number;
    number: string;
    type: 'proforma' | 'vat';
    shareLink?: string;
    emailSent?: boolean;
    isPaid?: boolean;
  };
  error?: string;
}

// =============================================================================
// INVOICE SERVICE
// =============================================================================

export const invoiceService = {
  /**
   * Utwórz proformę
   */
  async createProforma(
    jobId: string,
    items: InvoiceItemData[],
    clientData: InvoiceClientData,
    options?: {
      description?: string;
      installAddress?: string;
      dueDays?: number;
      sendEmail?: boolean;
    }
  ): Promise<InvoiceResponse> {
    return apiRequest<InvoiceResponse>('/invoices', {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        items,
        ...clientData,
        type: 'proforma',
        description: options?.description || '',
        installAddress: options?.installAddress || '',
        dueDays: options?.dueDays || 7,
        sendEmail: options?.sendEmail || false,
      }),
    });
  },

  /**
   * Utwórz fakturę VAT
   */
  async createInvoice(
    jobId: string,
    items: InvoiceItemData[],
    clientData: InvoiceClientData,
    options?: {
      description?: string;
      installAddress?: string;
      dueDays?: number;
      sendEmail?: boolean;
      markAsPaid?: boolean;
      paymentMethod?: 'transfer' | 'cash' | 'card';
    }
  ): Promise<InvoiceResponse> {
    return apiRequest<InvoiceResponse>('/invoices/invoice', {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        items,
        ...clientData,
        type: 'vat',
        description: options?.description || '',
        installAddress: options?.installAddress || '',
        dueDays: options?.dueDays || 14,
        sendEmail: options?.sendEmail || false,
        markAsPaid: options?.markAsPaid || false,
        paymentMethod: options?.paymentMethod || 'transfer',
      }),
    });
  },

  /**
   * Wyślij fakturę emailem
   */
  async sendInvoiceEmail(invoiceId: number, email: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>('/invoices/send', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        email,
      }),
    });
  },

  /**
   * Pobierz dane faktury
   */
  async getInvoice(invoiceId: number): Promise<{ success: boolean; invoice: any }> {
    return apiRequest<{ success: boolean; invoice: any }>(`/invoices/${invoiceId}`, {
      method: 'GET',
    });
  },

  /**
   * Pobierz faktury dla zlecenia
   */
  async getJobInvoices(jobId: string): Promise<{ success: boolean; invoices: Invoice[] }> {
    return apiRequest<{ success: boolean; invoices: Invoice[] }>(`/invoices/job/${jobId}`, {
      method: 'GET',
    });
  },

  /**
   * Pobierz wszystkie faktury
   */
  async getAllInvoices(params?: { type?: string; status?: string }): Promise<{ success: boolean; invoices: Invoice[] }> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiRequest<{ success: boolean; invoices: Invoice[] }>(`/invoices${query}`, {
      method: 'GET',
    });
  },

  /**
   * Oznacz fakturę jako opłaconą
   */
  async markAsPaid(invoiceId: number, paidDate?: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>('/invoices/mark-paid', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        paidDate: paidDate || new Date().toISOString().split('T')[0],
      }),
    });
  },

  /**
   * Pobierz URL do PDF faktury
   */
  getPdfUrl(invoiceId: number): string {
    const token = localStorage.getItem('authToken');
    return `${API_BASE}/invoices/pdf/${invoiceId}${token ? `?token=${token}` : ''}`;
  },

  /**
   * Pobierz dane firmy po NIP (przez GUS)
   */
  async lookupNip(nip: string): Promise<{
    success: boolean;
    company?: {
      name: string;
      street: string;
      city: string;
      postCode: string;
      nip: string;
    };
    error?: string;
  }> {
    return apiRequest<any>(`/gus/nip/${nip}`, {
      method: 'GET',
    });
  },

  /**
   * Sprawdź status płatności faktury w inFakt
   */
  async checkInvoiceStatus(invoiceId: number): Promise<{
    success: boolean;
    invoiceId: number;
    infaktNumber?: string;
    paymentStatus: 'paid' | 'unpaid' | 'partially_paid' | 'unknown';
    isPaid: boolean;
    paidDate?: string;
    totalGross: number;
    clientName: string;
    invoiceType: 'proforma' | 'vat';
    error?: string;
  }> {
    return apiRequest<any>(`/invoices/check-status/${invoiceId}`, {
      method: 'GET',
    });
  },

  /**
   * Synchronizuj status wszystkich faktur z inFakt
   */
  async syncStatus(): Promise<{
    success: boolean;
    total: number;
    updated: number;
    errors: number;
    message: string;
  }> {
    return apiRequest<any>('/invoices/sync-status', {
      method: 'POST',
    });
  },

  /**
   * Podepnij istniejącą fakturę z inFakt do zlecenia
   */
  async attachInvoice(
    jobId: string,
    infaktId: number,
    clientId?: number
  ): Promise<{
    success: boolean;
    invoice?: {
      id: number;
      infaktId: number;
      number: string;
      type: 'proforma' | 'vat';
      status: string;
      totalGross: number;
      shareLink?: string;
    };
    message?: string;
    error?: string;
  }> {
    return apiRequest<any>('/invoices/attach', {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        infaktId,
        clientId,
      }),
    });
  },
};

export default invoiceService;

