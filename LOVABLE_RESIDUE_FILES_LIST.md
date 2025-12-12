# 🗂️ Lovable Migration Residue - File List

Quick reference of all files containing Lovable/Supabase/Vercel references.

---

## 🔴 Critical: Active Code Files

### Supabase Edge Functions (69+ files)
**Location:** `soft-speak-flow/supabase/functions/`

All files in this directory contain Supabase/Lovable references:
- `_shared/cors.ts` - Lovable domain CORS
- `_shared/*.ts` - All shared utilities
- `*/index.ts` - All 69+ edge function files

**Key files with Lovable endpoints:**
- `mentor-chat/index.ts`
- `get-single-quote/index.ts`
- `generate-zodiac-images/index.ts`
- `generate-weekly-insights/index.ts`
- `generate-weekly-challenges/index.ts`
- `generate-smart-notifications/index.ts`
- `generate-sample-card/index.ts`
- `generate-reflection-reply/index.ts`
- `generate-quotes/index.ts`
- `generate-quote-image/index.ts`
- `generate-proactive-nudges/index.ts`
- `generate-neglected-companion-image/index.ts`
- `generate-mood-push/index.ts`
- `generate-mentor-script/index.ts`
- `generate-mentor-content/index.ts`
- `generate-lesson/index.ts`
- `generate-inspire-quote/index.ts`
- `generate-guild-story/index.ts`
- `generate-evolution-card/index.ts`
- `generate-daily-missions/index.ts`
- `generate-daily-horoscope/index.ts`
- `generate-cosmic-postcard/index.ts`
- `generate-cosmic-postcard-test/index.ts`
- `generate-cosmic-deep-dive/index.ts`
- `generate-complete-pep-talk/index.ts`
- `generate-companion-story/index.ts`
- `generate-companion-image/index.ts`
- `generate-companion-evolution/index.ts`
- `generate-check-in-response/index.ts`
- `generate-adaptive-push/index.ts`
- `generate-activity-comment/index.ts`
- `calculate-cosmic-profile/index.ts`
- `batch-generate-lessons/index.ts`

**Files with function invocations:**
- `trigger-adaptive-event/index.ts`
- `send-shout-notification/index.ts`
- `schedule-adaptive-pushes/index.ts`
- `process-daily-decay/index.ts`
- `generate-daily-mentor-pep-talks/index.ts`
- `dispatch-daily-quote-pushes/index.ts`

**Files with RPC calls:**
- `delete-user/index.ts`
- `delete-user-account/index.ts`

---

## 🟡 Configuration Files

### Build & Config
- `soft-speak-flow/vite.config.ts` - Supabase vendor chunks, optimizeDeps, service worker
- `package.json` - lovable-tagger dependency
- `soft-speak-flow/package.json` - lovable-tagger dependency
- `soft-speak-flow/capacitor.config.ts` - Commented Lovable URL
- `soft-speak-flow/README.md` - Lovable docs reference

---

## 🟢 Migration Scripts (May Keep)

### Data Migration Scripts
- `scripts/migrate-profiles-to-firestore.ts`
- `scripts/migrate-mentors-to-firestore.ts`
- `scripts/migrate-data-to-firestore.js`
- `scripts/export-mentors-json.ts`
- `scripts/backup-storage.ts`

---

## 📚 Documentation Files

### Root Documentation
- `ENV_VARIABLES_QUICK_REFERENCE.md`
- `ENVIRONMENT_VARIABLE_DIFF_REPORT.md`
- `ENV_DIFF_SUMMARY.md`
- `ENV_FIXES_IMPLEMENTED.md`
- `BACKEND_INTEGRITY_SCAN.md`
- `BACKEND_INTEGRITY_SCAN_REPORT.md`
- `AUTH_CLEANUP_SUMMARY.md`
- `AUTH_FLOW_AUDIT_REPORT.md`
- `AUTH_FLOW_END_TO_END_AUDIT.md`
- `BUGS_FIXED_FINAL.md`
- `BUGS_FOUND_AND_FIXED.md`
- `CLEANUP_COMPLETE.md`
- `CLEANUP_VERIFICATION_COMPLETE.md`
- `COMPONENT_DEPENDENCY_AUDIT.md`
- `FINAL_CHECK_COMPLETE.md`
- `FINAL_VERIFICATION_COMPLETE.md`
- `MIGRATION_PROGRESS.md`
- `NEXT_STEPS_COMPLETED.md`
- `SUPABASE_CLEANUP_COMPLETE.md`
- `SUPABASE_TO_FIREBASE_COMPLETE.md`
- `SUPABASE_TO_FIREBASE_MIGRATION_PLAN.md`
- `SUPABASE_TO_FIREBASE_STATUS.md`

### Docs Directory
- `docs/auth-diagnostic-report.md`
- `docs/database_audit.md`
- `docs/EDGE_FUNCTIONS_MIGRATION.md`
- `docs/FINAL_MIGRATION_STATUS.md`
- `docs/FIREBASE_MIGRATION_STATUS.md`
- `docs/GEMINI_API_MIGRATION.md`
- `docs/GEMINI_MIGRATION_GUIDE.md`
- `docs/MIGRATION_CHECKLIST.md`
- `docs/MIGRATION_COMPLETE.md`
- `docs/MIGRATION_GUIDE.md`
- `docs/MIGRATION_NEXT_STEPS.md`
- `docs/MIGRATION_PROGRESS.md`
- `docs/MIGRATION_STATUS.md`
- `docs/MIGRATION_SUMMARY.md`
- `docs/VAPID_SETUP.md`
- `docs/FRONTEND_ENV_SETUP.md`
- `docs/FINAL_SETUP_COMPLETE.md`
- `docs/account-deletion-report.md`

### Soft-Speak-Flow Docs
- `soft-speak-flow/docs/**/*.md` - All markdown files in this directory

---

## 🗄️ Migration Files

### SQL Migrations
**Location:** `soft-speak-flow/supabase/migrations/`

**148 SQL files** - All contain RLS policies, functions, and schema definitions:
- `20251211161338_*.sql`
- `20251211154427_*.sql`
- `20251211084106_*.sql`
- `20251211084105_*.sql`
- `20251210204351_*.sql`
- `20251210202954_*.sql`
- `20251210202805_*.sql`
- `20251210202335_*.sql`
- `20251210201456_*.sql`
- `20251210194522_*.sql`
- `20250115000005_*.sql`
- `20250115000004_*.sql`
- `20250115000003_*.sql`
- `20250115000002_*.sql`
- `20251208194448_*.sql`
- `20251208191139_*.sql`
- `20251208123000_*.sql`
- `20251203175152_*.sql`
- `20251203171947_*.sql`
- `20251203041035_*.sql`
- `20251202232448_*.sql`
- `20251202160450_*.sql`
- `20251129040200_*.sql`
- `20251129040100_*.sql`
- `20251129040000_*.sql`
- `20251127012809_*.sql`
- `20251127012757_*.sql`
- `20251126_*.sql` (multiple)
- `20251126072322_*.sql`
- `20251125103000_*.sql`
- `20251125054423_*.sql`
- `20251125054328_*.sql`
- `20251125053253_*.sql`
- `20251124235638_*.sql`
- `20251124225200_*.sql`
- `20251124225119_*.sql`
- `20251124203543_*.sql`
- `20251124171727_*.sql`
- `20251123_*.sql`
- `20251122160512_*.sql`
- `20251122160402_*.sql`
- `20251118065608_*.sql`
- `20251117050233_*.sql`
- `20251117022847_*.sql`
- `20251116182027_*.sql`
- `20251116180950_*.sql`
- `20251115003804_*.sql`
- `20251114163712_*.sql`
- `20251114163453_*.sql`
- `20251114160858_*.sql`
- `20251114160847_*.sql`
- And 100+ more...

---

## 📦 Source Code References

### Source Files with RLS Comments
- `src/hooks/useCompanion.ts` - RLS policy comment
- `src/components/HabitCard.tsx` - RLS enforcement comment

---

## 🗃️ Archive Directory

### Archived Functions
**Location:** `archive/supabase-functions-20251211-142222/`

- `functions/**/*.ts` - 78 TypeScript files
- `MANIFEST.txt`
- All contain Lovable/Supabase references (safe to delete if migration complete)

---

## 🔧 Script Files

### Verification & Cleanup Scripts
- `scripts/verify-migration.ts` - Checks for Supabase usage
- `scripts/backend-integrity-scan.ts` - Scans for deleted modules
- `scripts/backend-integrity-scan.js` - Same as above
- `scripts/backend-integrity-scan.cjs` - Same as above
- `scripts/verify-cleanup.ps1` - PowerShell cleanup verification
- `scripts/cleanup-supabase.sh` - Bash cleanup script
- `scripts/cleanup-supabase.ps1` - PowerShell cleanup script
- `scripts/archive-supabase-functions.ps1` - Archive script

---

## 📋 Summary by Category

### Must Remove/Update (Active Code)
- **69+ Edge Functions** in `soft-speak-flow/supabase/functions/`
- **2 Config Files** (vite.config.ts, package.json)
- **1 CORS Config** (`_shared/cors.ts`)

### Can Archive (Migrations)
- **148 SQL Migration Files** in `soft-speak-flow/supabase/migrations/`

### Can Delete (Archives)
- **1 Archive Directory** (`archive/supabase-functions-20251211-142222/`)

### Update (Documentation)
- **50+ Markdown Files** with references

### Keep (Migration Scripts)
- **5 Migration Scripts** (if still needed for data migration)

---

**Total Files Affected:** 300+ files

