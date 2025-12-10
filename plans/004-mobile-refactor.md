# Plan Wdrożenia Dedykowanej Wersji Mobilnej

## Cel
Stworzenie dedykowanego doświadczenia użytkownika dla urządzeń mobilnych (smartfony) i tabletów, oddzielonego od wersji desktopowej. Aplikacja powinna wykrywać urządzenie i ładować odpowiedni interfejs ("Mobile First" dla mobile, "Desktop Productivity" dla PC).

## Strategia Architektury
Zamiast responsywności (RWD) polegającej tylko na ukrywaniu elementów CSS-em, zastosujemy podejście "Adaptive Design" na poziomie routingu.

1.  **Detekcja Urządzenia**:
    *   Wykorzystanie biblioteki `react-device-detect` lub własnego hooka `useDeviceType` w `App.tsx`.
    *   Jeśli `isMobile` -> renderuj `<MobileApp />`.
    *   Jeśli `!isMobile` -> renderuj `<DesktopApp />` (obecny `Dashboard`).

2.  **Struktura Plików**:
    ```
    src/
      components/
        mobile/           # Dedykowane komponenty mobilne
          MobileLayout.tsx
          MobileJobCard.tsx
          MobileNavigation.tsx
          MobileJobView.tsx
        desktop/          # Komponenty desktopowe (obecne)
          Dashboard.tsx
          ...
    ```

## Funkcjonalności Mobilne (Mobile App)

### 1. Nawigacja
*   **Dolny Pasek (Bottom Bar)**: Zamiast zakładek na górze.
    *   🏠 **Start**: Lista zadań na dziś (Dzień/Tydzień).
    *   🗺️ **Mapa**: Pełnoekranowa mapa z lokalizacją montera.
    *   ➕ **Dodaj**: Szybkie dodawanie zdjęcia/notatki.
    *   👤 **Profil**: Ustawienia, Wyloguj.

### 2. Widok Listy (Zamiast Kanban)
*   Pionowa lista kafelków ("Feed").
*   Filtrowanie po dniu tygodnia (poziomy przewijany pasek dni na górze).
*   Duże, łatwe do tapnięcia przyciski akcji (Zadzwoń, Nawiguj).
*   Gesty (Swipe):
    *   Przesuń w prawo: Zadzwoń / Oznacz jako zrobione.
    *   Przesuń w lewo: Archiwizuj / Usuń.

### 3. Karta Zlecenia (Mobile)
*   Tryb pełnoekranowy po kliknięciu w kafelek.
*   Duże zdjęcia (karuzela).
*   Checklista z dużymi checkboxami.
*   Przycisk "Zrób Zdjęcie" bezpośrednio otwierający kamerę.
*   Upload zdjęć w tle.

### 4. Optymalizacja
*   Lazy loading komponentów mobilnych (nie ładujemy kodu desktopowego na telefonie).
*   Obsługa "Pull to Refresh".
*   Pamięć podręczna (Service Worker) dla trybu offline (w przyszłości).

## Plan Działania

### Faza 1: Separacja (Jutro)
1.  Zainstalować `react-device-detect`.
2.  Stworzyć `src/MobileApp.tsx` (pusty szkielet) i `src/DesktopApp.tsx` (przeniesienie obecnego `Dashboard`).
3.  Zmodyfikować `src/App.tsx` do warunkowego renderowania.

### Faza 2: Implementacja UI Mobilnego
1.  Zbudować `MobileLayout` z dolnym paskiem nawigacji.
2.  Stworzyć `MobileJobCard` - uproszczona wersja karty, bez drag & drop (chyba że do sortowania, ale raczej lista statyczna).
3.  Zaimplementować widok "Mój Dzień" (filtrowanie po dzisiejszym dniu/przypisanych zleceniach).

### Faza 3: Interakcje
1.  Podpięcie akcji przycisków (Telefon, Mapa).
2.  Obsługa aparatu/galerii.
3.  Testowanie na fizycznych urządzeniach.









