# 📋 Plan: CRM Budowa Krok Po Kroku

**Data utworzenia:** 2024-12-06  
**Ostatnia aktualizacja:** 2025-12-09
**Status:** W trakcie - Faza 2

---

## Srodowisko

- **Produkcja:** https://crm.montazreklam24.pl (PHP 8.2 + MySQL)
- **Gemini API:** ✅ Skonfigurowany (AIzaSyCQj-FSmZW-eo8yd-pkXs8q05M14ymNgYk)
- **inFakt API:** ✅ Skonfigurowany (4a21f1a475ec06c7613fa47ae1553fe4974a800e)
- **Google Maps:** ✅ Skonfigurowany (AIzaSyCKfvBW5r0xhrfqZ-dnGeCXz3c2v4-SLMY)
- **Przelewy24:** ✅ Klucze dostepne (merchant_id: 306323)

---

## FAZA 1: Wprowadzanie zlecen ✅ ZROBIONE

### 1.1 Reczne wypelnianie karty ✅
- Formularz z polami: tytul, telefon, adres, zakres prac, zdjecie
- Automatyczne nadawanie numeru zlecenia (#2025/001)
- Upload zdjecia projektu (zoptymalizowane - pliki zamiast base64)
- Zapis do bazy MySQL

### 1.2 Kopiuj-wklej z maila ✅
- Pole tekstowe na wklejenie watku mailowego
- Przycisk "Parsuj z Gemini"
- Gemini wyciaga dane i wypelnia formularz
- Uzytkownik poprawia i zapisuje

### 1.3 Dyktowanie glosowe ✅
- Przycisk mikrofonu (Web Speech API)
- Transkrypcja mowy na tekst
- Tekst idzie do Gemini do parsowania

---

## FAZA 2: Integracja Gemini ✅ ZROBIONE

Endpoint: POST /api/gemini
- Parsowanie tekstu maila
- Wyciaganie: telefon, email, adres, zakres prac
- Model: gemini-2.0-flash

---

## FAZA 3: Integracja inFakt ⏳ W TRAKCIE

Endpoint: /api/invoices (do zbudowania)
- Tworzenie klientow w inFakt
- Wystawianie proform
- Wystawianie faktur VAT
- Wysylka na email klienta

Szczegoly w: `plans/005-modul-fakturowania.md`

---

## FAZA 4: Deploy na produkcje ✅ ZROBIONE

1. Build frontendu: npm run build
2. Upload dist/ na serwer FTP (Total Commander)
3. Upload api/ na serwer FTP
4. Konfiguracja api/config.php
5. Baza MySQL dziala na serwerze

---

## PRZYSZLE FUNKCJE (backlog)

### Rozszerzenie Chrome Gmail -> CRM
- Panel boczny w Gmail
- Parsowanie maili przez Gemini
- Szczegoly w: `plans/001-chrome-extension-gmail-crm.md`

### Modul fakturowania
- Pobieranie danych firm po NIP (GUS/CEIDG/KRS)
- Integracja inFakt (proformy, faktury)
- Przelewy24 (platnosci online)
- Szczegoly w: `plans/005-modul-fakturowania.md`

### Wersja mobilna
- Dedykowany interfejs dla telefonow
- Szczegoly w: `plans/004-mobile-refactor.md`

### Powiadomienia (pozniej)
- Email do klienta po utworzeniu zlecenia
- SMS przypomnienie przed montazem

---

## Notatki techniczne

- Serwer produkcyjny: PHP 8.2 + MySQL
- API kompatybilne z PHP 5.6+ (dla pewnosci)
- Obrazy przechowywane jako pliki w `api/uploads/` (nie base64 w bazie)









