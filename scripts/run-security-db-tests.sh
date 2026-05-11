#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SUPPORT_FILE="$ROOT_DIR/supabase/tests/security/_support/helpers.sql"
TEST_FILES=(
  "$ROOT_DIR/supabase/tests/security/01_rls_and_storage.sql"
  "$ROOT_DIR/supabase/tests/security/02_entitlements_and_rpc.sql"
  "$ROOT_DIR/supabase/tests/security/04_companion_claim_validation.sql"
)

mkdir -p "$ROOT_DIR/tmp"
tmp_dir="$(mktemp -d "$ROOT_DIR/tmp/security-db-tests.XXXXXX")"

cleanup() {
  rm -rf "$tmp_dir"
}

trap cleanup EXIT

compiled_tests=()
for test_file in "${TEST_FILES[@]}"; do
  compiled_test="$tmp_dir/$(basename "$test_file")"
  awk -v helper="$SUPPORT_FILE" '
    /^\\ir[[:space:]]+_support\/helpers\.sql[[:space:]]*$/ {
      while ((getline line < helper) > 0) {
        print line
      }
      close(helper)
      next
    }
    { print }
  ' "$test_file" > "$compiled_test"
  compiled_tests+=("$compiled_test")
done

supabase test db "${compiled_tests[@]}"
