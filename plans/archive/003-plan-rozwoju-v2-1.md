# Plan Rozwoju CRM - Montaż Reklam 24 (v2.1)

## Faza 1: Kopia Zapasowa i Porządki (ZROBIONE)
- [x] Utworzenie kopii zapasowej kluczowych plików (wersja alpha)

## Faza 2: Wygląd i Układ (Priorytet: Wysoki)
Cel: Nowoczesny, "lekki" wygląd (cienie, przezroczystości) oraz nowy układ kolumn.

1.  **Nowy Układ Dashboardu (Mixed View):**
    *   **Góra:** Kolumna "DO PRZYGOTOWANIA" jako poziomy wiersz na całą szerokość.
    *   **Środek:** Kolumny "PN - PT" jako pionowe kolumny (szersze niż obecnie).
    *   **Dół:** Kolumna "WYKONANE" jako poziomy wiersz (pod mapą).
    *   **Pamięć widoku:** Zapamiętywanie ostatnio wybranego widoku w przeglądarce.

2.  **Stylizacja Kart (Styl "wfirma/bitrix"):**
    *   Wprowadzenie delikatnych cieni (`box-shadow`), zaokrągleń i półprzezroczystych teł.
    *   Wyrównanie wysokości kafelków w rzędzie (Grid/Flex).
    *   Dodanie strzałek (niebieskich) do przesuwania kart między kolumnami w widoku poziomym (tak jak w pionowym).
    *   Przycisk "Archiwizuj" w stopce karty (obok kosza).

3.  **Mapa:**
    *   Przeniesienie przycisków "Google Maps / OSM" bezpośrednio nad mapę.
    *   Przycisk "Otwórz mapę w nowym oknie" (dla pracy na 2 monitory).
    *   Poprawa wyświetlania dymków w trybie pełnoekranowym (własny kontroler Fullscreen).

## Faza 3: Logika i Interakcje (Priorytet: Średni)
Cel: Poprawa wygody użytkowania (Drag & Drop, Edycja).

1.  **Poprawa Drag & Drop:**
    *   **Opóźnienie:** Wymuszenie przytrzymania (1s) dla myszki i dotyku przed rozpoczęciem przeciągania.
    *   **Naprawa "prostokątów":** Zwiększenie stref zrzutu (drop zones), poprawa wykrywania kolizji.
    *   **Fix Cienia:** Naprawa uciekającego cienia na monitorach 4K (pozycjonowanie `fixed` vs `absolute` w overlayu).

2.  **Edycja Karty Zlecenia:**
    *   **Pole "Analiza AI":** Możliwość ręcznej edycji treści.
    *   **Ponowna analiza:** Przycisk do ponownego przeliczenia/streszczenia po wklejeniu nowej treści.
    *   **Pisanie głosowe:** Ikonka mikrofonu przy polach tekstowych (Web Speech API).
    *   **Wybór dnia:** Dropdown w trybie edycji do szybkiego przypisania dnia (kolumny).

## Faza 4: Finanse i Statusy (Priorytet: Średni)
1.  **Statusy Płatności:**
    *   Dodanie checkboxów/przełącznika w karcie:
        *   Zapłacone (Zielony)
        *   Proforma (Pomarańczowy)
        *   Gotówka (Żółty)
        *   Brak/Domyślny (Szary)
    *   Zmiana koloru całej karty lub wyraźnego paska w zależności od statusu.
    *   Legenda kolorów na Dashboardzie.

## Faza 5: Duże Zmiany Funkcjonalne (Priorytet: Niski/Później)
1.  **Integracja z Mailem:**
    *   Koncepcja linkowania wątku mailowego do karty.
    *   Automatyczne pobieranie info/fotek z linku (wymaga backendu Gmail API).

2.  **Moduł Zakończenia Montażu:**
    *   Wymuszenie dodania min. 1 zdjęcia przed zamknięciem.
    *   Automatyczny mail do klienta z prośbą o opinię Google po zakończeniu.

---
*Plan utworzony: 2024-12-08*
