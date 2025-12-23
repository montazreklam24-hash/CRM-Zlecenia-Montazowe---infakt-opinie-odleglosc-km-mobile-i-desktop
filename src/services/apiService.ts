import { Job, JobOrderData, ChecklistItem, JobColumnId, User, JobStatus, PaymentType } from '../types';

// TRYB DEMO - bez backendu
const DEMO_MODE = false; // Pełna funkcjonalność z API

// Konfiguracja API
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// =====================================================
// DANE DEMO
// =====================================================
const DEMO_USER: User = {
  id: 1,
  email: 'admin@montazreklam24.pl',
  phone: '500000000',
  role: 'admin' as any,
  name: 'Administrator Demo',
  is_active: true,
  last_login: new Date().toISOString()
};

let DEMO_JOBS: Job[] = [
  // ... (zachowane demo jobs dla testów, choć w API mode nieużywane)
];

// Token storage
const TOKEN_KEY = 'crm_auth_token';

const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// HTTP helper
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
  
  // Parsuj odpowiedź - bezpiecznie
  let data: any;
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  
  // Odczytaj tekst odpowiedzi tylko raz
  let responseText = '';
  try {
    responseText = await response.text();
    if (endpoint.includes('send_completion_email')) {
      console.log('🔵 apiRequest: Surowa odpowiedź dla send_completion_email:', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        isJson,
        textLength: responseText.length,
        textPreview: responseText.substring(0, 500),
      });
    }
  } catch (textError) {
    console.error('🔴 Błąd odczytu odpowiedzi:', textError);
    responseText = '';
  }
  
  try {
    if (isJson && responseText) {
      data = JSON.parse(responseText);
      if (endpoint.includes('send_completion_email')) {
        console.log('🔵 apiRequest: Sparsowany JSON:', data);
      }
    } else if (responseText) {
      data = { error: responseText || `HTTP ${response.status}` };
    } else {
      data = { error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (parseError) {
    console.error('🔴 Błąd parsowania odpowiedzi API:', parseError, 'Response text:', responseText.substring(0, 200));
    data = { error: responseText || `Błąd parsowania odpowiedzi (HTTP ${response.status})` };
  }
  
  // Obsługa błędów
  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.location.reload();
    }
    const errorMsg = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
    console.error('🔴 apiRequest: Błąd HTTP', {
      status: response.status,
      statusText: response.statusText,
      error: errorMsg,
      data,
    });
    throw new Error(errorMsg);
  }
  
  return data;
}

// =====================================================
// AUTH API
// =====================================================

export const authService = {
  async login(login: string, password: string): Promise<{ user: User; token: string }> {
    if (DEMO_MODE) {
      setToken('demo-token-12345');
      return { user: DEMO_USER, token: 'demo-token-12345' };
    }
    
    const response = await apiRequest<{ success: boolean; user: User; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    
    if (response.token) {
      setToken(response.token);
    }
    
    return { user: response.user, token: response.token };
  },
  
  async logout(): Promise<void> {
    if (DEMO_MODE) {
      clearToken();
      return;
    }
    
    try {
      await apiRequest('/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  },
  
  async getCurrentUser(): Promise<User | null> {
    if (DEMO_MODE) {
      const token = getToken();
      return token ? DEMO_USER : null;
    }
    
    const token = getToken();
    if (!token) return null;
    
    try {
      const response = await apiRequest<{ success: boolean; user: User }>('/me');
      return response.user;
    } catch {
      clearToken();
      return null;
    }
  },
  
  isAuthenticated(): boolean {
    return !!getToken();
  },
  
  getToken,
  clearToken,
};

// =====================================================
// JOBS API
// =====================================================

export const jobsService = {
  async getJobs(params?: { status?: string; column?: string; search?: string }): Promise<Job[]> {
    if (DEMO_MODE) {
      return [...DEMO_JOBS];
    }
    
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.column) queryParams.append('column', params.column);
    if (params?.search) queryParams.append('search', params.search);
    
    const query = queryParams.toString();
    // Pobierz z ujednoliconego endpointu
    const response = await apiRequest<{ success: boolean; jobs: Job[] }>(
      `/jobs${query ? `?${query}` : ''}`
    );
    
    return response.jobs;
  },
  
  async getJob(id: string): Promise<Job> {
    if (DEMO_MODE) {
      const job = DEMO_JOBS.find(j => j.id === id);
      if (!job) throw new Error('Zlecenie nie istnieje');
      return job;
    }
    
    // Brak prefiksów, proste ID
    const response = await apiRequest<{ success: boolean; job: Job }>(`/jobs/${id}`);
    return response.job;
  },
  
  async createJob(
    data: JobOrderData,
    images: string[],
    adminNotes?: string,
    checklist?: ChecklistItem[]
  ): Promise<Job> {
    if (DEMO_MODE) {
      // ... demo logic ...
      return {} as Job;
    }
    
    const response = await apiRequest<{ success: boolean; job: Job }>('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        data,
        projectImages: images,
        adminNotes,
        checklist,
      }),
    });
    
    return response.job;
  },
  
  async updateJob(id: string, updates: Partial<Job> & { data?: Partial<JobOrderData> }): Promise<Job> {
    if (DEMO_MODE) {
      return {} as Job;
    }
    
    const response = await apiRequest<{ success: boolean; job: Job }>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    return response.job;
  },
  
  async updateJobColumn(id: string, columnId: JobColumnId, orderIndex?: number): Promise<void> {
    if (DEMO_MODE) return;
    
    const body: any = { columnId };
    if (orderIndex !== undefined) {
      body.columnOrder = orderIndex;
    }
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async updateJobPosition(id: string, columnId: JobColumnId, order: number): Promise<void> {
    if (DEMO_MODE) return;
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ columnId, columnOrder: order }),
    });
  },
  
  async completeJob(
    id: string, 
    data: {
      completionImages: string[];
      completionNotes: string;
      clientEmail?: string;
      sendEmail?: boolean;
      archiveJob?: boolean;
    }
  ): Promise<void> {
    const shouldArchive = data.archiveJob !== false;
    
    if (DEMO_MODE) return;
    
    // Wyślij email jeśli potrzeba
    let emailSent = false;
    if (data.sendEmail && data.clientEmail && data.completionImages.length > 0) {
      console.log('🔵 completeJob: Rozpoczynam wysyłkę emaila');
      const job = await this.getJob(id);
      try {
        const emailResult = await this.sendCompletionEmail({
          jobId: id,
          jobTitle: job.data.jobTitle || 'Zlecenie',
          toEmail: data.clientEmail,
          completionImage: data.completionImages[0],
          completionNotes: data.completionNotes,
        });
        
        console.log('🔵 completeJob: Wynik sendCompletionEmail:', emailResult);
        
        // Sprawdź czy email został wysłany poprawnie
        if (!emailResult.success) {
          const errorMsg = emailResult.error || 'Nie udało się wysłać emaila';
          console.error('🔴 completeJob: Błąd wysyłki emaila:', errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log('✅ completeJob: Email wysłany pomyślnie');
        emailSent = true;
      } catch (error: any) {
        // Jeśli błąd wysyłki emaila, rzuć go dalej z kontekstem
        console.error('🔴 completeJob: Błąd w catch:', error);
        const errorMessage = error.message || 'Nie udało się wysłać emaila';
        throw new Error(`Błąd wysyłki emaila: ${errorMessage}`);
      }
    }
    
    const updateData: any = {
      completionNotes: data.completionNotes,
      completionImages: data.completionImages,
    };
    
    if (shouldArchive) {
      updateData.status = 'ARCHIVED';
      updateData.columnId = 'ARCHIVE';
      updateData.completedAt = Date.now();
    }
    
    if (emailSent) {
      updateData.reviewRequestSentAt = Date.now();
      updateData.reviewRequestEmail = data.clientEmail;
    }
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },
  
  async deleteJob(id: string): Promise<void> {
    if (DEMO_MODE) return;
    
    // Prosty DELETE, bez typu
    await apiRequest(`/jobs/${id}`, { method: 'DELETE' });
  },
  
  async duplicateJob(originalId: string): Promise<Job> {
    const original = await this.getJob(originalId);
    
    const newJob = await this.createJob(
      original.data,
      original.projectImages,
      original.adminNotes,
      original.checklist?.map(item => ({ ...item, isChecked: false }))
    );
    
    return newJob;
  },

  async sendCompletionEmail(data: {
    jobId: string;
    jobTitle: string;
    toEmail: string;
    completionImage?: string;
    completionNotes?: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    if (DEMO_MODE) return { success: true };

    console.log('🔵 sendCompletionEmail START:', {
      jobId: data.jobId,
      jobTitle: data.jobTitle,
      toEmail: data.toEmail,
      hasImage: !!data.completionImage,
      imageLength: data.completionImage?.length || 0,
    });

    try {
      const requestBody = {
        job_id: data.jobId,
        job_title: data.jobTitle,
        to_email: data.toEmail,
        completion_image: data.completionImage,
        completion_notes: data.completionNotes,
      };
      
      console.log('🔵 Wysyłam request do /send_completion_email.php');
      
      const response = await apiRequest<{ success: boolean; message?: string; error?: string; details?: string }>(
        '/send_completion_email.php',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      console.log('🟢 Odpowiedź sendCompletionEmail:', response);

      // Sprawdź czy odpowiedź zawiera success: false
      if (response && response.success === false) {
        const errorMsg = response.error || response.details || 'Nie udało się wysłać emaila';
        console.error('🔴 Błąd wysyłki emaila:', errorMsg, response);
        return {
          success: false,
          error: errorMsg,
        };
      }

      console.log('✅ Email wysłany pomyślnie');
      return response || { success: true };
    } catch (error: any) {
      // Jeśli apiRequest rzucił błąd, zwróć go jako odpowiedź z success: false
      console.error('🔴 Błąd w sendCompletionEmail (catch):', {
        error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        response: error?.response,
      });
      const errorMessage = error?.message || error?.toString() || 'Nie udało się wysłać emaila';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

// =====================================================
// GEMINI API
// =====================================================

export const geminiService = {
  async parseEmail(text: string, images: string[]): Promise<JobOrderData & { suggestedTitle?: string }> {
    if (DEMO_MODE) return {} as any;
    
    const response = await apiRequest<{ success: boolean; data: JobOrderData & { suggestedTitle?: string } }>(
      '/gemini',
      {
        method: 'POST',
        body: JSON.stringify({ text, images }),
      }
    );
    
    return response.data;
  },
};

// =====================================================
// SETTINGS API
// =====================================================

export const settingsService = {
  async getSettings(): Promise<Record<string, string>> {
    if (DEMO_MODE) return { app_name: 'Demo' };
    const response = await apiRequest<{ success: boolean; settings: Record<string, string> }>('/settings');
    return response.settings;
  },
  
  async updateSettings(settings: Record<string, string>): Promise<void> {
    if (DEMO_MODE) return;
    await apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
  
  async getDefaultLogo(): Promise<string | null> {
    if (DEMO_MODE) return null;
    const settings = await this.getSettings();
    return settings.default_logo || null;
  },
  
  async saveDefaultLogo(logo: string): Promise<void> {
    if (DEMO_MODE) return;
    await this.updateSettings({ default_logo: logo });
  },
};

// =====================================================
// HELPER: Kompresja obrazu
// =====================================================

export const compressImage = async (base64Str: string): Promise<string> => {
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

export const storageService = {
  ...jobsService,
  ...settingsService,
  getStorageUsage: async () => ({ usedMB: 'N/A', percent: 0 }),
  createBackup: async () => {
    const jobs = await jobsService.getJobs();
    return JSON.stringify(jobs);
  },
  restoreBackup: async () => {
    console.warn('Backup restore not implemented for API mode');
  },
};
