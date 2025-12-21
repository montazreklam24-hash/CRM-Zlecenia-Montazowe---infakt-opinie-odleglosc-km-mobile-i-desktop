# Dokumentacja Wersji Projektu - CRM Montaż Reklam 24

## 📦 Wersja Alpha v1.0 (Obecna)
**Data:** 18 grudnia 2025
**Status:** Produkcyjna (Alpha)

---

### 🏗️ Infrastruktura (Tech Stack)

#### Frontend
*   **Framework:** React 18 + TypeScript
*   **Build Tool:** Vite
*   **Stylizacja:** Tailwind CSS
*   **Główne Biblioteki:**
    *   `@dnd-kit/core`: Obsługa Drag & Drop (Tablica Kanban).
    *   `leaflet`, `react-leaflet`: Mapy OpenStreetMap.
    *   `axios`: Komunikacja z API.
    *   `lucide-react`: Ikony.

#### Backend
*   **Język:** PHP 5.6+ (Kompatybilność wsteczna).
*   **Typ:** Native REST API (bez frameworka).
*   **Struktura:** Pliki w katalogu `/api`.
*   **Uploads:** Pliki przechowywane w katalogu `uploads/` (root), ścieżki w bazie względne.

#### Baza Danych
*   **System:** MySQL / MariaDB.
*   **Główne Tabele:** `jobs` (zlecenia), `users` (użytkownicy), `clients` (klienci).

---

### ✅ Funkcjonalności (Co działa)

#### 1. Dashboard (Kanban)
*   **Widok 7 kolumn:** Do przygotowania, Poniedziałek-Piątek, Wykonane, Archiwum.
*   **Przenoszenie:** Drag & Drop kart między kolumnami.
*   **Sortowanie:** Zmiana kolejności w obrębie kolumny.

#### 2. Zarządzanie Zleceniami
*   **Dodawanie:** Formularz prosty + Parser AI.
*   **Gemini AI:** Wklejasz treść maila -> AI wypełnia formularz (Adres, Klient, Opis).
*   **Edycja:** Pełna edycja danych, notatek, statusów.
*   **Płatności:** Oznaczanie statusu (Proforma, Zaliczka, Gotówka, Opłacone).

#### 3. Multimedia i Pliki
*   **Zdjęcia:** Upload wielu zdjęć naraz (Drag & Drop).
*   **Optymalizacja:** Automatyczna kompresja po stronie serwera.
*   **Galeria:** Podgląd zdjęć, ustawianie okładki.

#### 4. Mapy i Geolokalizacja
*   **Geocoding:** Automatyczna zamiana adresu na współrzędne (Google Maps API).
*   **Widok Mapy:** Wszystkie aktywne zlecenia na mapie.
*   **Nawigacja:** Szybki link do Google Maps na karcie zlecenia.

#### 5. Archiwum
*   **Historia:** Przeglądanie wykonanych zleceń z podziałem na miesiące.
*   **Przywracanie:** Możliwość powrotu zlecenia z archiwum na tablicę.

---

### 🐛 Znane Błędy (Known Issues) - v1.0

#### Krytyczne (High Priority)
1.  **[PC UI] Dropdowny:** Menu kontekstowe (np. "Przenieś do", zmiana statusu płatności) jest ucinane przez krawędzie kolumn lub przykrywane przez inne karty. Uniemożliwia to wygodną obsługę.
2.  **[Mobile UI] Niekompletna Karta:** Widok mobilny wyświetla tylko nagłówek zlecenia. Brakuje sekcji edycji adresu, opisu, notatek i checklisty.

#### Średnie (Medium Priority)
3.  **[Security] Logowanie:** System logowania w kodzie istnieje (`auth.php`), ale wymaga audytu bezpieczeństwa i wymuszenia przez `.htaccess` na produkcji.
4.  **[UX] Powrót z Archiwum:** Przywracane zlecenie trafia w nieokreślone miejsce (często na koniec listy), zamiast na początek "Do przygotowania".

#### Niskie (Low Priority)
5.  **[Performance] Ładowanie zdjęć:** Przy dużej liczbie zdjęć w galerii ładowanie może chwilę trwać (brak lazy loading na miniaturach wewnątrz modala).

---

### 📝 Changelog (Historia Zmian)

*   **18.12.2025:** Utworzenie dokumentacji wersji v1.0.
*   **09.12.2025:** Naprawa ścieżek uploadu zdjęć (Backend Hotfix).
*   **01.12.2025:** Implementacja nowego parsera Gemini 2.0.











