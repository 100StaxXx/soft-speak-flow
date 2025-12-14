# Old Supabase Project Removal Guide

**Date:** 2025-01-27  
**Old Project:** `tffrgsaawvletgiztfry` (Lovable-managed)  
**New Project:** `opbfpbbqvuksuvmtmssd` (Self-managed)

---

## What "All App" Currently Means

### ✅ Already Migrated (Frontend/Code)

**"All app" means the frontend application code is now using the new project:**

1. **Frontend Application Code**
   - ✅ React/TypeScript source code (`src/`)
   - ✅ Supabase client initialization (`src/integrations/supabase/client.ts`)
   - ✅ All database queries, auth calls, storage operations
   - ✅ All hooks, components, pages that use Supabase

2. **Runtime Configuration**
   - ✅ `.env` file - All environment variables point to new project
   - ✅ Build-time configuration
   - ✅ Frontend build output (when built)

3. **Local Configuration**
   - ✅ `supabase/config.toml` - CLI linked to new project
   - ✅ TypeScript type generation scripts

### ⚠️ NOT Included in "All App" (Backend/Infrastructure)

These are separate from the frontend codebase and need separate verification:

1. **Edge Functions** - Deploy separately
   - 70+ edge functions in `supabase/functions/`
   - Must be deployed to new project: `supabase functions deploy <name> --project-ref opbfpbbqvuksuvmtmssd`

2. **Database Migrations** - Apply separately
   - 134 migration files in `supabase/migrations/`
   - Must be applied to new project: `supabase db push --project-ref opbfpbbqvuksuvmtmssd`

3. **Storage Files** - Migrate separately (if data exists)
   - Storage buckets and files
   - Use `scripts/backup-storage.ts` and `scripts/upload-storage.ts`

4. **Database Data** - Migrate separately (if data exists)
   - User accounts, profiles, companions, etc.
   - Need custom migration script or pg_dump/restore

5. **Secrets Configuration** - Configure separately
   - Edge function secrets
   - OAuth provider configurations
   - API keys

6. **Cron Jobs** - Configure separately
   - Scheduled tasks (daily pushes, etc.)

---

## Current Status: What's Safe to Remove

### ✅ Safe to Remove NOW (Codebase Cleanup)

**From this codebase, you can remove:**

1. **Documentation References**
   - References in `docs/database-state-report.md` (already marked deprecated)
   - References in `docs/migration-verification-report.md` (historical)
   - **Action**: These are already just documentation - safe to keep or remove

2. **No Active Code References**
   - ✅ **0 active code files** reference old project
   - ✅ Only 6 references total, all in documentation files
   - ✅ No hardcoded URLs or project IDs in source code

### ❌ DO NOT Remove Yet (Until Verified)

**Before removing the old Supabase project entirely, verify:**

1. **✅ Data Migration Complete**
   - [ ] All user data migrated to new project
   - [ ] All storage files migrated to new project
   - [ ] All database records copied

2. **✅ Edge Functions Deployed**
   - [ ] All edge functions deployed to new project
   - [ ] Edge functions tested and working

3. **✅ Migrations Applied**
   - [ ] All 134 migrations applied to new project
   - [ ] Database schema matches

4. **✅ Secrets Configured**
   - [ ] All secrets set in new project
   - [ ] OAuth providers configured

5. **✅ Production Testing**
   - [ ] Application fully tested in new project
   - [ ] All features working
   - [ ] No issues found

---

## What Can Be Removed from Codebase

### ✅ Safe Cleanup (Documentation Only)

**Files that reference old project (documentation only):**

1. `docs/database-state-report.md`
   - Contains deprecated project info (lines 33-39, 62)
   - **Option**: Keep for historical record OR update to remove old project section

2. `docs/migration-verification-report.md`
   - Contains verification that old project is no longer referenced (line 50)
   - **Option**: Keep as migration record OR update to remove old project mentions

**Total references:** 6 lines across 2 documentation files (no code impact)

### ⚠️ Codebase is Already Clean

- ✅ **No source code files** reference the old project
- ✅ **No configuration files** reference the old project (except docs)
- ✅ **No scripts** reference the old project (they default to new project)
- ✅ **No environment files** reference the old project

---

## What About the Actual Supabase Project?

### Old Project: `tffrgsaawvletgiztfry`

**Can it be deleted from Supabase dashboard?**

**⚠️ ONLY after verifying:**

1. **Data Migration Status:**
   - ❓ **Question**: Has user data been migrated?
   - ❓ **Question**: Has storage been migrated?
   - ❓ **Question**: Are there any production users/data in old project?

2. **Edge Functions Status:**
   - ❓ **Question**: Are edge functions deployed to new project?
   - ❓ **Question**: Are they working correctly?

3. **Testing Status:**
   - ❓ **Question**: Has the new project been fully tested?
   - ❓ **Question**: Is it handling production load?

### Recommended Timeline

1. **Phase 1: NOW** ✅
   - Codebase is clean (done)
   - Frontend uses new project (done)
   - Documentation updated (done)

2. **Phase 2: BEFORE REMOVAL** ⚠️
   - Verify data migration (if needed)
   - Deploy all edge functions to new project
   - Apply all migrations to new project
   - Configure all secrets
   - Test thoroughly

3. **Phase 3: AFTER PRODUCTION TESTING** ✅
   - Monitor new project in production
   - Ensure no issues
   - Keep old project as backup for 30-90 days

4. **Phase 4: FINAL CLEANUP** 🗑️
   - Delete old Supabase project from dashboard
   - Remove documentation references (optional)

---

## Removal Checklist

Before deleting the old Supabase project:

- [ ] All database migrations applied to new project
- [ ] All edge functions deployed to new project
- [ ] All secrets configured in new project
- [ ] All storage files migrated (if data exists)
- [ ] All user data migrated (if data exists)
- [ ] Application tested and working in new project
- [ ] Production deployment successful
- [ ] No errors in production logs
- [ ] Monitoring shows healthy status
- [ ] Old project kept as backup for 30-90 days
- [ ] Documentation updated (optional)

---

## Summary: How Much Can Be Removed?

### From Codebase: ~95% Already Clean

**What's left:**
- 6 documentation references (informational only)
- 0 code references
- 0 configuration references

**Action:** Codebase is essentially clean. Documentation references can stay for historical record or be updated.

### From Supabase Dashboard: 0% Until Verified

**What needs verification:**
- Data migration status (unknown)
- Edge function deployment status (unknown)
- Migration application status (unknown)
- Production readiness (unknown)

**Action:** Verify infrastructure migration before considering project deletion.

---

## Questions to Answer Before Removal

1. **Is there production data in the old project?**
   - If YES → Must migrate before deletion
   - If NO → Can delete after testing

2. **Are edge functions deployed to new project?**
   - Check: `supabase functions list --project-ref opbfpbbqvuksuvmtmssd`

3. **Are migrations applied to new project?**
   - Check: `supabase db push --project-ref opbfpbbqvuksuvmtmssd`

4. **Is new project production-ready?**
   - All features tested
   - All secrets configured
   - Monitoring in place

5. **Is there a rollback plan?**
   - Keep old project for 30-90 days as backup
   - Document rollback procedure

---

## Recommendation

**Current Status:**
- ✅ Codebase migration: **COMPLETE**
- ⚠️ Infrastructure migration: **VERIFY STATUS**

**Recommended Action:**
1. Keep old project as backup (30-90 days minimum)
2. Verify all infrastructure is migrated
3. Test thoroughly in production
4. Only then consider deleting old project
5. Documentation references can stay or be cleaned up (your choice)

**The codebase is ready. The infrastructure migration status needs verification before deleting the old project.**
