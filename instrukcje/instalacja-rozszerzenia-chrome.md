# 🚀 Instalacja rozszerzenia Chrome - CRM Gmail

**Data:** 2024-12-06  
**Wersja:** 2.0

---

## KROK 1: Wygeneruj ikony

1. Otwórz Eksplorator plików i przejdź do:
   ```
   D:\Programowanie\Cursor\CRM Zlecenia Montażowe\chrome-extension\icons\
   ```

2. **Kliknij dwukrotnie** na plik `generate-icons.html` - otworzy się w przeglądarce

3. Zobaczysz 4 ikony różnych rozmiarów. Kliknij **"Pobierz"** przy każdej:
   - `icon16.png`
   - `icon32.png`
   - `icon48.png`
   - `icon128.png`

4. Przenieś pobrane pliki do folderu `chrome-extension/icons/`

---

## KROK 2: Załaduj rozszerzenie do Chrome

1. Otwórz Chrome i wpisz w pasku adresu:
   ```
   chrome://extensions/
   ```

2. W prawym górnym rogu włącz **"Tryb dewelopera"** (przełącznik)

3. Kliknij przycisk **"Załaduj rozpakowane"** (po lewej stronie)

4. Wybierz folder:
   ```
   D:\Programowanie\Cursor\CRM Zlecenia Montażowe\chrome-extension
   ```

5. Rozszerzenie powinno pojawić się na liście ✅

---

## KROK 3: Skonfiguruj rozszerzenie

1. Kliknij ikonę rozszerzenia na pasku Chrome (pomarańczowy kwadrat z Kanbanem)

2. Wypełnij ustawienia:
   - **URL do CRM**: `https://montazreklam24.pl/crm` (lub Twój adres)
   - **Token API**: Token z ustawień CRM (pobierz z panelu admina)
   - **Klucz Gemini**: Pobierz z https://aistudio.google.com/apikey

3. Kliknij **"Zapisz ustawienia"**

---

## KROK 4: Użycie

1. Otwórz **Gmail** (https://mail.google.com)

2. Wejdź w dowolny email (kliknij na wiadomość)

3. Zobaczysz przycisk **"CRM"** w górnym pasku (obok Odpowiedz, Prześlij dalej)

4. Kliknij **CRM** - otworzy się panel boczny po prawej stronie

5. Masz 2 główne przyciski:
   - **📧 ZACZYTAJ Z MAILA** - Gemini AI przeanalizuje email i wypełni pola automatycznie
   - **🚀 WYŚLIJ DO CRM** - Utworzy zlecenie w systemie CRM

6. Możesz też ręcznie wypełnić/poprawić wszystkie pola przed wysłaniem

---

## Rozwiązywanie problemów

### Przycisk CRM nie pojawia się
- Odśwież Gmail (F5)
- Sprawdź czy rozszerzenie jest włączone w `chrome://extensions/`
- Upewnij się że otworzyłeś konkretny email (nie listę)

### Błąd "Brak klucza API Gemini"
- Kliknij ikonę rozszerzenia i wprowadź klucz Gemini
- Klucz pobierzesz z: https://aistudio.google.com/apikey

### Błąd "Brak konfiguracji CRM"
- Sprawdź URL i token w ustawieniach rozszerzenia
- Upewnij się że CRM działa i token jest ważny

### Gemini nie wyciąga wszystkich danych
- Niektóre dane mogą nie być w mailu (np. NIP)
- Uzupełnij brakujące pola ręcznie

---

## Pliki rozszerzenia

```
chrome-extension/
├── manifest.json       # Konfiguracja rozszerzenia
├── background.js       # Komunikacja z Gemini i CRM API
├── content.js          # Skrypt wstrzykiwany w Gmail
├── content.css         # Style panelu bocznego
├── popup.html          # Okno ustawień
├── popup.js            # Logika ustawień
└── icons/
    ├── generate-icons.html   # Generator ikon
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

© 2024 Montaż Reklam 24







