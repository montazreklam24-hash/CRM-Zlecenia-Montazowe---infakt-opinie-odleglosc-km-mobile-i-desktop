# 📋 Plan: CRM Budowa Krok Po Kroku

**Data utworzenia:** 2024-12-06  
**Status:** W trakcie - Faza 1

---

## Środowisko

- **Testy:** Lokalnie XAMPP
- **Produkcja:** Serwer PHP 5.6 + MySQL (montazreklam24.pl)
- **Gemini API:** Klucz do uzupełnienia
- **inFakt API:** ✅ Skonfigurowany (4a21f1a475ec06c7613fa47ae1553fe4974a800e)
- **Google Maps:** ✅ Skonfigurowany (AIzaSyCKfvBW5r0xhrfqZ-dnGeCXz3c2v4-SLMY)

---

## FAZA 1: Uruchomienie lokalne ⏳

- [ ] Zainstalować XAMPP
- [ ] Uruchomić Apache + MySQL
- [ ] Skopiować api/ do C:\xampp\htdocs\crm-api\
- [ ] Utworzyć bazę MySQL (import database_v2.sql)
- [ ] Skonfigurować api/config.php
- [ ] Uruchomić frontend: npm run dev
- [ ] Przetestować logowanie

---

## FAZA 2: Wprowadzanie zleceń

### 2.1 Ręczne wypełnianie karty
- Formularz z polami: tytuł, telefon, adres, zakres prac, zdjęcie
- Automatyczne nadawanie numeru zlecenia (#2024/001)
- Upload zdjęcia projektu
- Zapis do bazy MySQL

### 2.2 Kopiuj-wklej z maila
- Pole tekstowe na wklejenie wątku mailowego
- Przycisk "Parsuj z Gemini"
- Gemini wyciąga dane i wypełnia formularz
- Użytkownik poprawia i zapisuje

### 2.3 Dyktowanie głosowe (opcjonalne)
- Przycisk mikrofonu (Web Speech API)
- Transkrypcja mowy na tekst
- Tekst idzie do Gemini do parsowania

---

## FAZA 3: Integracja Gemini

Endpoint: POST /api/gemini
- Parsowanie tekstu maila
- Wyciąganie: telefon, email, adres, zakres prac
- Model: gemini-2.0-flash

---

## FAZA 4: Integracja inFakt

Endpoint: /api/invoices
- Tworzenie klientów w inFakt
- Wystawianie proform
- Wystawianie faktur VAT
- Pobieranie PDF

---

## FAZA 5: Deploy na produkcję

1. Build frontendu: npm run build
2. Upload dist/ na serwer FTP
3. Upload api/ na serwer FTP
4. Konfiguracja api/config.php (produkcyjne dane)
5. Import bazy na serwer MySQL
6. Testy na produkcji

---

## PRZYSZŁE FUNKCJE (backlog)

### Automatyka Gmail → CRM (etykieta)
- Rozszerzenie Chrome monitoruje etykiety Gmail
- Po oznaczeniu etykietą "CRM" automatycznie tworzy zlecenie
- Wymaga: Gmail API, OAuth2

### Obrazki w mailach
- Gemini Vision API do analizy załączników
- Wyciąganie danych z wizytówek, projektów

### Powiadomienia
- Email do klienta po utworzeniu zlecenia
- SMS przypomnienie przed montażem

---

## Notatki techniczne

- Kod API kompatybilny z PHP 5.6 ✅
- Brak operatorów ?? (null coalescing)
- PDO działa w PHP 5.6







