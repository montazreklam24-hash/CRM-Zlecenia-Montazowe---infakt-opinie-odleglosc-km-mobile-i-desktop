# Omega Cursor Pack — jak użyć

## Co to jest?
Paczka z instrukcjami i promptami do projektu „Naprawa CRM”, zoptymalizowana pod:
- brak fantazji,
- minimalne zmiany,
- refaktor Dashboarda bez psucia stylów.

## Jak zainstalować (najbezpieczniej)
1) Rozpakuj ZIP w **root** repo (tam gdzie jest package.json).
2) Otwórz plik `INSTRUKCJE_DLA_AI.md` i przypnij go sobie jako “źródło zasad”.
3) Dodaj zasady do `.cursorrules`:
   - jeśli masz `.cursorrules`, **dopisz** zawartość z `CURSORRULES_SNIPPET.txt` na końcu
   - jeśli nie masz, utwórz `.cursorrules` i wklej tam snippet

## Szybkie użycie promptów
Otwórz `PROMPTY_OMEGA.md` i wklejaj prompty etapami (PROMPT 0 → 6).
Nie wrzucaj wszystkiego naraz do modelu.

## Opcja automatyczna (skrypt)
Jeśli chcesz, uruchom:
- macOS/Linux: `bash apply_pack.sh`
- Windows (Git Bash): `bash apply_pack.sh`

Skrypt:
- tworzy/uzupełnia `.cursorrules`,
- kopiuje `INSTRUKCJE_DLA_AI.md` oraz `PROMPTY_OMEGA.md` do repo.
