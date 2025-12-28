# Omega — prompty do Cursor (oszczędne w tokenach)

## PROMPT 0 — start Omega (bezpiecznie)
Zrób nową gałąź: omega.

Cel: dodać równoległy DashboardOmega bez zmiany obecnego działania.
Zmień tylko te pliki: src/App.tsx + dodaj nowy plik src/components/DashboardOmega.tsx.

W App.tsx: jeśli w URL jest ?omega=1 to renderuj <DashboardOmega ...>, w przeciwnym razie renderuj stary <Dashboard ...>.
Nie ruszaj stylów ani logiki starego Dashboard.

Na koniec: pokaż diff i krótko jak przetestować ręcznie.

---

## PROMPT 1 — szkielet sekcji (bez refaktoru logiki)
Pracujemy tylko w: src/components/DashboardOmega.tsx (nowy plik).

Zadanie: zrób szkielet podziału na sekcje:
- HeaderSection
- PrepareSection
- WeekColumnsSection
- MapSection
- CompletedSection

Na razie sekcje mogą zwracać placeholdery, ale muszą być gotowe jako osobne komponenty w tym samym pliku (bez nowych plików).
Nie zmieniaj App.tsx ani starego Dashboard.

---

## PROMPT 2 — Header 1:1
Pracuj tylko na: src/components/Dashboard.tsx ORAZ src/components/DashboardOmega.tsx.

Zadanie: skopiuj z Dashboard.tsx dokładny JSX nagłówka (header dashboardu) do HeaderSection w DashboardOmega.
Warunek: HTML/DOM + className mają być 1:1 (bez dodatkowych wrapperów).
Nie przenoś logiki biznesowej – tylko render i propsy potrzebne do tego renderu.

Na koniec: wypisz 3 rzeczy do ręcznego sprawdzenia w UI.

---

## PROMPT 3 — „Do przygotowania” bez psucia DnD
Pracuj tylko na: src/components/Dashboard.tsx + src/components/DashboardOmega.tsx.

Zadanie: przenieś fragment odpowiedzialny za kolumnę/sekcję PREPARE do PrepareSection w Omega.
Zakaz: dodawania wrapperów wokół SortableContext / DroppableColumn / kart.
Wszystkie className identyczne jak w Dashboard.tsx.

Na koniec: wskaż, gdzie w kodzie jest collisionDetection i upewnij się, że się nie zmieniło.

---

## PROMPT 4 — kolumny dni tygodnia
Pracuj tylko na: src/components/Dashboard.tsx + src/components/DashboardOmega.tsx.

Zadanie: przenieś render kolumn MON..SUN (albo MON..FRI jeśli tak jest w aktualnym UI) do WeekColumnsSection.
Warunek: kontener grid/flex i jego className ma zostać identyczny.
Uwaga: nie zmieniaj liczby kolumn ani responsywności.

Na koniec: podaj dokładnie które kolumny wchodzą do tej sekcji (lista id).

---

## PROMPT 5 — Mapa i „Wykonane”
Pracuj tylko na: src/components/Dashboard.tsx + src/components/DashboardOmega.tsx.

Zadanie:
1) przenieś sekcję mapy do MapSection (1:1 DOM + className),
2) przenieś kolumnę/sekcję COMPLETED do CompletedSection (1:1 DOM + className).

Zakaz: refaktorów “przy okazji”.
Na koniec: opisz jak sprawdzić że markery i klik w marker dalej działa.

---

## PROMPT 6 — dopiero na końcu: rozbij na osobne pliki
Mamy już działający DashboardOmega (1:1). Teraz dopiero rozbij go na pliki.

Zadanie:
- utwórz folder: src/components/OmegaDashboard/
- przenieś: DashboardOmega.tsx + 5 sekcji do osobnych plików
- zadbaj o exporty i importy
- NIE zmieniaj żadnego JSX ani className, tylko przeniesienie kodu.

Na koniec: pokaż listę nowych plików i upewnij się, że build przechodzi.
