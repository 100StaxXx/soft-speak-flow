# Supabase Functions - ARCHIVED

⚠️ **This directory has been archived after migration to Firebase Cloud Functions.**

## Archive Location
All Supabase Edge Functions have been archived to:
- `archive/supabase-functions-20251211-142222/`

## Migration Status

### ✅ Completed
- All 69 Supabase Edge Functions archived
- All app code migrated to Firebase Cloud Functions
- 56 Firebase Functions deployed and active
- No Supabase client imports in app code

### ⚠️ Verification Required
Before deleting the archive, verify:
1. No active cron jobs in Supabase database calling Supabase functions
2. Apple webhook points to Firebase (not Supabase)
3. Firebase cron jobs are active and working
4. All functionality tested with Firebase only

## What Remains

### Kept for Reference
- `supabase/migrations/` - Database migrations (may still be needed)
- `supabase/config.toml` - Function configuration (for reference)
- `supabase/dataconnect/` - Data Connect configuration (if used)

### Removed
- `supabase/functions/` - All Edge Functions (archived)

## Restoration

If needed, restore from archive:
```powershell
# Restore functions
Copy-Item -Path "archive/supabase-functions-20251211-142222/functions" -Destination "supabase/functions" -Recurse

# Restore config
Copy-Item -Path "archive/supabase-functions-20251211-142222/config.toml" -Destination "supabase/config.toml"
```

## Migration Date
**Archived:** December 11, 2025

