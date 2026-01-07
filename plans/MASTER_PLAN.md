# 🚀 MASTER PLAN - CRM Montaż Reklam 24

Plik ten jest głównym źródłem prawdy dotyczącym rozwoju systemu, błędów do naprawienia i planowanych funkcjonalności.

---

## 🔴 PRIORYTET 1: PILNE NAPRAWY I UX (Błędy Krytyczne)

### 1.1 UI PC - Dropdowny (Re-fix) [DONE]
*   **Problem:** Dropdowny płatności i "Przenieś do" są ucinane lub nie wyświetlają się poprawnie (poprzednia poprawka z Portalem nie zadziałała).
*   **Zadanie:** Całkowite uproszczenie. Użycie globalnego stanu w `Dashboard` i renderowanie dropdownów jako bezpośrednich dzieci `body` lub prosty `div fixed` na wierzchu.

### 1.2 Zdjęcia - Ścieżki Uploadu [DONE]
*   **Problem:** Miniatury nie ładują się (404), ponieważ folder `uploads` jest w root, a kod szuka w `api/uploads`.
*   **Zadanie:** Aktualizacja `UPLOAD_DIR` i `UPLOADS_URL` w `api/config.php` i `api/images.php` na ścieżki względne do roota (`../uploads` i `/uploads`).

### 1.3 Mapy OSM (Leaflet) [DONE]
*   **Wymagania:**
    - Wyświetlanie pinezek dla wszystkich aktywnych zleceń.
    - Autogeokodowanie adresów przez Nominatim (z cache w DB).
    - Karty zleceń widoczne przy mapie (jak w Google Maps).
    - Przycisk **Fullscreen** dla mapy (do pracy na 2 monitory).
    - Przycisk **Odśwież** i tryb **LIVE**.

### 1.4 Sortowanie "DO PRZYGOTOWANIA" [DONE]
*   **Zadanie:** Dodanie strzałek funkcyjnych:
    - **Lewo/Prawo:** Przesunięcie o 1 pozycję.
    - **Góra:** Na sam początek listy (Top-Left).
    - **Dół:** Na sam koniec listy (Bottom-Right).

---

## 🟡 PRIORYTET 2: FUNKCJONALNOŚĆ I DANE (Business Logic)

### 2.1 Synchronizacja z inFakt [DONE]
*   **Problem:** Kwoty w CRM nie zgadzają się z tymi w inFakt.
*   **Zadanie:** Po utworzeniu dokumentu w inFakt, pobrać jego szczegóły (netto/brutto) i zaktualizować lokalną bazę. Upewnić się, że statusy "opłacone/nieopłacone" są zsynchronizowane.

### 2.2 Odświeżanie LIVE (Dashboard & Map) [DONE]
*   **Zadanie:** Implementacja mechanizmu odświeżania:
    - Polling co 10-15s (gdy okno aktywne).
    - **Lepsze:** `localStorage` event listener - zmiana w jednym oknie (np. edycja) wymusza odświeżanie w pozostałych.

### 2.3 Wartość Zlecenia (Orientacyjna vs Potwierdzona) [DONE]
*   **Zadanie:** Rozróżnienie kwot:
    - **Orientacyjna:** Z maila/AI/ręczna.
    - **Potwierdzona:** Z faktury/proformy inFakt.
    - UI powinno wyraźnie oznaczać, która kwota jest wyświetlana.

### 2.4 Import Maili (Automatyzacja) [DONE]
*   **Zadanie:** Przygotowanie endpointu API do przyjmowania danych z zewnętrznych skryptów (np. Google Apps Script), które będą monitorować etykietę "CRM" w Gmailu.

---

## 🔒 PRIORYTET 3: BEZPIECZEŃSTWO (Logowanie i Uprawnienia)

### 3.1 System Logowania [DONE]
*   **Status:** Endpoint `/api/login` istnieje, ale wymaga audytu i włączenia.
*   **Zadanie:**
    - Włączenie wymogu logowania na froncie.
    - Sesje oparte o tokeny w HttpOnly Cookie.
    - Funkcja "Zapamiętaj mnie" (30 dni).

### 3.2 Role i Uprawnienia [DONE]
*   **Rola Admin:** Pełny dostęp.
*   **Rola Worker (Pracownik):** 
    - Widzi: Adres, opis, telefon, zdjęcia, checklistę.
    - **Ukryte:** Dane finansowe (kwoty, faktury), notatki admina, zarządzanie użytkownikami.
    - **Wyjątek:** Widzi kwotę "do pobrania", jeśli status płatności to "Gotówka".

---

## 📱 PRIORYTET 4: WERSJA MOBILNA (UX Mobile First)

### 4.1 Karta Zlecenia na Mobile [DONE]
*   **Zadanie:** Dodanie brakujących sekcji (Adres, Opis, Notatki, Checklista). Usprawnienie galerii zdjęć. Przyklejenie paska akcji (Zapisz/Zakończ) na dole ekranu.

### 4.2 Mapy na Mobile (Google Maps)
*   **Zadanie:** 
    - Po kliknięciu pinezki: stała karta na dole ekranu z przyciskami "Nawiguj", "Zadzwoń", "Otwórz zlecenie".
    - Karta nie znika do momentu zamknięcia lub kliknięcia innej pinezki.

### 4.3 UI Mobile
*   **Zadanie:** Dodanie filtra/chipsa "WSZYSTKIE" (pokazuje wszystko poza Archiwum).

---

## 🏁 PLANOWANE PORZĄDKI (Techniczne)
- [ ] Przeniesienie starszych planów do `plans/archive/` (DONE).
- [ ] Usunięcie pustych plików planów (DONE).
- [ ] Aktualizacja `current_plan.md` (PENDING).

