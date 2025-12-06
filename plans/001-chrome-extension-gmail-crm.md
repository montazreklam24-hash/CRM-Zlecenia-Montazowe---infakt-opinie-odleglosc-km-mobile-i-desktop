# 📋 Plan: Rozszerzenie Chrome - Gmail do CRM

**Data utworzenia:** 2024-12-06  
**Status:** ✅ Zaimplementowane (czeka na testy)  
**Commit:** d07be4d

---

## Stan obecny

Rozszerzenie już istnieje w folderze `chrome-extension/` z podstawową strukturą:
- `manifest.json` - konfiguracja (gotowa)
- `content.js` - skrypt Gmail z panelem bocznym (wymaga uproszczeń)
- `background.js` - komunikacja z Gemini i CRM API (gotowe)
- `popup.html/js` - ustawienia (gotowe)
- Brak ikon PNG (tylko generator HTML)

---

## Zakres zmian

### 1. Wygenerowanie ikon
Utworzenie plików `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` w folderze `chrome-extension/icons/`

### 2. Uproszczenie UI panelu bocznego
Zmiana `content.js` - dwa główne przyciski:
- **ZACZYTAJ Z MAILA** - parsuje wątek przez Gemini
- **WYŚLIJ DO CRM** - tworzy zlecenie

### 3. Pola do wypełnienia automatycznie

| Pole | Mapowanie w CRM | Skuteczność |
|------|-----------------|-------------|
| Tytuł zlecenia | `jobTitle` | 90% |
| Telefon | `phoneNumber` | 85% |
| Email | (do notatek) | 95% |
| Imię i nazwisko | `contactPerson` | 80% |
| Nazwa firmy | `companyName` | 75% |
| NIP | (do klienta) | 60% |
| Adres montażu | `address` | 70% |
| Zakres prac | `scopeWorkText` | 85% |

### 4. Dostosowanie API CRM
Sprawdzenie endpointu `POST /api/jobs` w `api/jobs.php` czy obsługuje wszystkie pola

### 5. Testowanie
- Załadowanie rozszerzenia do Chrome
- Test na prawdziwym mailu w Gmail
- Weryfikacja tworzenia zlecenia w CRM

---

## Pliki do modyfikacji

1. `chrome-extension/content.js` - uproszczenie UI
2. `chrome-extension/content.css` - style
3. `chrome-extension/background.js` - ewentualne poprawki promptu Gemini
4. `chrome-extension/icons/` - wygenerowanie ikon PNG

---

## ✅ TODO

- [x] Wygenerować ikony PNG (16, 32, 48, 128px) dla rozszerzenia (generator gotowy)
- [x] Uprościć panel boczny - 2 przyciski: Zaczytaj / Wyślij do CRM
- [ ] Przetestować rozszerzenie w Chrome na prawdziwym mailu

---

## Przyszłe rozszerzenia (opcjonalne)

- [ ] Interpretacja obrazków z maili przez Gemini Vision API
- [ ] Automatyczne geocoding adresu (współrzędne GPS)
- [ ] Integracja z systemem klientów (wyszukiwanie istniejących)

