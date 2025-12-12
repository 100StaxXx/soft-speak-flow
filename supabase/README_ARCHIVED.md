# ⚠️ ARCHIVED: Supabase Directory

**Status:** This directory is **ARCHIVED** and kept for historical reference only.

**Current Status:** The Cosmiq app has been fully migrated to Firebase. All Supabase code has been removed from active use.

---

## What's in This Directory

This directory contains historical migration files from the Supabase era:

- **`migrations/`** - 148 SQL migration files (historical database schema)
- **`config.toml`** - Supabase project configuration (historical)
- **`APPLE_SUBSCRIPTIONS.md`** - Apple subscription setup (may still be relevant)

---

## Current Setup

The app now uses:

- ✅ **Firebase Authentication** (replaces Supabase Auth)
- ✅ **Firestore Database** (replaces Supabase PostgreSQL)
- ✅ **Firebase Cloud Functions** (replaces Supabase Edge Functions)
- ✅ **Firebase Storage** (replaces Supabase Storage)

---

## Can I Delete This Directory?

**Yes, but with caution:**

1. ✅ **Safe to delete:** `migrations/` - Historical SQL files, not used by Firebase
2. ✅ **Safe to delete:** `config.toml` - Supabase project config, not used
3. ⚠️ **Review first:** `APPLE_SUBSCRIPTIONS.md` - May contain relevant setup info

**Recommendation:** Archive this entire directory to `archive/supabase-$(date +%Y%m%d)/` if you want to keep it for reference, or delete it if you're confident you don't need the historical migration files.

---

## Migration Status

- ✅ All Supabase code removed from `src/` directory
- ✅ All Supabase dependencies removed from `package.json`
- ✅ All Supabase Edge Functions migrated to Firebase Cloud Functions
- ✅ All database operations migrated to Firestore
- ✅ All authentication migrated to Firebase Auth

---

**Last Updated:** 2025-01-27  
**Migration Completed:** 2024-12-11  
**Status:** Archived for historical reference
