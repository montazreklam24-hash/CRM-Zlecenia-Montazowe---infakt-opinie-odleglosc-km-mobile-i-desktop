# CRM Montaż Reklam 24 - Rozszerzenie Chrome

Rozszerzenie do Gmail pozwalające szybko tworzyć zlecenia i klientów w CRM bezpośrednio z emaili.

## 🚀 Funkcje

- **Automatyczna analiza emaila** - Gemini AI wyciąga dane z treści maila:
  - Telefon kontaktowy
  - Adres email
  - Nazwa firmy i NIP
  - Imię i nazwisko
  - Adres montażu (z dzielnicą)
  - Zakres prac

- **Szybkie akcje**:
  - Utwórz zlecenie jednym klikiem
  - Dodaj klienta do CRM
  - Szukaj istniejących klientów
  - Skopiuj dane do schowka
  - Przyciski nawigacji i dzwonienia

## 📦 Instalacja

### 1. Przygotuj ikony

1. Otwórz `icons/generate-icons.html` w przeglądarce
2. Pobierz wszystkie 4 rozmiary ikon (16, 32, 48, 128)
3. Zapisz je w folderze `icons/`

### 2. Załaduj rozszerzenie do Chrome

1. Otwórz `chrome://extensions/` w Chrome
2. Włącz **Tryb dewelopera** (prawy górny róg)
3. Kliknij **Załaduj rozpakowane**
4. Wybierz folder `chrome-extension`

### 3. Skonfiguruj

1. Kliknij ikonę rozszerzenia na pasku Chrome
2. Wprowadź:
   - **URL CRM**: `https://montazreklam24.pl/crm`
   - **Token API**: Token z ustawień CRM
   - **Klucz Gemini**: Klucz z [Google AI Studio](https://aistudio.google.com/apikey)
3. Kliknij **Zapisz ustawienia**

## 🎮 Użycie

1. Otwórz email w Gmail
2. Kliknij przycisk **CRM** w toolbarze (obok Odpowiedz, Prześlij dalej)
3. Gemini przeanalizuje email i wyciągnie dane
4. Sprawdź i popraw dane jeśli trzeba
5. Kliknij **Utwórz zlecenie w CRM**

## 📁 Struktura plików

```
chrome-extension/
├── manifest.json       # Konfiguracja rozszerzenia
├── background.js       # Service worker (API)
├── content.js          # Skrypt w Gmail
├── content.css         # Style panelu
├── popup.html          # Ustawienia
├── popup.js            # Logika ustawień
└── icons/
    ├── generate-icons.html   # Generator ikon
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## 🔐 Uprawnienia

Rozszerzenie wymaga dostępu do:
- `https://mail.google.com/*` - Odczyt treści emaili
- `https://montazreklam24.pl/*` - Komunikacja z CRM API
- `https://generativelanguage.googleapis.com/*` - Gemini API

## 🛠️ Rozwiązywanie problemów

### Przycisk CRM nie pojawia się
- Odśwież Gmail (F5)
- Sprawdź czy rozszerzenie jest włączone w `chrome://extensions/`

### Błąd "Brak klucza API Gemini"
- Otwórz ustawienia rozszerzenia i wprowadź klucz API

### Błąd "Brak konfiguracji CRM"
- Sprawdź URL i token w ustawieniach rozszerzenia
- Upewnij się że CRM działa i token jest ważny

### Gemini nie wyciąga danych
- Sprawdź czy email ma treść tekstową (nie tylko obrazki)
- Długie maile mogą być przycięte (limit 10000 znaków)

## 📝 Licencja

© 2024 Montaż Reklam 24. Wszystkie prawa zastrzeżone.









