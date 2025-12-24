Widok PC
1. Open street map nie wyświetla pinesek, ani kart zlecń. Nie ma też opcji powiekszenia na cały ekran monitora
2. Czy mapy będą się odswierzać automatycznie, zalezy mi zebym mogł mape w oddzilenym oknie wyciągnąc na dodatkowy monitor, to musi na zywo się odświerzać wszystko?
3. czy dashbort też jakos może się odswierzać na żywo?
4. W sekcji Do przygotowania, strzalki do przesuwania kart zleceń powinny dizałąć na boki przeduwajac kartę o jedną pozycję a gdy nacizniemy w dol to na sam koncie, gdy w gore strzalka to na sam pocztaek. Poczatek to gorny lewy rog, koniec to dolny prawy róg
5. Gdy wchodzę w menu boczne to w zakąłdce faktury mam proformy i faktury ale ich wkoty nie zgadzaja sie z tym co zostało wystawione do infaktu
6. Rozszerzenie do gmail powinno też wyczytywać wartosć sumaryczną zlecenia, orientacyjną gdy wyczyta ja z maial i dokłądna  gdy wyczyta ją z wystawionej faktury, prrorormy, powtierdzneiw płąty.
7. Trzeba zrobic też zaczytywanie automatyczne maila do crm ktory ma etykiete crm, ale ma to działać jak rozszerzenie czyli z jego funkacjami, musimy nad tym głebiej pomyśleć nim coś zbudujemy
8. klikanie w logoz widoku mapy nie przneosoi do głwonejs trony tablicy trzeba to zrobic na kazdej podstronei tzw.
9. takie same chipsy trezba dać jak w archiwum to na dashbordzie. gdy wybiore np. proformę to te karty sa normalnie a reszt przyciemniowna i połprzezorczysta. już tak mielismy w ktorejs wersji i bylo super przeszukaj archiwa.
10. gdy jest piątek sobota lub niedziela to roziwjaj widok z weekendem

Widok Mobilny3.
1. Google maps nie poakzuje pineske, musi pokazyuwac, a po najecdhaniu wyswietlan na dole zlecenie z przyciskami naiwguj i zawdzon i nie chowac go dppoki nie klikne w inna pinezke lub nie zamkne, musi tez przenosic do karty zlecenia . mielsmy to w wersji alpha chyba zrobnione w miare dobrze przeszukaj.
Musu dojsc jeden chips pokazujacy wszystkie zlecenia bez znaczenia w jakiej są sekcji wzyskie orpocz ukonczoncyh.

Poniżej masz **strategię rozwoju CRMa (tak “jak powinien działać”)** + gotowy **prompt do Cursor Composer**, który każe mu zrobić konkretne poprawki (mapa, live odświeżanie, strzałki w “Do przygotowania”, kwoty z inFakt, chipsy, weekend, mobile map + nowy chips “Wszystkie”).

---

## Strategia rozwoju CRMa (żeby to było “CRM a nie tylko tablica”)

### 1) Rdzeń danych: jeden kontrahent = wiele dokumentów + wiele zleceń

**Kontrahent (clients)** powinien być “master record”, a wszystko inne ma się do niego podpinać:

* **Kontakty** (osoby): imię, tel, email, rola (np. “osoba na miejscu”, “księgowość”)
* **Adresy**: osobno *montaż* i osobno *rozliczeniowy* (i możliwość wielu lokalizacji)
* **Zlecenia (jobs)**: każde zlecenie ma swój status produkcyjny i finansowy
* **Dokumenty**: oferta, proforma, faktura, korekta, protokół, pliki projektów, potwierdzenia płatności
* **Komunikacja**: wątki Gmail (threadId), wiadomości, załączniki, notatki

Efekt: wchodzisz w kontrahenta i masz *całą historię* + *wszystkie papiery*.

### 2) Finanse i wartości zlecenia: rozdziel “orientacyjnie” vs “potwierdzone”

W praktyce potrzebujesz 2 wartości:

* **Wartość orientacyjna** (z maila / oferty / rozmowy) – może być pusta
* **Wartość potwierdzona** (z proformy/faktury + status płatności)

W UI to robi robotę: od razu widać co jest “na oko”, a co jest “na fakturze”.

### 3) Dokumenty jako jeden wspólny system (nie osobne moduły)

Zamiast “moduł faktur”, “moduł ofert” itd. zrób:

* `documents` (typ: offer/proforma/invoice/attachment/other)
* `document_items` (pozycje: usługa, ilość, cena)
* `document_links` (link do inFakt/wFirma, pdf_url, status)
* `files` (metadane plików + ścieżka w storage)

Wtedy każde zlecenie i każdy kontrahent ma “segregator”.

### 4) Live odświeżanie: minimalnie polling + sprytnie sync między oknami

Żeby mapa na 2. monitorze żyła “na żywo”:

* bazowo: polling co np. 10–20 s (tylko gdy karta aktywna)
* lepiej: gdy w jednym oknie zapiszesz zmianę → zapisujesz `localStorage.lastChange=Date.now()` i inne okna robią refresh po evencie `storage` (prawie realtime bez katowania API)

### 5) Gmail: dwa tryby importu

* **Tryb ręczny (rozszerzenie)**: super, bo użytkownik widzi wątek i klika “Import”
* **Tryb automatyczny (etykieta “crm”)**: to powinno działać identycznie jak rozszerzenie, ale uruchamiane z serwera / Apps Script (najczyściej Apps Script, bo Gmail OAuth i etykiety są tam najprostsze)

---

## Najważniejsze “braki”, które warto dopisać do roadmapy

1. Oferty/wyceny (wersjonowanie + PDF)
2. Repo plików (projekty, zdjęcia, akceptacje)
3. Historia kontaktu (log działań: tel/mail/spotkanie)
4. Uprawnienia ról (admin/handlowiec/produkcja) + audyt zmian
5. Płatności (status + termin + przypomnienia)
6. Integracja księgowa jako “źródło prawdy” (inFakt/wFirma) + synchronizacja statusów

---

# PROMPT do Cursor Composer (wklej 1:1)

```text
Jesteś ekspertem od budowy CRM online (React+TS + PHP API + MySQL) i pracujesz na tym repo. Zrób poprawki oraz rozbudowę zgodnie z listą wymagań poniżej.

ZAŁOŻENIA OGÓLNE
- Nie psuj istniejących widoków. Zmiany rób możliwie małe, ale solidne.
- Tam gdzie to możliwe: wprowadź “single source of truth” w danych (zwłaszcza kwoty i statusy).
- Jeśli musisz zmienić API/DB: dodaj migrację SQL (folder /migrations) oraz zabezpiecz kompatybilność (fallback jeśli kolumny jeszcze nie ma).
- Po zakończeniu: podaj checklistę ręcznych testów (PC + Mobile).

WYMAGANIA (PRIORYTET 1 – BUGI + UX)

(PC / Dashboard / Map)
1) OpenStreetMap (Leaflet) w dashboardzie:
   - Musi pokazywać pinezki dla zleceń (jeśli brak współrzędnych: geokoduj z address przez Nominatim w przeglądarce i cache’uj wynik w DB po stronie API).
   - Musi pokazywać “karty zleceń” / panel listy zleceń przy mapie (tak jak na Google mapie) oraz po kliknięciu pinezki ma wskazać kartę i umożliwić otwarcie zlecenia.
   - Dodaj przycisk “pełny ekran” (fullscreen) dla mapy na dashboardzie (żeby można było dać mapę na osobny monitor).
   - Dodaj przycisk “Odśwież” oraz tryb “LIVE” (auto odświeżanie).

2) Live odświeżanie mapy i dashboardu:
   - Dodaj tryb LIVE (toggle) na dashboardzie i w mapie.
   - Implementacja minimalna: polling co 10–15 sekund gdy karta widoczna (document.visibilityState === 'visible').
   - Implementacja lepsza: broadcast zmian między oknami przez localStorage event:
     przy każdej operacji zmieniającej zlecenia (create/update/move/status) ustaw localStorage.setItem('crm_last_change', Date.now().toString()).
     Inne okna nasłuchują window.addEventListener('storage', ...) i robią szybki refresh.

3) Strzałki w sekcji “DO PRZYGOTOWANIA” (PREPARE):
   - Strzałki LEWO/PRAWO: przesuwają kartę o 1 pozycję w kolejności.
   - Strzałka W GÓRĘ: przerzuca kartę na SAM POCZĄTEK (pozycja 0 / pierwsza w kolejności).
   - Strzałka W DÓŁ: przerzuca kartę na SAM KONIEC (ostatnia pozycja).
   - “Początek” rozum jako pierwszy element kolejności (górny lewy róg), “koniec” jako ostatni (dolny prawy róg).
   - Zadbaj o stabilne sortowanie i brak skoków (po zmianie kolejności zapis do DB).

4) Moduł faktur (proformy/faktury) – kwoty nie zgadzają się z inFakt:
   - Zidentyfikuj i napraw problem, że przy tworzeniu proformy/faktury do DB zapisują się 0 lub błędne kwoty.
   - Sprawdź flow: API tworzy dokument w inFakt, a potem zapisuje do lokalnej bazy.
   - Wymaganie: po utworzeniu dokumentu w inFakt zawsze pobierz szczegóły dokumentu (net/gross) i dopiero wtedy zapisz do DB.
   - Upewnij się, że jednostki są poprawne (czy API zwraca w groszach czy w zł) i nie dzielisz przez 100 dwa razy.
   - Zrób też poprawkę w endpointach statusu/odświeżania tak, aby kwoty i status “paid”/“unpaid” były zgodne z inFakt.

5) Klik w logo w widoku mapy ma zawsze przenosić na główną tablicę (/):
   - Upewnij się, że na każdej podstronie (map, invoices, clients) logo działa identycznie.
   - Jeśli problem wynika z overlay mapy lub z-index: napraw.

6) Chipsy filtrów na Dashboardzie (jak w archiwum):
   - Dodaj identyczne chipsy na dashboardzie (PC).
   - Po wybraniu np. “proforma”:
     - karty pasujące są normalne,
     - reszta jest przyciemniona i półprzezroczysta (nie ukrywaj ich całkowicie).
   - W repo znajdź wersję z takim zachowaniem (git history) i odtwórz to.

7) Weekend:
   - Jeśli dzisiaj jest piątek/sobota/niedziela → domyślnie rozwiń widok weekendowy (sobota+niedziela widoczne).
   - W inne dni może być domyślnie zwinięte, ale z opcją ręcznego włączenia.

(Mobile / Map Google)
8) Mobile Google Maps:
   - Musi pokazywać pinezki.
   - Po kliknięciu pinezki ma się pojawić na dole “karta zlecenia” z przyciskami:
     “Nawiguj” (link do Google Maps), “Zadzwoń” (tel:).
   - Ta karta NIE ma się chować sama; chowa się dopiero gdy kliknę inną pinezkę albo zamknę.
   - Karta ma mieć też akcję “Otwórz zlecenie” (przejście do JobCard).

9) Mobile – nowy chips:
   - Dodaj jeden chips “Wszystkie” pokazujący wszystkie zlecenia niezależnie od sekcji, ale BEZ ukończonych.

WYMAGANIA (PRIORYTET 2 – DANE + MODEL CRM)
10) Wartość zlecenia w CRM:
   - CRM ma trzymać wartość orientacyjną (z maila / AI / ręcznie) oraz wartość potwierdzoną (z proformy/faktury).
   - Jeśli jest wystawiona proforma/faktura i ma kwoty → pokazuj je jako “potwierdzone”.
   - Jeśli nie ma → pokazuj orientacyjne.
   - Dodaj odpowiednie pola w DB + mapowanie w API + UI.

11) Import maili oznaczonych etykietą “crm” (automatyczne zaczytywanie):
   - NIE implementuj od razu na ślepo.
   - Zrób projekt techniczny (krótki opis + plan plików):
     a) wariant z Apps Script (Gmail label watcher) → wysyła do CRM payload jak rozszerzenie,
     b) wariant z backendem (OAuth token storage + cron/poll) – jeśli realne.
   - W kodzie przygotuj “hook” / endpoint po stronie CRM do przyjęcia takiego payloadu (bez pełnej automatyzacji, ale gotowe do podpięcia).

KONKRETNE MIEJSCA W KODZIE, KTÓRE MASZ SPRAWDZIĆ
- Leaflet/OSM: src/components/MapBoardOSM.tsx oraz użycie w src/components/Dashboard.tsx
- Google map: src/components/MapBoardGoogle.tsx (mobile bottom card + marker click)
- Map page: src/pages/MapPage.tsx (live refresh opcje)
- Reorder PREPARE: src/components/Dashboard.tsx (obecne handleReorder/handleMoveLeft/Right – dodaj jump-to-start/jump-to-end)
- inFakt: api/invoices.php + api/InfaktClient.php (zwracane pola i zapis kwot)
- Jobs create: api/jobs.php (upewnij się że value_net/value_gross nie giną przy INSERT)
- Chipsy: znajdź istniejące chipsy w mobile i archiwum i przenieś logikę na PC dashboard.

ODDANIE
- Zrób zmiany w kodzie.
- Dodaj migracje SQL jeśli potrzeba.
- Na końcu wypisz checklistę testów manualnych (PC: dashboard/map/invoices, Mobile: map + karta).
```

---

## Dwie “miny” w kodzie, które Composer powinien naprawić (to ci realnie psuje kwoty i wartości)

1. **Tworzenie zlecenia**: w API przy INSERT do `jobs_ai` potrafią nie zapisywać się wartości `value_net/value_gross` mimo że AI je zwraca → potem “wartość zlecenia” znika.
2. **inFakt**: po utworzeniu proformy/faktury często zapisujesz do DB same ID/numery, a kwoty zostają 0 (bo nie pobierasz szczegółów dokumentu po utworzeniu) → UI pokazuje inne liczby niż inFakt.

---

Jeśli chcesz, w następnym kroku mogę ci rozpisać **docelową strukturę bazy (minimalny zestaw tabel i relacji)** pod: kontrahenci → kontakty/adresy → zlecenia → dokumenty (oferta/proforma/faktura/pliki) + komunikacja Gmail, ale już teraz ten prompt popchnie Composera tak, żeby ogarnął najboleśniejsze rzeczy i przygotował grunt pod “pełnoprawny CRM”.

