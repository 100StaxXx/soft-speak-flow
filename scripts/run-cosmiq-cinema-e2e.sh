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
INTERNAL_FUNCTION_SECRET="${INTERNAL_FUNCTION_SECRET:-cosmiq-cinema-e2e-secret}"

if [[ -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "Missing local Supabase credentials. Start the local stack first." >&2
  exit 1
fi

fixture_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosmiq-cinema-fixtures.XXXXXX")"
env_file="$(mktemp "${TMPDIR:-/tmp}/cosmiq-cinema-functions.XXXXXX.env")"
mock_log="$(mktemp "${TMPDIR:-/tmp}/cosmiq-cinema-mock.XXXXXX.log")"
functions_log="$(mktemp "${TMPDIR:-/tmp}/cosmiq-cinema-functions.XXXXXX.log")"
mock_pid=""
functions_pid=""

cleanup() {
  if [[ -n "$functions_pid" ]]; then
    kill "$functions_pid" >/dev/null 2>&1 || true
    wait "$functions_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$mock_pid" ]]; then
    kill "$mock_pid" >/dev/null 2>&1 || true
    wait "$mock_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$fixture_dir"
  rm -f "$env_file" "$mock_log" "$functions_log"
}

trap cleanup EXIT

for duration in 6 8 10 12 15; do
  ffmpeg -loglevel error -y \
    -f lavfi -i "color=c=0x15112b:s=320x180:r=24" \
    -f lavfi -i "sine=frequency=440:sample_rate=44100" \
    -t "$duration" -c:v libx264 -pix_fmt yuv420p -c:a aac \
    -movflags +faststart "$fixture_dir/cinema-$duration.mp4"
done

deno run --allow-net --allow-read="$fixture_dir" \
  supabase/tests/security/cosmiqCinemaProviderMock.ts \
  "--fixtures=$fixture_dir" --port=8787 >"$mock_log" 2>&1 &
mock_pid="$!"

mock_status="000"
for _ in $(seq 1 30); do
  mock_status="$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/health || true)"
  if [[ "$mock_status" == "200" ]]; then break; fi
  sleep 1
done
if [[ "$mock_status" != "200" ]]; then
  echo "Cinema provider mock failed to start." >&2
  cat "$mock_log" >&2 || true
  exit 1
fi

cat >"$env_file" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
INTERNAL_FUNCTION_SECRET=$INTERNAL_FUNCTION_SECRET
OPENAI_API_KEY=test-only-placeholder
FAL_KEY=test-only-placeholder
OPENAI_API_BASE_URL=http://host.lima.internal:8787/openai
FAL_QUEUE_BASE_URL=http://host.lima.internal:8787/fal
COSMIQ_CINEMA_ENABLED=true
COSMIQ_CINEMA_ROLLOUT_PERCENT=100
COSMIQ_CINEMA_IMAGE_MODEL=gpt-image-1-mini
COSMIQ_CINEMA_VIDEO_MODEL=fal-ai/kling-video/v3/standard/image-to-video
EOF

supabase functions serve --no-verify-jwt --env-file "$env_file" >"$functions_log" 2>&1 &
functions_pid="$!"

function_status="000"
for _ in $(seq 1 45); do
  function_status="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      -X POST "${SUPABASE_FUNCTIONS_URL}/process-companion-cinema-event" \
      -H "Content-Type: application/json" -H "apikey: $SUPABASE_ANON_KEY" \
      -d '{}' || true
  )"
  if [[ "$function_status" == "401" ]]; then break; fi
  sleep 1
done
if [[ "$function_status" != "401" ]]; then
  echo "Local cinema functions failed to start (status: $function_status)." >&2
  cat "$functions_log" >&2 || true
  exit 1
fi

export SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_FUNCTIONS_URL INTERNAL_FUNCTION_SECRET

if ! deno test --allow-env --allow-net --allow-read --allow-run=supabase \
  supabase/tests/security/cosmiq_cinema_e2e.test.ts; then
  cat "$mock_log" >&2 || true
  cat "$functions_log" >&2 || true
  exit 1
fi
