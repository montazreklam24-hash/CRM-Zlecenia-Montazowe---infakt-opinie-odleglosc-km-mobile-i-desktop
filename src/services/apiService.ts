import { Job, JobOrderData, ChecklistItem, JobColumnId, User, JobStatus, PaymentType } from '../types';

// TRYB DEMO - bez backendu
const DEMO_MODE = false;

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
  {
    id: '1',
    friendlyId: '#2024/001',
    createdAt: Date.now() - 86400000 * 2,
    status: JobStatus.NEW,
    columnId: 'MON',
    data: {
      jobTitle: 'Biedronka - Marszałkowska 100 - 5km - Montaż kasetonu',
      clientName: 'Jeronimo Martins',
      companyName: 'Biedronka Sp. z o.o.',
      contactPerson: 'Jan Kowalski',
      phoneNumber: '+48 500 100 200',
      address: 'ul. Marszałkowska 100, 00-001 Warszawa',
      locations: [{ fullAddress: 'ul. Marszałkowska 100, Warszawa', shortLabel: 'Marszałkowska 100', distance: '5 km' }],
      coordinates: { lat: 52.2297, lng: 21.0122 },
      scopeWorkText: '- Demontaż starego kasetonu LED\\n- Montaż nowego kasetonu 3x1m\\n- Podłączenie elektryczne\\n- Testy świetlne',
      scopeWorkImages: 'Kaseton aluminiowy, wymiary 300x100cm, podświetlenie LED, litery przestrzenne.',
      payment: { type: PaymentType.TRANSFER, netAmount: 2500, grossAmount: 3075 }
    },
    projectImages: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'],
    adminNotes: 'Klucze do lokalu u ochrony. Wejście od tyłu budynku.',
    checklist: [
      { id: '1', task: 'Sprawdzić wymiary przed montażem', isChecked: false, addedBy: 'Admin' },
      { id: '2', task: 'Zrobić zdjęcia przed i po', isChecked: false, addedBy: 'Admin' },
      { id: '3', task: 'Podpisać protokół odbioru', isChecked: false, addedBy: 'Admin' }
    ]
  },
  {
    id: '2',
    friendlyId: '#2024/002',
    createdAt: Date.now() - 86400000,
    status: JobStatus.IN_PROGRESS,
    columnId: 'TUE',
    data: {
      jobTitle: 'Rossmann - Złota 44 - 3km - Oklejanie witryn',
      clientName: 'Rossmann Polska',
      contactPerson: 'Anna Nowak',
      phoneNumber: '+48 600 200 300',
      address: 'ul. Złota 44, 00-120 Warszawa',
      locations: [],
      coordinates: { lat: 52.2320, lng: 21.0050 },
      scopeWorkText: '- Oklejenie 4 witryn folią OWV\\n- Wymiary: 2x 200x150cm, 2x 100x150cm\\n- Projekt dostarczony przez klienta',
      scopeWorkImages: '',
      payment: { type: PaymentType.CASH, grossAmount: 1800 }
    },
    projectImages: ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'],
    adminNotes: 'Montaż po godzinach otwarcia (po 21:00)',
    checklist: [
      { id: '1', task: 'Oczyścić szyby przed oklejeniem', isChecked: true, addedBy: 'Admin' },
      { id: '2', task: 'Sprawdzić projekt z klientem', isChecked: false, addedBy: 'Admin' }
    ]
  },
  {
    id: '3',
    friendlyId: '#2024/003',
    createdAt: Date.now() - 86400000 * 5,
    status: JobStatus.NEW,
    columnId: 'PREPARE',
    data: {
      jobTitle: 'Apteka Gemini - Puławska 15 - 8km - Litery 3D',
      clientName: 'Apteka Gemini',
      contactPerson: 'Piotr Wiśniewski',
      phoneNumber: '+48 700 300 400',
      address: 'ul. Puławska 15, 02-515 Warszawa',
      locations: [],
      coordinates: { lat: 52.2050, lng: 21.0280 },
      scopeWorkText: 'Montaż liter przestrzennych LED na elewacji. Logo apteki + napis APTEKA.',
      scopeWorkImages: 'Litery styrodurowe pokryte dibondem, podświetlenie od tyłu (halo effect).',
      payment: { type: PaymentType.UNKNOWN }
    },
    projectImages: [],
    checklist: []
  },
  {
    id: '4',
    friendlyId: '#2024/004',
    createdAt: Date.now() - 86400000 * 10,
    status: JobStatus.COMPLETED,
    columnId: 'COMPLETED',
    data: {
      jobTitle: 'McDonald\'s - Aleje Jerozolimskie 50 - Totem reklamowy',
      clientName: 'McDonald\'s Polska',
      contactPerson: 'Marek Zieliński',
      phoneNumber: '+48 800 400 500',
      address: 'Aleje Jerozolimskie 50, Warszawa',
      locations: [],
      coordinates: { lat: 52.2280, lng: 21.0000 },
      scopeWorkText: 'Montaż totemu reklamowego przy wjeździe na parking.',
      scopeWorkImages: '',
      payment: { type: PaymentType.TRANSFER, netAmount: 8000, grossAmount: 9840 }
    },
    projectImages: ['https://images.unsplash.com/photo-1619454016518-697bc231e7cb?w=400'],
    completedAt: Date.now() - 86400000 * 3,
    completionNotes: 'Montaż wykonany zgodnie ze specyfikacją. Klient zadowolony.',
    checklist: [
      { id: '1', task: 'Wykop pod fundament', isChecked: true, addedBy: 'Admin' },
      { id: '2', task: 'Montaż słupa', isChecked: true, addedBy: 'Admin' },
      { id: '3', task: 'Podłączenie elektryczne', isChecked: true, addedBy: 'Admin' }
    ]
  },
  {
    id: '5',
    friendlyId: '#2024/005',
    createdAt: Date.now(),
    status: JobStatus.NEW,
    columnId: 'FRI',
    data: {
      jobTitle: 'Żabka - Mokotowska 25 - 4km - Wymiana oklejenia',
      clientName: 'Żabka Polska',
      contactPerson: 'Tomasz Adamski',
      phoneNumber: '+48 510 600 700',
      address: 'ul. Mokotowska 25, Warszawa',
      locations: [],
      coordinates: { lat: 52.2180, lng: 21.0150 },
      scopeWorkText: 'Zdjęcie starego oklejenia + nowe zgodnie z nowym brandingiem Żabki.',
      scopeWorkImages: '',
      payment: { type: PaymentType.TRANSFER }
    },
    projectImages: ['https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400'],
    checklist: []
  }
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
  
  // Parsuj odpowiedź
  const data = await response.json();
  
  // Obsługa błędów
  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.location.reload();
    }
    throw new Error(data.error || data.message || 'Wystąpił błąd');
  }
  
  return data;
}

// =====================================================
// AUTH API
// =====================================================

export const authService = {
  async login(login: string, password: string): Promise<{ user: User; token: string }> {
    if (DEMO_MODE) {
      // Demo login - akceptuje dowolne dane
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
      let jobs = [...DEMO_JOBS];
      if (params?.status) {
        jobs = jobs.filter(j => j.status === params.status);
      }
      if (params?.column) {
        jobs = jobs.filter(j => j.columnId === params.column);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        jobs = jobs.filter(j => 
          j.data.jobTitle?.toLowerCase().includes(q) ||
          j.data.clientName?.toLowerCase().includes(q) ||
          j.data.address?.toLowerCase().includes(q)
        );
      }
      return jobs.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.column) queryParams.append('column', params.column);
    if (params?.search) queryParams.append('search', params.search);
    
    const query = queryParams.toString();
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
      const newJob: Job = {
        id: String(Date.now()),
        friendlyId: `#2024/${String(DEMO_JOBS.length + 1).padStart(3, '0')}`,
        createdAt: Date.now(),
        status: JobStatus.NEW,
        columnId: 'PREPARE',
        data,
        projectImages: images,
        adminNotes,
        checklist: checklist || []
      };
      DEMO_JOBS.unshift(newJob);
      return newJob;
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
      const index = DEMO_JOBS.findIndex(j => j.id === id);
      if (index === -1) throw new Error('Zlecenie nie istnieje');
      
      const job = DEMO_JOBS[index];
      const updatedJob = {
        ...job,
        ...updates,
        data: updates.data ? { ...job.data, ...updates.data } : job.data
      };
      DEMO_JOBS[index] = updatedJob;
      return updatedJob;
    }
    
    const response = await apiRequest<{ success: boolean; job: Job }>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    return response.job;
  },
  
  async updateJobColumn(id: string, columnId: JobColumnId, orderIndex?: number): Promise<void> {
    if (DEMO_MODE) {
      const job = DEMO_JOBS.find(j => j.id === id);
      if (job) {
        job.columnId = columnId;
        if (orderIndex !== undefined) {
          job.order = orderIndex;
        }
        if (columnId === 'COMPLETED') {
          job.status = JobStatus.COMPLETED;
        }
      }
      return;
    }
    
    const body: any = { columnId };
    if (orderIndex !== undefined) {
      body.order = orderIndex;
    }
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async updateJobPosition(id: string, columnId: JobColumnId, order: number): Promise<void> {
    if (DEMO_MODE) {
      const job = DEMO_JOBS.find(j => j.id === id);
      if (job) {
        job.columnId = columnId;
        job.order = order;
        if (columnId === 'COMPLETED') {
          job.status = JobStatus.COMPLETED;
        }
      }
      return;
    }
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ columnId, order }),
    });
  },
  
  async completeJob(id: string, notes: string, images: string[]): Promise<void> {
    if (DEMO_MODE) {
      const job = DEMO_JOBS.find(j => j.id === id);
      if (job) {
        job.status = JobStatus.COMPLETED;
        job.columnId = 'COMPLETED';
        job.completedAt = Date.now();
        job.completionNotes = notes;
        job.completionImages = images;
      }
      return;
    }
    
    await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        complete: true,
        completionNotes: notes,
        completionImages: images,
      }),
    });
  },
  
  async deleteJob(id: string): Promise<void> {
    if (DEMO_MODE) {
      DEMO_JOBS = DEMO_JOBS.filter(j => j.id !== id);
      return;
    }
    
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
};

// =====================================================
// GEMINI API (proxy przez backend)
// =====================================================

export const geminiService = {
  async parseEmail(text: string, images: string[]): Promise<JobOrderData & { suggestedTitle?: string }> {
    if (DEMO_MODE) {
      // Demo: symuluj odpowiedź AI
      await new Promise(resolve => setTimeout(resolve, 1500)); // Symuluj opóźnienie
      
      // Proste parsowanie tekstu
      const phoneMatch = text.match(/(\+?\d[\d\s-]{8,})/);
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      
      return {
        suggestedTitle: 'Nowe zlecenie - ' + new Date().toLocaleDateString('pl-PL'),
        jobTitle: 'Nowe zlecenie - ' + new Date().toLocaleDateString('pl-PL'),
        clientName: 'Klient z maila',
        contactPerson: '',
        phoneNumber: phoneMatch ? phoneMatch[1].trim() : '',
        address: 'Warszawa (do uzupełnienia)',
        locations: [],
        scopeWorkText: text.substring(0, 500) || 'Brak opisu - uzupełnij ręcznie.',
        scopeWorkImages: images.length > 0 ? `Przesłano ${images.length} załącznik(ów) do analizy.` : '',
        payment: { type: PaymentType.UNKNOWN }
      };
    }
    
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
    if (DEMO_MODE) {
      return {
        app_name: 'Montaż Reklam 24 - DEMO',
        default_logo: '',
        base_address: 'ul. Poprawna 39R, Warszawa'
      };
    }
    
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

// Eksport domyślny dla kompatybilności wstecznej
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

