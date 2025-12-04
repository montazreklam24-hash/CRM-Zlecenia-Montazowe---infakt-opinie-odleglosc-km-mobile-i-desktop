
export enum PaymentType {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  UNKNOWN = 'UNKNOWN'
}

export enum JobStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  WORKER = 'WORKER'
}

export type JobColumnId = 'PREPARE' | 'ANYTIME' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN' | 'COMPLETED';

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
  fullAddress: string;   // Full address for Google Maps query
  shortLabel: string;    // Short format: "Street Number, City"
  distance?: string;     // Estimated distance from Base (e.g. "12 km")
}

export interface JobOrderData {
  jobTitle: string;
  clientName: string;
  companyName?: string;
  contactPerson: string;
  phoneNumber: string;
  address: string; // Kept as primary/summary address
  locations: JobLocation[]; // New: Array of specific locations
  
  coordinates?: { lat: number; lng: number }; // Added for Map View
  
  // Changed from array to split text fields
  scopeWorkText: string;   // Extracted from email body
  scopeWorkImages: string; // Extracted from image analysis (OCR)

  payment: {
    type: PaymentType;
    netAmount?: number;
    grossAmount?: number;
  };
}

export interface Job {
  id: string;
  friendlyId?: string;
  createdAt: number;
  status: JobStatus;
  columnId?: JobColumnId; // For Kanban Board
  data: JobOrderData;
  projectImages: string[];
  customLogo?: string;
  
  // Admin instructions
  adminNotes?: string;
  checklist?: ChecklistItem[];

  // Worker completion data
  completedAt?: number;
  completionNotes?: string;
  completionImages?: string[];
}

export interface User {
    role: UserRole;
    name: string;
}

export interface AppState {
  currentView: 'LOGIN' | 'DASHBOARD' | 'CREATE' | 'VIEW_JOB';
  currentUser: UserRole | null;
  currentUserName?: string;
  selectedJobId: string | null;
  
  inputText: string;
  selectedImages: string[];
  isProcessing: boolean;
  tempJobData: JobOrderData | null;
  error: string | null;
}