#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANIFEST="supabase/function-manifest.json"
MANUAL_ALLOWLIST="scripts/function-manifest-manual-allowlist.txt"

if [ ! -f "$MANIFEST" ]; then
  echo "Manifest missing: $MANIFEST" >&2
  exit 1
fi

collect_frontend() {
  grep -RhoE "functions\\.invoke\\([[:space:]]*['\"][^'\"]+['\"]" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' src \
    | perl -nE 'while(/functions\.invoke\(\s*["\x27]([^"\x27]+)["\x27]/g){say $1}' \
    | sort -u
}

collect_internal() {
  grep -RhoE "functions/v1/[a-z0-9-]+" --include='*.ts' --include='*.js' supabase/functions \
    | perl -nE 'while(/functions\/v1\/([a-z0-9-]+)/g){say $1}' \
    | sort -u
}

collect_scheduled() {
  {
    printf '%s\n' \
      'generate-daily-mentor-pep-talks' \
      'schedule-daily-mentor-pushes' \
      'dispatch-daily-pushes'
    find supabase/migrations -name '*.sql' -type f -print0 \
      | xargs -0 perl -0777 -ne 'while(/cron\.schedule\(\s*["\x27]([^"\x27]+)["\x27]/sg){print "$1\n"}'
  } | sed '/^$/d' | sort -u
}

collect_manual_allowlist() {
  if [ ! -f "$MANUAL_ALLOWLIST" ]; then
    return
  fi

  sed -e 's/#.*$//' "$MANUAL_ALLOWLIST" \
    | sed -e 's/[[:space:]]*$//' \
    | sed '/^$/d' \
    | sort -u
}

tmp_declared="$(mktemp)"
tmp_discovered="$(mktemp)"
tmp_missing="$(mktemp)"
tmp_stale="$(mktemp)"
trap 'rm -f "$tmp_declared" "$tmp_discovered" "$tmp_missing" "$tmp_stale"' EXIT

jq -r '.allowList[]' "$MANIFEST" | sed '/^$/d' | sort -u > "$tmp_declared"
cat <(collect_frontend) <(collect_internal) <(collect_scheduled) <(collect_manual_allowlist) | sed '/^$/d' | sort -u > "$tmp_discovered"

comm -23 "$tmp_discovered" "$tmp_declared" > "$tmp_missing"
comm -13 "$tmp_discovered" "$tmp_declared" > "$tmp_stale"

status=0

if [ -s "$tmp_missing" ]; then
  echo "Manifest missing function entries:" >&2
  sed 's/^/- /' "$tmp_missing" >&2
  status=1
fi

if [ -s "$tmp_stale" ]; then
  echo "Manifest includes stale entries:" >&2
  sed 's/^/- /' "$tmp_stale" >&2
  status=1
fi

if [ "$status" -ne 0 ]; then
  echo "Run: ./scripts/generate-function-manifest.sh" >&2
  exit "$status"
fi

echo "Function manifest check passed ($(wc -l < "$tmp_declared" | tr -d ' ') entries)."
