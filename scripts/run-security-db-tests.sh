#!/usr/bin/env bash
# Workaround for `supabase test db` running pg_prove inside a Docker container
# that bind-mounts each test file individually but not the surrounding
# directory — so psql `\ir _support/helpers.sql` directives in the test files
# fail with "No such file or directory" inside the container.
#
# We pre-inline the helpers content into temp copies of each test file at the
# location of the \ir directive, then hand those copies to `supabase test db`.
# Side effect: error messages point at /tmp paths instead of the originals,
# but the test names in pg_prove output are unchanged.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TESTS_DIR="supabase/tests/security"
HELPERS="$TESTS_DIR/_support/helpers.sql"

if [[ ! -f "$HELPERS" ]]; then
  echo "Missing security test helpers: $HELPERS" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/security-db-tests.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

COMBINED_FILES=()
for src in \
  "$TESTS_DIR/01_rls_and_storage.sql" \
  "$TESTS_DIR/02_entitlements_and_rpc.sql" \
  "$TESTS_DIR/04_companion_claim_validation.sql"
do
  if [[ ! -f "$src" ]]; then
    echo "Missing security test file: $src" >&2
    exit 1
  fi
  out="$TMP_DIR/$(basename "$src")"
  awk -v helpers="$HELPERS" '
    /^\\ir _support\/helpers\.sql[[:space:]]*$/ {
      while ((getline line < helpers) > 0) print line
      close(helpers)
      next
    }
    { print }
  ' "$src" > "$out"
  COMBINED_FILES+=("$out")
done

exec supabase test db "${COMBINED_FILES[@]}"
