# Naprawa CRM — instrukcje dla AI w Cursorze (Omega)

## Cel
Zbudować nową linię aplikacji **Omega**: zachować obecną funkcjonalność i wygląd, a jednocześnie rozbić monolityczny `Dashboard.tsx` na mniejsze sekcje **bez psucia stylów i DnD**.

## Zasady (najważniejsze)
1. **Zero fantazji** — jeśli czegoś nie ma w plikach/logach/commitach, nie zgaduj.
2. **Minimalne zmiany** — jedna poprawka = jeden mały commit. Bez „sprzątania przy okazji”.
3. **Nie psuj UI** — w refaktorze Dashboarda zachowaj **identyczny DOM i `className`**.
   - Nie dokładaj wrapperów `<div>`. Jeśli musisz, użyj `<>...</>` (Fragment).
4. **Czytaj logi i commity** przed naprawą:
   - `git log -n 10 --oneline`
   - `api/error_log`, `dist/api/error_log` (jeśli istnieją)
   - konsola przeglądarki (F12) + Network
5. **Nie ruszaj build output** ręcznie (`dist/`, `dist/assets/`).
6. **Po każdej zmianie**: build + szybki smoke test.

## Checklista przed zmianą
- `git status`
- `git log -n 10 --oneline` (czy był podobny fix)
- odtwórz problem / potwierdź cel
- zlokalizuj konkretny fragment kodu i przyczynę

## Checklista po zmianie
- `npm run build`
- smoke test:
  - Dashboard (wszystkie tryby widoku jeśli są)
  - drag&drop działa (przenoszenie kart)
  - szerokości kolumn OK (nic się nie zwęża)
  - dropdowny/modale nie są ucinane (overflow/z-index)
- `git diff` → zmiany małe i celowe
- commit: `refactor:` / `fix:` / `feat:`

## Omega — strategia bezpiecznego refaktoru
Najpierw równoległa ścieżka (bez ryzyka dla „Obecny”):
- dodaj `DashboardOmega.tsx`
- w `App.tsx` przełącznik: jeśli URL ma `?omega=1`, renderuj Omega, inaczej renderuj stary Dashboard

Dopiero gdy Omega jest 1:1, można przepiąć domyślny Dashboard.

## Podział Dashboarda na sekcje (docelowo)
1) Header
2) Sekcja „Do przygotowania”
3) Kolumny dni tygodnia
4) Mapa
5) Wykonane

## Najczęstsza mina (styl się „rozsypuje”)
Prawie zawsze winny jest **dodatkowy wrapper** albo zmiana klas typu:
- `min-w-0`, `w-auto`, `flex-1`, `overflow-*`, `grid-cols-*`
Dlatego: w refaktorze zachowaj 1:1 DOM + `className`.
