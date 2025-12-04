import { Job, JobStatus, JobOrderData, ChecklistItem, JobColumnId } from '../types';

const DB_NAME = 'MontazProDB';
const DB_VERSION = 1;
const STORE_NAME = 'jobs';
const OLD_STORAGE_KEY = 'montazpro_db_v1'; // Do migracji ze starej wersji

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Kompresja zdjęć (nadal warto kompresować dla szybkości działania, ale mniej agresywnie)
const compressImage = async (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1600; // Zwiększono z 1280 bo mamy więcej miejsca
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
      // Kompresja JPEG 80% (lepsza jakość)
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// --- INDEXED DB HELPERS ---
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Funkcja migracji: Przenosi dane z LocalStorage do IndexedDB raz i czyści starą pamięć
const migrateFromLocalStorage = async () => {
  const oldData = localStorage.getItem(OLD_STORAGE_KEY);
  if (oldData) {
    try {
      const jobs = JSON.parse(oldData);
      if (Array.isArray(jobs) && jobs.length > 0) {
        console.log(`Migracja ${jobs.length} zleceń z LocalStorage do IndexedDB...`);
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        for (const job of jobs) {
           store.put(job);
        }
        
        // Czekamy na zakończenie transakcji
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        
        // Czyścimy starą pamięć po udanej migracji
        localStorage.removeItem(OLD_STORAGE_KEY);
        console.log('Migracja zakończona.');
      }
    } catch (e) {
      console.error('Błąd migracji:', e);
    }
  }
};

export const storageService = {
  // Inicializacja bazy i migracja
  init: async () => {
      await migrateFromLocalStorage();
  },

  getJobs: async (): Promise<Job[]> => {
    await storageService.init(); // Upewnij się, że migracja zaszła
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const jobs = request.result as Job[];
        // Sortowanie malejąco po dacie
        resolve(jobs.sort((a, b) => b.createdAt - a.createdAt));
      };
      request.onerror = () => reject(request.error);
    });
  },

  getJobById: async (id: string): Promise<Job | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  saveDefaultLogo: async (logo: string): Promise<void> => {
    // Logo nadal trzymamy w LocalStorage bo jest małe i potrzebne synchronicznie przy starcie (czasami)
    const compressed = await compressImage(logo);
    localStorage.setItem('montazpro_default_logo', compressed);
  },

  getDefaultLogo: async (): Promise<string | null> => {
    return localStorage.getItem('montazpro_default_logo');
  },

  generateNextJobId: async (): Promise<string> => {
    const jobs = await storageService.getJobs();
    const year = new Date().getFullYear();
    const count = jobs.filter(j => new Date(j.createdAt).getFullYear() === year).length + 1;
    return `#${year}/${count.toString().padStart(3, '0')}`;
  },

  createJob: async (
    data: JobOrderData, 
    images: string[], 
    customLogo?: string, 
    adminNotes?: string,
    checklist?: ChecklistItem[]
  ): Promise<Job> => {
    
    const compressedImages = await Promise.all(images.map(compressImage));
    const compressedLogo = customLogo ? await compressImage(customLogo) : undefined;
    const friendlyId = await storageService.generateNextJobId();

    const newJob: Job = {
      id: Math.random().toString(36).substr(2, 9),
      friendlyId,
      createdAt: Date.now(),
      status: JobStatus.NEW,
      columnId: 'PREPARE',
      data,
      projectImages: compressedImages,
      customLogo: compressedLogo,
      adminNotes: adminNotes,
      checklist: checklist || [],
      completionImages: []
    };

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(newJob);
    
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(newJob);
        tx.onerror = () => reject(tx.error);
    });
  },

  duplicateJob: async (originalJobId: string): Promise<string | null> => {
    const originalJob = await storageService.getJobById(originalJobId);
    if (!originalJob) return null;

    const friendlyId = await storageService.generateNextJobId();
    const newId = Math.random().toString(36).substr(2, 9);

    const newJob: Job = {
      ...originalJob,
      id: newId,
      friendlyId: friendlyId,
      createdAt: Date.now(),
      status: JobStatus.NEW,
      columnId: 'PREPARE',
      completedAt: undefined,
      completionNotes: undefined,
      completionImages: [],
      checklist: originalJob.checklist?.map(item => ({...item, isChecked: false})) || []
    };

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(newJob);

    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(newId);
    });
  },

  updateJob: async (id: string, updates: Partial<Job>): Promise<void> => {
    if (updates.projectImages) {
       updates.projectImages = await Promise.all(updates.projectImages.map(compressImage));
    }
    
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Pobierz, zaktualizuj, zapisz
    const job = await new Promise<Job>((resolve) => {
        store.get(id).onsuccess = (e) => resolve((e.target as IDBRequest).result);
    });

    if (job) {
        store.put({ ...job, ...updates });
    }
  },

  updateJobColumn: async (id: string, columnId: JobColumnId): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const job = await new Promise<Job>((resolve) => {
        store.get(id).onsuccess = (e) => resolve((e.target as IDBRequest).result);
    });

    if (job) {
        let newStatus = job.status;
        if (columnId === 'COMPLETED') newStatus = JobStatus.COMPLETED;
        else if (job.status === JobStatus.COMPLETED) newStatus = JobStatus.IN_PROGRESS;
        
        store.put({ ...job, columnId, status: newStatus });
    }
  },

  completeJob: async (id: string, notes: string, images: string[]): Promise<void> => {
    const compressedImages = await Promise.all(images.map(compressImage));
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const job = await new Promise<Job>((resolve) => {
        store.get(id).onsuccess = (e) => resolve((e.target as IDBRequest).result);
    });

    if (job) {
        store.put({
          ...job,
          status: JobStatus.COMPLETED,
          columnId: 'COMPLETED',
          completedAt: Date.now(),
          completionNotes: notes,
          completionImages: compressedImages
        });
    }
  },

  deleteJob: async (id: string): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  },

  createBackup: async (): Promise<string> => {
    const jobs = await storageService.getJobs();
    return JSON.stringify(jobs);
  },
  
  // Funkcja przywracania kopii
  restoreBackup: async (jsonString: string): Promise<void> => {
    try {
        const jobs = JSON.parse(jsonString);
        if(!Array.isArray(jobs)) throw new Error("Nieprawidłowy format");
        
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Opcjonalnie: czyścimy bazę przed importem?
        // store.clear(); 
        
        for(const job of jobs) {
            store.put(job);
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject();
        });
    } catch (e) {
        alert("Błąd importu pliku JSON");
    }
  },

  getStorageUsage: async (): Promise<{ usedMB: string, percent: number }> => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 1; // Unikamy dzielenia przez 0
        
        const usedMB = (used / 1024 / 1024).toFixed(2);
        const percent = Math.round((used / quota) * 100);
        
        return { usedMB, percent };
    }
    return { usedMB: '?', percent: 0 };
  },

  generateDemoJobs: async (): Promise<void> => {
      // Bez zmian, po prostu wywoła createJob które teraz używa IndexedDB
      const titles = ['Montaż Szyldu Biedronka', 'Oklejanie Witryn Rossmann', 'Kaseton Apteka'];
      for (let i = 0; i < 3; i++) {
          await storageService.createJob({
              jobTitle: titles[i],
              clientName: 'Demo Klient',
              contactPerson: 'Jan Kowalski',
              phoneNumber: '500 100 200',
              address: 'ul. Testowa 1, Warszawa',
              locations: [],
              scopeWorkText: 'Test',
              scopeWorkImages: '',
              payment: { type: 'TRANSFER' as any }
          }, []);
      }
  }
};