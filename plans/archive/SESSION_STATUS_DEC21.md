# Status Projektu - 21 Grudnia 2025

Ten plik zawiera podsumowanie zmian technicznych wprowadzonych w sesji, mających na celu naprawę importu zdjęć z rozszerzenia Chrome oraz obsługę błędów API.

## 1. Chrome Extension (v5.3)

### Zmiany w UI (`content.js`, `content.css`)
- Dodano **Drag & Drop Zone** w panelu bocznym.
- Obsługa wklejania zdjęć ze schowka (`Ctrl+V`).
- Lista dodanych plików z możliwością ich usunięcia przed wysłaniem.

### Optymalizacja (`content.js`)
- Zaimplementowano **kompresję zdjęć po stronie klienta** (Canvas API):
  - Resize do max 1600x1600 px.
  - Kompresja JPEG (jakość 0.7).
  - Rozwiązuje to problem limitów `POST_MAX_SIZE` w PHP (zdjęcia 5MB -> ~200KB).

### Logika Uploadu (`background.js`)
- Zmieniono sposób wysyłania zdjęć. Zamiast wysyłać Base64 w JSON (`projectImages`), rozszerzenie teraz:
  1. Wysyła każdy plik osobno do nowego endpointu `api/upload.php` (multipart/form-data).
  2. Odbiera URL pliku z API.
  3. Wstawia tablicę URL-i do głównego żądania `createJob` (`api/jobs`).

## 2. API Backend (PHP)

### Nowy Endpoint: `api/upload.php`
- Obsługuje upload plików metodą POST.
- Zapisuje pliki w `uploads/`.
- Zwraca relatywny URL do pliku.

### Poprawka Bazy Danych (`api/images.php`)
- Naprawiono błąd `Integrity constraint violation: 1048 Column 'file_data' cannot be null`.
- Zmodyfikowano funkcję `saveJobImages` tak, aby wstawiała pusty string `''` zamiast `NULL` do kolumny `file_data` (dla kompatybilności wstecznej z tabelą `job_images`).

### Konfiguracja (`api/config.php`)
- Ustalono `UPLOADS_URL` na `/uploads/` (ścieżka relatywna).
- Jest to kluczowe dla poprawnego działania Proxy we frontendzie (Vite przekierowuje `/uploads` do backendu `:8080`).

## 3. Frontend (React/Vite)

### Poprawka Usuwania Zleceń (`src/services/apiService.ts` / `jobsService`)
- Zaktualizowano metodę `deleteJob`.
- Dodano parsowanie ID przy użyciu `parseJobId` (obsługa prefiksów `ai-` i `simple-`).
- Naprawia to błąd 404 przy próbie usunięcia zlecenia przez API (wcześniej frontend wysyłał np. `/jobs/ai-65`, a backend oczekiwał `/jobs/65`).

## 4. Znane Problemy (Do zrobienia)

### Przycisk Usuwania (UI)
- Mimo poprawki w serwisie, użytkownik zgłasza, że przycisk "Usuń" w UI nadal nie działa ("pokazuje że usuń, potwierdzam ale nie usuwa").
- **Do zrobienia:** Zweryfikować `onClick` w komponentach `JobCard` i `KanbanColumn`.

### OAuth & Gmail API
- Automatyczne pobieranie załączników z Gmaila jest obecnie wyłączone/problematyczne (błędy 401/403).
- Rozwiązaniem tymczasowym (i docelowym?) jest wdrożony Manual Upload, który działa niezawodnie.

---
**Następny krok:** Zresetuj czat i zacznij od analizy problemu z przyciskiem usuwania w UI, wiedząc że warstwa API (service) jest już poprawiona.

