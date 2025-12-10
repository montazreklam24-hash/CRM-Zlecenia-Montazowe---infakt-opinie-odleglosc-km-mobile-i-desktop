# Konfiguracja Produkcyjna - Montaż Reklam 24

## Baza Danych (Aktualna)
**Ważne:** Aplikacja na serwerze produkcyjnym łączy się z bazą danych **`monciu_crm2`**.

*   **Host:** `localhost`
*   **Baza danych:** `monciu_crm2`
*   **Użytkownik:** `monciu_crm`
*   **Hasło:** (znane, zapisane w `api/config.php` jako fallback oraz w `api/config_db.php` na serwerze)

## Pliki Konfiguracyjne
W repozytorium plik `api/config_db.php` jest ignorowany (nie istnieje).
Na serwerze aplikacja szuka pliku `api/config_db.php`. Jeśli go nie znajdzie, używa ustawień "fallback" wpisanych na sztywno w `api/config.php`.

**W pliku `api/config.php` (w repozytorium) ustawiony jest fallback na bazę `monciu_crm2`, aby zapobiec łączeniu się ze złymi bazami (np. domyślną `montaz_crm`).**

## Wgrywanie na serwer (Deployment)
1.  **Frontend**:
    *   Plik `index.html` -> do katalogu głównego `public_html/`.
    *   Folder `assets/` -> do katalogu głównego `public_html/assets/` (uprzednio usuwając stare pliki).
2.  **Backend**:
    *   Pliki `.php` z folderu `api/` -> do folderu `public_html/api/`.

## Ważne Uwagi
*   Po wgraniu nowej wersji na serwer zawsze wykonaj twarde odświeżenie w przeglądarce (`Ctrl + F5`), aby załadować nowe style i skrypty.
*   Jeśli zlecenia "znikną", sprawdź czy plik `api/config.php` na serwerze ma poprawne dane do bazy `monciu_crm2`.









