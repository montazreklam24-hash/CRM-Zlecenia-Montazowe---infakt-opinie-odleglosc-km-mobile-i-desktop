export enum PaymentType {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  UNKNOWN = 'UNKNOWN'
}

// Status płatności na zleceniu (widoczny na Kanban)
export enum PaymentStatus {
  NONE = 'none',           // Brak dokumentu - szary
  PROFORMA = 'proforma',   // Wystawiona proforma - pomarańczowy
  PARTIAL = 'partial',     // Częściowo opłacone (zaliczka) - fioletowy
  PAID = 'paid',           // Opłacone - zielony
  CASH = 'cash',           // Barter (bez faktury) - żółty
  OVERDUE = 'overdue'      // Przeterminowane - czerwony
}

export enum JobStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export enum UserRole {
  ADMIN = 'admin',
  WORKER = 'worker',
  PRINTER = 'printer'
}

export type JobColumnId = 'PREPARE' | 'ANYTIME' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN' | 'COMPLETED' | 'ARCHIVE';

// =========================================================================
// KLIENCI
// =========================================================================

export interface Client {
  id: number;
  type: 'company' | 'person';
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  nip: string | null;
  regon: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  website: string | null;
  street: string | null;
  buildingNo: string | null;
  apartmentNo: string | null;
  city: string | null;
  postCode: string | null;
  country: string;
  fullAddress: string;
  paymentMethod: 'transfer' | 'cash' | 'card';
  paymentDays: number;
  notes: string | null;
  tags: string | null;
  source: string | null;
  rating: number | null;
  isActive: boolean;
  infaktId: number | null;
  createdAt: number;
  jobsCount?: number;
  invoicesCount?: number;
  totalPaid?: number;
}

// =========================================================================
// FAKTURY
// =========================================================================

export interface InvoiceItem {
  id?: number;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
  totalNet?: number;
  totalGross?: number;
}

export interface Invoice {
  id: number;
  jobId: number | null;
  clientId: number | null;
  type: 'proforma' | 'invoice' | 'advance' | 'correction';
  number: string;
  infaktId: number | null;
  infaktNumber: string | null;
  infaktLink: string | null;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  paymentMethod: 'transfer' | 'cash' | 'card' | 'online';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  paidAmount: number;
  paidDate: string | null;
  dueDate: string | null;
  issueDate: string | null;
  sellDate: string | null;
  description: string | null;
  notes: string | null;
  sentAt: number | null;
  sentTo: string | null;
  createdAt: number;
  items: InvoiceItem[];
  // Join data
  clientName?: string;
  jobFriendlyId?: string;
  jobTitle?: string;
}

// =========================================================================
// OFERTY
// =========================================================================

export interface OfferItem {
  id?: number;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
  totalNet?: number;
  totalGross?: number;
  isOptional?: boolean;
}

export interface Offer {
  id: number;
  clientId: number | null;
  jobId: number | null;
  offerNumber: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  validUntil: string | null;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  discountPercent: number;
  title: string | null;
  introduction: string | null;
  conclusion: string | null;
  notes: string | null;
  pdfPath: string | null;
  sentAt: number | null;
  sentTo: string | null;
  viewedAt: number | null;
  acceptedAt: number | null;
  rejectedAt: number | null;
  rejectionReason: string | null;
  createdAt: number;
  items: OfferItem[];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export interface ChecklistItem {
  id: string;
  task: string;
  isChecked: boolean;
  addedBy?: string;
  addedAt?: number;
  completedBy?: string;
  completedAt?: number;
}

export interface JobLocation {
  fullAddress: string;
  shortLabel: string;
  distance?: string;
}

export interface JobOrderData {
  jobTitle: string;
  clientName: string;
  companyName?: string;
  contactPerson?: string;
  phoneNumber: string;
  email?: string;
  nip?: string;
  address: string;
  locations?: JobLocation[];
  coordinates?: { lat: number; lng: number };
  distanceKm?: number;
  scopeWorkText?: string;
  description?: string;
  scopeWorkImages?: string;
  scheduledDate?: string;
  timeSlotStart?: string; // np. "08:00"
  timeSlotEnd?: string;   // np. "16:00"
  paymentStatus?: string;
  payment?: {
    type?: PaymentType;
    netAmount?: number;
    grossAmount?: number;
  };
}

export interface JobAttachment {
  id?: number;
  name: string;
  type: string;
  size: number;
  data: string;
  createdAt?: number;
}

export interface Job {
  id: string;
  friendlyId?: string;
  type?: 'ai' | 'simple';
  createdAt: number;
  status: JobStatus;
  columnId?: JobColumnId;
  columnOrder?: number;
  order?: number; // kolejność w kolumnie
  data: JobOrderData;
  projectImages: string[];
  completionImages?: string[];
  attachments?: JobAttachment[];
  customLogo?: string;
  adminNotes?: string;
  checklist?: ChecklistItem[];
  completedAt?: number;
  completionNotes?: string;
  reviewRequestSentAt?: number; // Data wysłania prośby o opinię
  reviewRequestEmail?: string;  // Email na który wysłano prośbę
  hasClientReview?: boolean;    // Czy klient zostawił opinię
  // Nowe pola CRM v2
  clientId?: number;
  client?: Client;
  paymentStatus?: PaymentStatus;
  totalNet?: number;
  totalGross?: number;
  paidAmount?: number;
  invoices?: Invoice[];
  gmailThreadId?: string;
}

export interface User {
  id: number;
  email: string | null;
  phone: string | null;
  role: UserRole;
  name: string;
  is_active: boolean;
  last_login: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export interface AppState {
  currentView: 'LOGIN' | 'DASHBOARD' | 'CREATE' | 'VIEW_JOB';
  auth: AuthState;
  selectedJobId: string | null;
  inputText: string;
  selectedImages: string[];
  isProcessing: boolean;
  tempJobData: JobOrderData | null;
  error: string | null;
}