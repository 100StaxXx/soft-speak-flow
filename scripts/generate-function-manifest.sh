#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANUAL_ALLOWLIST="scripts/function-manifest-manual-allowlist.txt"

collect_frontend() {
  find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print0 \
    | xargs -0 perl -0777 -ne 'while(/functions\s*\.\s*invoke\(\s*["\x27]([^"\x27]+)["\x27]/sg){print "$1\n"}' \
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
      'dispatch-daily-pushes' \
      'retry-missing-pep-talk-transcripts'
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

to_json_array() {
  if [ -s "$1" ]; then
    jq -R . < "$1" | jq -s .
  else
    echo '[]'
  fi
}

tmp_frontend="$(mktemp)"
tmp_internal="$(mktemp)"
tmp_scheduled="$(mktemp)"
tmp_manual="$(mktemp)"
tmp_allow="$(mktemp)"
trap 'rm -f "$tmp_frontend" "$tmp_internal" "$tmp_scheduled" "$tmp_manual" "$tmp_allow"' EXIT

collect_frontend > "$tmp_frontend"
collect_internal > "$tmp_internal"
collect_scheduled > "$tmp_scheduled"
collect_manual_allowlist > "$tmp_manual"
cat "$tmp_frontend" "$tmp_internal" "$tmp_scheduled" "$tmp_manual" | sed '/^$/d' | sort -u > "$tmp_allow"

frontend_json="$(to_json_array "$tmp_frontend")"
internal_json="$(to_json_array "$tmp_internal")"
scheduled_json="$(to_json_array "$tmp_scheduled")"
allow_json="$(to_json_array "$tmp_allow")"

jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson frontendInvoked "$frontend_json" \
  --argjson internalInvoked "$internal_json" \
  --argjson scheduled "$scheduled_json" \
  --argjson allowList "$allow_json" \
  '{
    generatedAt: $generatedAt,
    frontendInvoked: $frontendInvoked,
    internalInvoked: $internalInvoked,
    scheduled: $scheduled,
    allowList: $allowList
  }' > supabase/function-manifest.json

echo "Wrote supabase/function-manifest.json"
echo "allowList count: $(wc -l < "$tmp_allow" | tr -d ' ')"
