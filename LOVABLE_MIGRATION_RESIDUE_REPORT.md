# 🔍 Lovable Migration Residue Detector Report

**Generated:** $(date)  
**Scan Type:** Comprehensive residue detection for Lovable/Supabase/Vercel references

---

## 📊 Executive Summary

This report identifies all remaining references to the old Lovable/Supabase architecture that should be cleaned up or migrated. The codebase has been migrated to Firebase, but significant residue remains.

### Summary Statistics
- **Lovable Endpoint References:** 88+ instances
- **Supabase Edge Functions:** 69+ functions still present
- **RLS Policy References:** 1,437+ instances in migrations
- **Supabase Client Imports:** 189+ instances
- **Environment Variable References:** 456+ instances
- **Migration Files:** 148 SQL migration files

---

## 1. 🎯 Lovable Endpoint References

### Active Code (Supabase Functions)
**Location:** `soft-speak-flow/supabase/functions/`

These functions still call the Lovable AI Gateway endpoint `https://ai.gateway.lovable.dev`:

1. **`mentor-chat/index.ts`** (Line 143)
   - Uses `LOVABLE_API_KEY` and calls Lovable gateway

2. **`get-single-quote/index.ts`** (Line 243)
   - Calls Lovable gateway for image generation

3. **`generate-zodiac-images/index.ts`** (Line 42)
   - Uses `LOVABLE_API_KEY` and Lovable gateway

4. **`generate-weekly-insights/index.ts`** (Line 94)
   - Calls Lovable gateway

5. **`generate-weekly-challenges/index.ts`** (Line 48)
   - Calls Lovable gateway

6. **`generate-smart-notifications/index.ts`** (Line 291)
   - Calls Lovable gateway

7. **`generate-sample-card/index.ts`** (Line 171)
   - Uses `LOVABLE_API_KEY` and Lovable gateway

8. **`generate-reflection-reply/index.ts`** (Line 90)
   - Calls Lovable gateway

9. **`generate-quotes/index.ts`** (Line 29)
   - Calls Lovable gateway

10. **`generate-quote-image/index.ts`** (Line 97)
    - Uses `LOVABLE_API_KEY` and Lovable gateway

11. **`generate-proactive-nudges/index.ts`** (Lines 111, 173, 233, 290)
    - Multiple calls to Lovable gateway

12. **`generate-neglected-companion-image/index.ts`** (Line 77)
    - Calls Lovable gateway

13. **`generate-mood-push/index.ts`** (Line 41)
    - Calls Lovable gateway

14. **`generate-mentor-script/index.ts`** (Line 220)
    - Uses `LOVABLE_API_KEY` and Lovable gateway

15. **`generate-mentor-content/index.ts`** (Line 103)
    - Uses `LOVABLE_API_KEY` and Lovable gateway

16. **`generate-lesson/index.ts`** (Line 89)
    - Calls Lovable gateway

17. **`generate-inspire-quote/index.ts`** (Line 45)
    - Calls Lovable gateway

18. **`generate-guild-story/index.ts`** (Line 260)
    - Calls Lovable gateway

19. **`generate-evolution-card/index.ts`** (Line 178)
    - Calls Lovable gateway

20. **`generate-daily-missions/index.ts`** (Line 142)
    - Calls Lovable gateway

21. **`generate-daily-horoscope/index.ts`** (Line 205)
    - Calls Lovable gateway

22. **`generate-cosmic-postcard/index.ts`** (Line 246)
    - Calls Lovable gateway

23. **`generate-cosmic-postcard-test/index.ts`** (Line 143)
    - Calls Lovable gateway

24. **`generate-cosmic-deep-dive/index.ts`** (Line 243)
    - Calls Lovable gateway

25. **`generate-complete-pep-talk/index.ts`** (Line 210)
    - Calls Lovable gateway

26. **`generate-companion-story/index.ts`** (Line 401)
    - Calls Lovable gateway

27. **`generate-companion-image/index.ts`** (Line 294)
    - Calls Lovable gateway

28. **`generate-companion-evolution/index.ts`** (Lines 445, 700)
    - Multiple calls to Lovable gateway

29. **`generate-check-in-response/index.ts`** (Line 160)
    - Calls Lovable gateway

30. **`generate-adaptive-push/index.ts`** (Line 96)
    - Calls Lovable gateway

31. **`generate-activity-comment/index.ts`** (Line 138)
    - Calls Lovable gateway

32. **`calculate-cosmic-profile/index.ts`** (Line 157)
    - Calls Lovable gateway

33. **`batch-generate-lessons/index.ts`** (Line 67)
    - Calls Lovable gateway

### Configuration Files
- **`soft-speak-flow/supabase/functions/_shared/cors.ts`** (Lines 39, 71)
  - Allows `.lovableproject.com` and `.lovable.dev` origins

- **`soft-speak-flow/capacitor.config.ts`** (Line 10)
  - Commented out Lovable project URL

- **`soft-speak-flow/README.md`** (Line 73)
  - Reference to Lovable custom domain docs

### Documentation
- Multiple docs reference Lovable endpoints (migration guides, etc.)

### Package Dependencies
- **`package.json`** and **`soft-speak-flow/package.json`**
  - `lovable-tagger` package (dev dependency)

- **`soft-speak-flow/vite.config.ts`** (Line 4)
  - Imports `lovable-tagger` componentTagger

---

## 2. 🔧 Supabase Edge Functions

### Entire Directory Still Exists
**Location:** `soft-speak-flow/supabase/functions/`

**69+ Edge Functions Present:**
- `_shared/` (shared utilities)
- `apple-native-auth/` (empty directory)
- `apple-webhook/`
- `batch-generate-lessons/`
- `calculate-cosmic-profile/`
- `check-apple-subscription/`
- `check-task-reminders/`
- `create-influencer-code/`
- `daily-lesson-scheduler/`
- `delete-user/`
- `delete-user-account/`
- `deliver-adaptive-pushes/`
- `deliver-scheduled-notifications/`
- `dispatch-daily-pushes/`
- `dispatch-daily-pushes-native/`
- `dispatch-daily-quote-pushes/`
- `generate-activity-comment/`
- `generate-adaptive-push/`
- `generate-check-in-response/`
- `generate-companion-evolution/`
- `generate-companion-image/`
- `generate-companion-story/`
- `generate-complete-pep-talk/`
- `generate-cosmic-deep-dive/`
- `generate-cosmic-postcard/`
- `generate-cosmic-postcard-test/`
- `generate-daily-horoscope/`
- `generate-daily-mentor-pep-talks/`
- `generate-daily-missions/`
- `generate-daily-quotes/`
- `generate-evolution-card/`
- `generate-evolution-voice/`
- `generate-full-mentor-audio/`
- `generate-guild-story/`
- `generate-inspire-quote/`
- `generate-lesson/`
- `generate-mentor-audio/`
- `generate-mentor-content/`
- `generate-mentor-script/`
- `generate-mood-push/`
- `generate-neglected-companion-image/`
- `generate-proactive-nudges/`
- `generate-quote-image/`
- `generate-quotes/`
- `generate-reflection-reply/`
- `generate-sample-card/`
- `generate-smart-notifications/`
- `generate-tutorial-tts/`
- `generate-weekly-challenges/`
- `generate-weekly-insights/`
- `generate-zodiac-images/`
- `get-single-quote/`
- `google-native-auth/` (empty directory)
- `mentor-chat/`
- `process-daily-decay/`
- `process-paypal-payout/`
- `process-referral/`
- `record-subscription/`
- `request-referral-payout/`
- `reset-companion/`
- `resolve-streak-freeze/`
- `schedule-adaptive-pushes/`
- `schedule-daily-mentor-pushes/`
- `schedule-daily-quote-pushes/`
- `seed-real-quotes/`
- `seed-real-quotes-by-selection/`
- `send-apns-notification/`
- `send-shout-notification/`
- `sync-daily-pep-talk-transcript/`
- `transcribe-audio/`
- `trigger-adaptive-event/`
- `verify-apple-receipt/`

### Function-to-Function Invocations
These functions call other Supabase functions via `supabase.functions.invoke()`:

1. **`trigger-adaptive-event/index.ts`** (Line 171)
   - Calls `generate-adaptive-push`

2. **`send-shout-notification/index.ts`** (Line 159)
   - Calls `send-apns-notification`

3. **`schedule-adaptive-pushes/index.ts`** (Line 144)
   - Calls `generate-adaptive-push`

4. **`process-daily-decay/index.ts`** (Line 128)
   - Calls `generate-neglected-companion-image`

5. **`generate-daily-mentor-pep-talks/index.ts`** (Line 125)
   - Calls another function

6. **`dispatch-daily-quote-pushes/index.ts`**
   - Function invocations present

---

## 3. 🔐 Supabase RLS Policies

### Migration Files with RLS Policies
**Location:** `soft-speak-flow/supabase/migrations/`

**148 SQL migration files** contain RLS policy definitions:

Key files:
- `20251211161338_b2501cca-e3ec-4372-94fc-8ccaf63bd627.sql` - Referral codes RLS
- `20251211154427_1b32a82d-143f-4573-9e4d-b8b6e1de45e0.sql` - Profiles RLS fix
- `20251211084106_add_missing_table_migrations.sql` - Multiple table RLS policies
- `20251211084105_add_evolution_cards_storage_bucket.sql` - Storage bucket policies
- `20251210204351_c2d8289c-f097-42e5-963d-d04bec2715c8.sql` - Mentors RLS
- `20251210202954_e4645e4f-27b5-45b2-aaec-53166900ca34.sql` - Profiles RLS
- `20251210202805_24187b4f-528e-42a3-80ef-ff3bb33e6413.sql` - Mentors RLS
- `20251210202335_eb7ce260-068d-4e77-a408-3ef44908497f.sql` - Profiles RLS
- `20251210201456_92a0b8dc-789b-452c-8fc8-dfc032899d55.sql` - Firebase auth RLS fix
- `20251210194522_be58d44b-93f4-4b75-b628-da560908288e.sql` - Firebase auth RLS fix
- `20250115000005_simple_fix_mentors.sql` - Mentors RLS
- `20250115000004_restore_simple_view_all.sql` - Profiles RLS
- `20250115000003_fix_mentors_rls.sql` - Mentors RLS
- `20250115000002_fix_firebase_auth_rls_final.sql` - Firebase auth RLS
- And 134+ more migration files...

### Code References to RLS
- **`src/hooks/useCompanion.ts`** (Line 410)
  - Comment: "Client-side insert removed due to RLS policy restrictions"

- **`src/components/HabitCard.tsx`** (Line 59)
  - Comment: "Explicit user_id check for defense-in-depth (RLS also enforces this)"

---

## 4. 📦 Supabase Client Imports

### Edge Functions Using Supabase Client
**Location:** `soft-speak-flow/supabase/functions/`

All 69+ edge functions import from `@supabase/supabase-js`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

### Migration Scripts
**Location:** `scripts/`

1. **`migrate-profiles-to-firestore.ts`** (Line 6)
   - Imports `@supabase/supabase-js`

2. **`migrate-mentors-to-firestore.ts`** (Line 11)
   - Imports `@supabase/supabase-js`

3. **`migrate-data-to-firestore.js`** (Line 15)
   - Imports `@supabase/supabase-js`

4. **`export-mentors-json.ts`** (Line 7)
   - Imports `@supabase/supabase-js`

5. **`backup-storage.ts`** (Line 11)
   - Imports `@supabase/supabase-js`

### Build Configuration
**Location:** `soft-speak-flow/vite.config.ts`

- **Line 90:** Supabase vendor chunk configuration
- **Line 153:** Optimize deps includes `@supabase/supabase-js`
- **Line 63:** Service worker cache pattern for `*.supabase.co`

### RPC Calls
**Location:** `soft-speak-flow/supabase/functions/`

1. **`delete-user/index.ts`** (Line 88)
   - Calls `supabase.rpc("delete_user_account")`

2. **`delete-user-account/index.ts`** (Line 93)
   - Calls `supabase.rpc("delete_user_account")`

---

## 5. 🗄️ Old Migrations

### Migration Files
**Location:** `soft-speak-flow/supabase/migrations/`

**148 SQL migration files** present, including:

- Database schema definitions
- RLS policy creations
- Function definitions (`CREATE OR REPLACE FUNCTION`)
- Trigger definitions
- Index creations
- Data migrations

**Key Migration Patterns:**
- `CREATE OR REPLACE FUNCTION` - 149+ instances
- `CREATE POLICY` / `DROP POLICY` - 1,437+ instances
- `ENABLE ROW LEVEL SECURITY` - Multiple instances
- Table creations, alterations, etc.

---

## 6. 🌐 Vercel/Lovable Hosting Paths

### Documentation References
**Location:** `docs/` and `soft-speak-flow/docs/`

1. **`VAPID_SETUP.md`** (Line 73)
   - Mentions Vercel as hosting platform

2. **`FRONTEND_ENV_SETUP.md`** (Line 30-31)
   - Vercel environment variable setup instructions

3. **`FINAL_SETUP_COMPLETE.md`** (Line 37)
   - Vercel project settings reference

### Configuration
- **`soft-speak-flow/capacitor.config.ts`** (Line 10)
  - Commented Lovable project URL

---

## 7. 🔑 Environment Variable References

### Supabase Environment Variables
Found **456+ references** to Supabase env vars:

**In Scripts:**
- `VITE_SUPABASE_URL` - Used in migration scripts
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Used in migration scripts
- `SUPABASE_URL` - Used in backup scripts
- `SUPABASE_SERVICE_ROLE_KEY` - Used in migration/backup scripts
- `SUPABASE_ANON_KEY` - Referenced in docs

**In Documentation:**
- Multiple markdown files reference Supabase env vars
- Setup guides mention Supabase configuration

**In Edge Functions:**
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_ANON_KEY` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Manual setup required

**Lovable Environment Variables:**
- `LOVABLE_API_KEY` - Used in 30+ edge functions

---

## 8. 📝 Additional Residue

### Package Dependencies
- **`lovable-tagger`** - Dev dependency in both `package.json` files
- **`@supabase/supabase-js`** - Not in main package.json (good!), but referenced in:
  - Vite config optimization
  - Migration scripts
  - All edge functions

### Archive Directory
**Location:** `archive/supabase-functions-20251211-142222/`

- Contains archived edge functions (80 files)
- Still has Lovable endpoint references
- Should be safe to delete if migration is complete

### Documentation Files
Many markdown files reference old architecture:
- Migration guides
- Setup instructions
- Status reports
- Audit reports

---

## 🎯 Recommended Actions

### High Priority (Active Code)
1. **Remove or migrate all Supabase Edge Functions**
   - Entire `soft-speak-flow/supabase/functions/` directory
   - 69+ functions still present and active

2. **Remove Lovable endpoint calls**
   - Replace with Firebase Cloud Functions
   - Remove `LOVABLE_API_KEY` usage

3. **Clean up Supabase client imports**
   - Remove from edge functions (if deleting them)
   - Keep in migration scripts if still needed

### Medium Priority (Configuration)
4. **Update Vite configuration**
   - Remove Supabase vendor chunk (line 90)
   - Remove from optimizeDeps (line 153)
   - Update service worker cache patterns (line 63)

5. **Remove Lovable package**
   - Remove `lovable-tagger` from package.json
   - Remove from vite.config.ts

6. **Clean up CORS configuration**
   - Remove `.lovableproject.com` and `.lovable.dev` from allowed origins

### Low Priority (Documentation/Archives)
7. **Archive or remove migration files**
   - 148 SQL migration files in `supabase/migrations/`
   - Consider archiving if no longer needed

8. **Update documentation**
   - Remove references to Lovable/Vercel/Supabase
   - Update setup guides

9. **Clean up environment variable docs**
   - Remove Supabase env var references from active docs
   - Keep in migration-specific docs if needed

10. **Remove archive directory**
    - `archive/supabase-functions-20251211-142222/` can be deleted

---

## 📋 File Inventory

### Files Requiring Action

#### Active Code (Must Fix)
- `soft-speak-flow/supabase/functions/**/*.ts` - 69+ files
- `soft-speak-flow/supabase/functions/_shared/cors.ts`
- `soft-speak-flow/vite.config.ts`
- `package.json` (lovable-tagger)
- `soft-speak-flow/package.json` (lovable-tagger)

#### Configuration
- `soft-speak-flow/capacitor.config.ts`
- `soft-speak-flow/README.md`

#### Scripts (May Keep for Migration)
- `scripts/migrate-*.ts`
- `scripts/export-*.ts`
- `scripts/backup-storage.ts`

#### Documentation (Update/Archive)
- `docs/**/*.md` - Multiple files
- `soft-speak-flow/docs/**/*.md` - Multiple files
- Various markdown files in root

#### Archives (Can Delete)
- `archive/supabase-functions-20251211-142222/`

#### Migrations (Archive/Remove)
- `soft-speak-flow/supabase/migrations/*.sql` - 148 files

---

## ✅ Verification Checklist

After cleanup, verify:
- [ ] No `ai.gateway.lovable.dev` endpoints in active code
- [ ] No `supabase.functions.invoke()` calls in source code
- [ ] No `@supabase/supabase-js` imports in active source (only migration scripts)
- [ ] No `LOVABLE_API_KEY` usage in active code
- [ ] `supabase/functions/` directory removed or archived
- [ ] Vite config cleaned of Supabase references
- [ ] Package.json cleaned of Lovable dependencies
- [ ] CORS config cleaned of Lovable domains
- [ ] Environment variable docs updated

---

**End of Report**

