# 📊 Raport Stanu Projektu i Lista Zadań

Aktualizowany na bieżąco o zgłoszenia użytkownika.

## 🔴 PILNE NAPRAWY (HOTFIXES)

1.  **[PC UI] Dropdowny nie działają (Re-fix):**
    *   **Problem:** Poprzednia poprawka (Portal) nie zadziałała ("nie działa wcale").
    *   **Rozwiązanie:** Całkowite uproszczenie ("Napisz od nowa"). Użycie globalnego stanu w `Dashboard` i renderowanie dropdownów jako bezpośrednich dzieci `body` (przez prosty `div fixed`, bez `createPortal` wewnątrz komponentu, lub z `createPortal` ale sterowanym z góry).
    *   **Cel:** Listy Płatności i "Przenieś do" mają działać niezawodnie i być na wierzchu.

2.  **[Backend] Miniatury się nie ładują (Uploads Path):**
    *   **Problem:** Frontend szuka zdjęć, ale ich nie widzi (404).
    *   **Przyczyna:** Folder `uploads` został przeniesiony do głównego katalogu (`root`), a konfiguracja PHP (`api/config.php`, `api/images.php`) nadal wskazuje na `api/uploads`.
    *   **Rozwiązanie:** Aktualizacja ścieżek `UPLOAD_DIR` i `UPLOADS_URL` na `../uploads` i `/uploads`.

3.  **[Mobile UI] Niepełna Karta Zlecenia:**
    *   **Problem:** Widok mobilny pokazuje tylko nagłówek.
    *   **Wymaganie:** Dodanie wszystkich sekcji z wersji PC (Adres, Opis, Notatki, Zakończenie).

---

## 🟡 Pozostałe Braki (Backlog)

1.  **Bezpieczeństwo:** Logowanie wyłączone.
2.  **AI:** Brak Re-analizy.
3.  **Płatności:** Brak webhooków.
4.  **Czas:** Brak godzin montażu.
5.  **Mapa PC:** Brak popupu.

---

## 📋 Plan Działania (Kolejność)

1.  **Fix Upload Paths** (Najszybsze, przywraca widoczność zdjęć).
2.  **Re-fix Dropdowns** (UI PC).
3.  **Fix Mobile Card** (UI Mobile).
4.  **Reszta...**

