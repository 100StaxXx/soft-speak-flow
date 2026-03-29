#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SUPABASE_STATUS_ENV="$(supabase status -o env)"
eval "$SUPABASE_STATUS_ENV"

SUPABASE_URL="${SUPABASE_URL:-${API_URL:-http://127.0.0.1:54321}}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${ANON_KEY:-}}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SERVICE_ROLE_KEY:-}}"
SUPABASE_FUNCTIONS_URL="${SUPABASE_FUNCTIONS_URL:-${FUNCTIONS_URL:-${SUPABASE_URL%/}/functions/v1}}"
INTERNAL_FUNCTION_SECRET="${INTERNAL_FUNCTION_SECRET:-security-test-internal-secret}"
OPENAI_API_KEY="${OPENAI_API_KEY:-test-openai-key}"

if [[ -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "Missing local Supabase anon or service-role key. Is the local stack running?" >&2
  exit 1
fi

export SUPABASE_URL
export SUPABASE_ANON_KEY
export SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_FUNCTIONS_URL
export INTERNAL_FUNCTION_SECRET
export OPENAI_API_KEY

tmp_env="$(mktemp "${TMPDIR:-/tmp}/security-functions.XXXXXX.env")"
tmp_log="$(mktemp "${TMPDIR:-/tmp}/security-functions.XXXXXX.log")"
serve_pid=""

cleanup() {
  if [[ -n "$serve_pid" ]]; then
    kill "$serve_pid" >/dev/null 2>&1 || true
    wait "$serve_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$tmp_env" "$tmp_log"
}

trap cleanup EXIT

cat >"$tmp_env" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
INTERNAL_FUNCTION_SECRET=$INTERNAL_FUNCTION_SECRET
OPENAI_API_KEY=$OPENAI_API_KEY
EOF

health_status="$(
  curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_FUNCTIONS_URL}/verify-admin-access" \
    -H "Content-Type: application/json" \
    -d '{}' || true
)"

if [[ "$health_status" == "000" ]]; then
  supabase functions serve --env-file "$tmp_env" >"$tmp_log" 2>&1 &
  serve_pid="$!"

  for _ in $(seq 1 30); do
    health_status="$(
      curl -sS -o /dev/null -w "%{http_code}" \
        -X POST "${SUPABASE_FUNCTIONS_URL}/verify-admin-access" \
        -H "Content-Type: application/json" \
        -d '{}' || true
    )"
    if [[ "$health_status" != "000" ]]; then
      break
    fi
    sleep 1
  done

  if [[ "$health_status" == "000" ]]; then
    echo "Local edge functions did not come up for security testing." >&2
    cat "$tmp_log" >&2 || true
    exit 1
  fi
fi

deno test --allow-env --allow-net --allow-read --allow-run=supabase supabase/tests/security/edge_functions.test.ts
