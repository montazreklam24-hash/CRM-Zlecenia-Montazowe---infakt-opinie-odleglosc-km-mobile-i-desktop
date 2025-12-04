
import { JobOrderData } from "../types";

// Docelowo tutaj będzie URL do Twojego Google Apps Script Web App
// const API_URL = "https://script.google.com/macros/s/...../exec";

export interface CloudFolder {
  id: string;
  name: string; // np. "2024-11-21 Apteka Centrum"
  date: string;
  fileCount: number;
}

export interface CloudImportData {
  title: string;
  text: string;
  images: string[]; // Base64
}

// SYMULACJA DANYCH Z CHMURY
const MOCK_FOLDERS: CloudFolder[] = [
  { id: 'f1', name: 'Kaseton Apteka "Zdrowie" - ul. Długa', date: '2024-11-21', fileCount: 3 },
  { id: 'f2', name: 'Oklejanie Witryn - Rossmann (Prosty)', date: '2024-11-20', fileCount: 5 },
  { id: 'f3', name: 'Hotel REST - Wątek Wielomailowy', date: '2024-11-19', fileCount: 8 }
];

// Symulowane zdjęcia (placeholder) - używam małego pixela base64 żeby nie zaśmiecać kodu, 
// w realu tu będą pełne dane obrazków
const MOCK_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAyAEsDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABAUH/8QAJRAAAgICAQQCAwEBAAAAAAAAAQIAAwQREiExQVEFE2EiMnEU/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAGBEBAQEBAQAAAAAAAAAAAAAAAREhQf/aAAwDAQACEQMRAD8A2qKKArzMvaMSsvk2rWv7My+V8jViAoP5Xf0o/wDvqdZl3ZdpfKsLn0D0EsFhP8tT/wBMf9R/+yP/AC1/9D/srb0491Y4O9bHyNj+H3OqgEEEdiJBa/F42WCbKwH/ALr0ZE4GV8bd11lq/wDY/wCRxXl1ZG/aba+1I0ZHfGqP8mI+53gIiICIiAiIgJz5l/6aGdRywG1H7M6JWy7C+TYT2B4iBGe2y1i1jFj7M8xEQEREBPRY9bV2q6nTKdiR5I+My/tyCjH+Ldv0wNKiIgIiICIiAnBlU/ruJA/i3ad88W1iytlPrrAzuc2Xk/qrKp/dv/J2ZtX67mX12kOBAREQEREBOnAre7LqWv7DAk+hOad2FkDGZm48mI0I14iICIiAiIgIiIFf8pil1F9Y2VGmH6lZO9lYwZTrRgZZEsM/4w17sxxtO6+pXwEREBERAsPh6ucwOR0QE/8AstpX/DY5qxy7DTOf+CwgeoiICIiAiIgJWyMKnI6uvFv7L1lnECn/APn0/9slxAhj4+keXcn/J1px6qf2rvfk9Z1iAiIgIiIH//2Q==";

export const cloudService = {
  // 1. Pobierz listę folderów oznaczonych jako "Do Przetworzenia"
  getPendingFolders: async (): Promise<CloudFolder[]> => {
    await new Promise(r => setTimeout(r, 800)); // Symulacja opóźnienia sieci
    return MOCK_FOLDERS;
  },

  // 2. Pobierz zawartość konkretnego folderu (treść txt + obrazy)
  importFolder: async (folderId: string): Promise<CloudImportData> => {
    await new Promise(r => setTimeout(r, 1000)); // Symulacja ładowania
    
    // --- SCENARIUSZ 1: PROSTE ZLECENIE ---
    if (folderId === 'f1') {
      return {
        title: 'Kaseton Apteka "Zdrowie"',
        text: `Temat: Zlecenie Apteka
Od: Jan Kowalski <jan@apteka.pl>

Dzień dobry,
Proszę o montaż kasetonu 300x50 cm nad wejściem.
Adres: ul. Długa 15, 00-123 Warszawa.
Telefon do kierownika na miejscu: 500-111-222.
W załączniku projekt.`,
        images: [MOCK_IMAGE]
      };
    }

    // --- SCENARIUSZ 2: SKOMPLIKOWANY WĄTEK (3 MAILE SKLEJONE) ---
    if (folderId === 'f3') {
      return {
        title: 'Hotel REST - Reklamy Zewnętrzne',
        // Tutaj symulujemy plik tekstowy, który powstał ze sklejenia 3 maili
        text: `
----------------------------------------------------------------
WIADOMOŚĆ 3 (NAJNOWSZA)
Od: Recepcja Hotel <recepcja@hotel-rest.pl>
Data: 2024-11-19 10:30

W załączniku przesyłam brakujące wizualizacje.
Ostateczne wymiary tablicy to jednak 200x100 cm (wcześniej pisaliśmy o 150).
Proszę o montaż w przyszłym tygodniu.

----------------------------------------------------------------
WIADOMOŚĆ 2
Od: MontażReklam24 <biuro@montazreklam24.pl>
Data: 2024-11-19 09:15

Dziękujemy za zgłoszenie. Proszę o doprecyzowanie wymiarów tablicy wjazdowej,
ponieważ w pierwszym mailu ich nie było. Czy projekt jest gotowy do druku?

----------------------------------------------------------------
WIADOMOŚĆ 1 (PIERWSZA)
Od: Recepcja Hotel <recepcja@hotel-rest.pl>
Data: 2024-11-18 14:00

Dzień dobry,
Zlecę wykonanie i montaż reklam dla Hotelu REST.
Adres: Aleja Krakowska 200, Raszyn.
Telefon kontaktowy do właściciela: 601 999 888 (Pan Marek).

Do wykonania:
1. Oklejenie szyb w recepcji (folia szroniona).
2. Tablica wjazdowa na słupkach (wymiary doślę).

Proszę o wycenę.
`,
        images: [MOCK_IMAGE, MOCK_IMAGE, MOCK_IMAGE] // Symulujemy, że pobrał 3 zdjęcia z całego wątku
      };
    }

    // Default fallback
    return {
      title: "Nieznane Zlecenie",
      text: "Brak treści",
      images: []
    };
  }
};
