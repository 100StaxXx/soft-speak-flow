#!/bin/bash
# Archive Supabase Functions before cleanup
# This is safe to run - it only creates backups

ARCHIVE_DIR="archive/supabase-functions-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ARCHIVE_DIR"

echo "📦 Archiving Supabase functions to $ARCHIVE_DIR..."

# Archive functions
if [ -d "supabase/functions" ]; then
    cp -r supabase/functions "$ARCHIVE_DIR/"
    echo "✅ Functions archived"
fi

# Archive config
if [ -f "supabase/config.toml" ]; then
    cp supabase/config.toml "$ARCHIVE_DIR/"
    echo "✅ Config archived"
fi

# Create manifest
cat > "$ARCHIVE_DIR/MANIFEST.txt" << EOF
Supabase Functions Archive
Created: $(date)
Purpose: Backup before cleanup after Firebase migration

Contents:
- supabase/functions/ (all edge functions)
- supabase/config.toml (function configuration)

Migration Status:
- All app code migrated to Firebase ✅
- 69 Supabase functions found (none referenced in app)
- Firebase functions: 56 total, 50 referenced

This archive can be deleted after:
1. Verifying no active cron jobs in Supabase
2. Verifying webhooks point to Firebase
3. Confirming Firebase cron jobs are active
4. Testing all functionality works with Firebase only
EOF

echo "✅ Archive complete: $ARCHIVE_DIR"
echo "📋 Review MANIFEST.txt in archive for details"

