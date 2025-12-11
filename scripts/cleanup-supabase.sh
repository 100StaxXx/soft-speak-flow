#!/bin/bash
# Cleanup script to remove Supabase dependencies and files
# Run this after verifying migration is complete

echo "🧹 Cleaning up Supabase dependencies and files..."

# Remove Supabase package
echo "📦 Removing @supabase/supabase-js from package.json..."
npm uninstall @supabase/supabase-js

# Remove Supabase integration directory
if [ -d "src/integrations/supabase" ]; then
  echo "🗑️  Removing src/integrations/supabase directory..."
  rm -rf src/integrations/supabase
  echo "✅ Removed Supabase integration directory"
else
  echo "ℹ️  Supabase integration directory not found (may have been removed already)"
fi

# Check for remaining Supabase references
echo ""
echo "🔍 Checking for remaining Supabase references..."
REMAINING=$(grep -r "supabase" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "node_modules" | wc -l)

if [ "$REMAINING" -eq 0 ]; then
  echo "✅ No remaining Supabase references found in source code!"
else
  echo "⚠️  Found $REMAINING remaining Supabase references. Please review:"
  grep -r "supabase" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "node_modules"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env files to remove Supabase environment variables"
echo "2. Update documentation to remove Supabase references"
echo "3. Test the application thoroughly"
echo "4. Commit the changes"

