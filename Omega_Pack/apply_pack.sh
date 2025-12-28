#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SNIP_FILE="$ROOT/CURSORRULES_SNIPPET.txt"
RULES_FILE="$ROOT/.cursorrules"

if [ ! -f "$SNIP_FILE" ]; then
  echo "Brak CURSORRULES_SNIPPET.txt w $(pwd). Uruchom z root repo."
  exit 1
fi

if [ -f "$RULES_FILE" ]; then
  # don't duplicate if already added
  if grep -q "omega_cursor_pack" "$RULES_FILE"; then
    echo ".cursorrules już zawiera snippet omega_cursor_pack — pomijam."
  else
    echo "" >> "$RULES_FILE"
    cat "$SNIP_FILE" >> "$RULES_FILE"
    echo "Dopisano snippet do .cursorrules"
  fi
else
  cp "$SNIP_FILE" "$RULES_FILE"
  echo "Utworzono .cursorrules ze snippetu"
fi

echo "Gotowe. Pliki instrukcji są już w repo root."
echo "Następnie: otwórz PROMPTY_OMEGA.md i jedź promptami 0→6."
