/**
 * CRM Zlecenia Montażowe - API Service
 * Komunikacja z backendem PHP
 */

import { Job, JobStatus, JobOrderData, ChecklistItem, JobColumnId, UserRole } from '../types';

// Konfiguracja API
const API_BASE_URL = '/api';

// Token sesji przechowywany w localStorage
const TOKEN_KEY = 'crm_auth_token';
const USER_KEY = 'crm_user';

// ============================================
// TYPY
// ============================================

export interface AuthUser {
  id: number;
  email: string | null;
  phone: string | null;
  name: string;
  role: 'admin' | 'worker' | 'print_house';
}

export interface LoginResponse {
  success: boolean;
  token: string;
  expires_at: string;
  user: AuthUser;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================
// POMOCNICZE FUNKCJE
// ============================================

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getStoredUser(): AuthUser | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Funkcja do wykonywania requestów API
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  // Obsługa błędów autoryzacji
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Sesja wygasła');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Błąd API');
  }
  
  return data as T;
}

// Kompresja obrazu (zachowana z oryginalnego storageService)
const compressImage = async (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1600;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// ============================================
// SERWIS API
// ============================================

export const apiService = {
  // --- AUTORYZACJA ---
  
  /**
   * Logowanie użytkownika
   */
  login: async (login: string, password: string): Promise<AuthUser> => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    
    setToken(response.token);
    setStoredUser(response.user);
    
    return response.user;
  },
  
  /**
   * Wylogowanie
   */
  logout: async (): Promise<void> => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignoruj błędy - i tak wylogowujemy lokalnie
    }
    clearToken();
  },
  
  /**
   * Sprawdza czy użytkownik jest zalogowany
   */
  isAuthenticated: (): boolean => {
    return !!getToken();
  },
  
  /**
   * Pobiera aktualnego użytkownika
   */
  getCurrentUser: (): AuthUser | null => {
    return getStoredUser();
  },
  
  /**
   * Pobiera rolę użytkownika (konwersja na enum)
   */
  getUserRole: (): UserRole | null => {
    const user = getStoredUser();
    if (!user) return null;
    return user.role === 'admin' ? UserRole.ADMIN : UserRole.WORKER;
  },
  
  /**
   * Weryfikuje sesję z serwerem
   */
  verifySession: async (): Promise<AuthUser | null> => {
    if (!getToken()) return null;
    
    try {
      const user = await apiRequest<AuthUser>('/auth/me');
      setStoredUser(user);
      return user;
    } catch {
      clearToken();
      return null;
    }
  },
  
  // --- ZLECENIA ---
  
  /**
   * Pobiera listę zleceń
   */
  getJobs: async (params?: {
    status?: string;
    column_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const query = queryParams.toString();
    const endpoint = '/jobs' + (query ? `?${query}` : '');
    
    const response = await apiRequest<JobsResponse>(endpoint);
    return response.jobs;
  },
  
  /**
   * Pobiera szczegóły zlecenia
   */
  getJobById: async (id: string): Promise<Job | null> => {
    try {
      return await apiRequest<Job>(`/jobs/${id}`);
    } catch {
      return null;
    }
  },
  
  /**
   * Tworzy nowe zlecenie
   */
  createJob: async (
    data: JobOrderData,
    images: string[],
    customLogo?: string,
    adminNotes?: string,
    checklist?: ChecklistItem[]
  ): Promise<Job> => {
    // Kompresuj obrazy przed wysłaniem
    const compressedImages = await Promise.all(images.map(compressImage));
    
    const response = await apiRequest<{ success: boolean; id: number; friendlyId: string }>('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        projectImages: compressedImages,
        customLogo: customLogo ? await compressImage(customLogo) : undefined,
        adminNotes,
        checklist,
      }),
    });
    
    // Pobierz utworzone zlecenie
    const job = await apiService.getJobById(String(response.id));
    if (!job) throw new Error('Nie udało się pobrać utworzonego zlecenia');
    
    return job;
  },
  
  /**
   * Aktualizuje zlecenie
   */
  updateJob: async (id: string, updates: Partial<Job>): Promise<void> => {
    // Kompresuj nowe obrazy jeśli są
    if (updates.projectImages) {
      updates.projectImages = await Promise.all(updates.projectImages.map(compressImage));
    }
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  
  /**
   * Aktualizuje kolumnę zlecenia (Kanban drag & drop)
   */
  updateJobColumn: async (id: string, columnId: JobColumnId): Promise<void> => {
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ columnId }),
    });
  },
  
  /**
   * Oznacza zlecenie jako wykonane
   */
  completeJob: async (id: string, notes: string, images: string[]): Promise<void> => {
    const compressedImages = await Promise.all(images.map(compressImage));
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: JobStatus.COMPLETED,
        columnId: 'COMPLETED',
        completionNotes: notes,
        completionImages: compressedImages,
      }),
    });
  },
  
  /**
   * Duplikuje zlecenie
   */
  duplicateJob: async (originalJobId: string): Promise<string | null> => {
    // Pobierz oryginalne zlecenie
    const original = await apiService.getJobById(originalJobId);
    if (!original) return null;
    
    // Utwórz kopię
    const newJob = await apiService.createJob(
      original.data,
      original.projectImages || [],
      original.customLogo,
      original.adminNotes,
      original.checklist?.map(item => ({ ...item, isChecked: false }))
    );
    
    return newJob.id;
  },
  
  /**
   * Usuwa zlecenie
   */
  deleteJob: async (id: string): Promise<void> => {
    await apiRequest(`/jobs/${id}`, { method: 'DELETE' });
  },
  
  // --- AI (GEMINI) ---
  
  /**
   * Parsuje tekst maila przez Gemini AI
   */
  parseWithAI: async (text: string, images: string[]): Promise<JobOrderData & { suggestedTitle?: string }> => {
    return await apiRequest('/gemini', {
      method: 'POST',
      body: JSON.stringify({ text, images }),
    });
  },
  
  // --- BACKUP (kompatybilność wsteczna) ---
  
  createBackup: async (): Promise<string> => {
    const jobs = await apiService.getJobs();
    return JSON.stringify(jobs);
  },
  
  restoreBackup: async (jsonString: string): Promise<void> => {
    const jobs = JSON.parse(jsonString);
    if (!Array.isArray(jobs)) throw new Error('Nieprawidłowy format');
    
    for (const job of jobs) {
      await apiService.createJob(
        job.data,
        job.projectImages || [],
        job.customLogo,
        job.adminNotes,
        job.checklist
      );
    }
  },
  
  // --- STORAGE INFO ---
  
  getStorageUsage: async (): Promise<{ usedMB: string; percent: number }> => {
    // W przypadku API nie mamy bezpośredniego dostępu do info o storage
    // Można dodać endpoint w PHP który zwraca rozmiar folderu uploads
    return { usedMB: '-', percent: 0 };
  },
  
  // --- LOGO ---
  
  saveDefaultLogo: async (logo: string): Promise<void> => {
    const compressed = await compressImage(logo);
    localStorage.setItem('crm_default_logo', compressed);
  },
  
  getDefaultLogo: async (): Promise<string | null> => {
    return localStorage.getItem('crm_default_logo');
  },
  
  // --- GENEROWANIE ID ---
  
  generateNextJobId: async (): Promise<string> => {
    // ID generowane jest po stronie serwera
    const year = new Date().getFullYear();
    return `#${year}/???`;
  },
};

// Eksport dla kompatybilności wstecznej
export const storageService = apiService;

export default apiService;

