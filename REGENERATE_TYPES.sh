#!/bin/bash

# ============================================
# Regenerate TypeScript Types for Supabase
# ============================================
# Run this after applying migrations to update types

OUTPUT_FILE="src/integrations/supabase/types.ts"

# Allow overriding through env vars to avoid hard-coded project IDs.
# Priority:
#   1. SUPABASE_PROJECT_ID (explicit override)
#   2. VITE_SUPABASE_PROJECT_ID (from .env usage)
#   3. First matching value inside .env or .env.local
PROJECT_ID="${SUPABASE_PROJECT_ID:-${VITE_SUPABASE_PROJECT_ID:-}}"

extract_project_id () {
  local file="$1"
  if [ -f "$file" ]; then
    local value
    value=$(grep -m1 '^VITE_SUPABASE_PROJECT_ID=' "$file" | cut -d= -f2- | tr -d '\"' | tr -d "'")
    if [ -n "$value" ]; then
      echo "$value"
    fi
  fi
}

if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="$(extract_project_id .env)"
fi

if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="$(extract_project_id .env.local)"
fi

if [ -z "$PROJECT_ID" ]; then
  echo "❌ ERROR: Could not determine Supabase project ID."
  echo ""
  echo "Set SUPABASE_PROJECT_ID or VITE_SUPABASE_PROJECT_ID, or add VITE_SUPABASE_PROJECT_ID"
  echo "to your .env/.env.local before running this script."
  exit 1
fi

echo "================================================"
echo "Regenerating TypeScript types from Supabase..."
echo "================================================"
echo ""
echo "Project ID: $PROJECT_ID"
echo "Output: $OUTPUT_FILE"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ ERROR: Supabase CLI not found!"
    echo ""
    echo "Install it first:"
    echo "  npm install -g supabase"
    echo "  # OR"
    echo "  brew install supabase/tap/supabase"
    echo ""
    exit 1
fi

# Backup existing types
if [ -f "$OUTPUT_FILE" ]; then
    BACKUP_FILE="${OUTPUT_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📦 Backing up existing types to: $BACKUP_FILE"
    cp "$OUTPUT_FILE" "$BACKUP_FILE"
fi

# Generate types
echo "🔄 Generating types..."
echo ""

supabase gen types typescript --project-id "$PROJECT_ID" > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Types regenerated."
    echo ""
    echo "📄 Output file: $OUTPUT_FILE"
    echo "📊 File size: $(wc -c < "$OUTPUT_FILE") bytes"
    echo ""
    echo "New RPC functions should now be typed:"
    echo "  ✓ complete_referral_stage3"
    echo "  ✓ apply_referral_code_atomic"
    echo "  ✓ has_completed_referral"
    echo "  ✓ increment_referral_count"
    echo "  ✓ decrement_referral_count"
    echo ""
    echo "🎯 Next steps:"
    echo "  1. Review the generated types"
    echo "  2. Run: npm run type-check"
    echo "  3. Run: npm run build"
    echo "  4. Commit the updated types.ts file"
    echo ""
else
    echo ""
    echo "❌ ERROR: Failed to generate types"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Ensure migrations are applied to the database"
    echo "  2. Check your Supabase credentials"
    echo "  3. Verify network connectivity"
    echo ""
    exit 1
fi
