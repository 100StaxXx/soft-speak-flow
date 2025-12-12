# Supabase to Firebase Migration Plan

## Overview

This document outlines the plan to migrate all Supabase functionality to Firebase (Firestore + Cloud Functions) and remove all Supabase dependencies.

## Current State

### Frontend Supabase Usage

**Broken/Dead Code:**
1. `src/components/library/LibraryContent.tsx:49` - Uses `supabase.from("quotes")` but `supabase` is not imported (BROKEN)
2. `src/components/HabitCard.tsx:60` - Uses `supabase.from('habits').update()` but `supabase` is not imported (BROKEN)

**Status:** Both are already broken and need immediate fixing.

### Backend Supabase Usage

**Supabase Edge Functions** (in `supabase/functions/`):
- 78 Edge Functions that need to be migrated to Firebase Cloud Functions
- These handle AI generation, notifications, scheduling, subscriptions, etc.

**Supabase Database Tables:**
- 30+ tables that need to be migrated to Firestore collections
- Currently used by Edge Functions for data storage

## Migration Strategy

### Phase 1: Fix Broken Frontend Code (IMMEDIATE)

**Priority:** 🔴 CRITICAL

1. Fix `LibraryContent.tsx` - Convert Supabase query to Firestore
2. Fix `HabitCard.tsx` - Convert Supabase update to Firestore

### Phase 2: Migrate Data from Supabase to Firestore

**Priority:** 🟡 HIGH

Create migration scripts to copy data from Supabase tables to Firestore collections:

1. **Profiles** - Already in Firestore, verify sync
2. **User Companion** - Already in Firestore, verify sync
3. **Daily Tasks** - Migrate from Supabase to Firestore
4. **Habits** - Migrate from Supabase to Firestore
5. **Epics** - Already in Firestore, verify sync
6. **Activity Feed** - Already in Firestore, verify sync
7. **Quotes** - Migrate if exists in Supabase
8. **Pep Talks** - Migrate if exists in Supabase
9. **Daily Pep Talks** - Migrate if exists in Supabase
10. All other tables → Firestore collections

### Phase 3: Migrate Edge Functions to Cloud Functions

**Priority:** 🟡 HIGH

Convert Supabase Edge Functions to Firebase Cloud Functions:

1. **Authentication Functions:**
   - `delete-user-account` → Firebase Cloud Function
   - `create-influencer-code` → Firebase Cloud Function

2. **AI Generation Functions:**
   - All `generate-*` functions → Firebase Cloud Functions
   - Update frontend calls to use Firebase functions

3. **Notification Functions:**
   - `deliver-adaptive-pushes` → Firebase Cloud Function
   - `deliver-scheduled-notifications` → Firebase Cloud Function
   - `dispatch-daily-pushes` → Firebase Cloud Function
   - All push notification functions

4. **Scheduling Functions:**
   - `schedule-adaptive-pushes` → Firebase Cloud Function (Firebase Scheduler)
   - `schedule-daily-mentor-pushes` → Firebase Cloud Function (Firebase Scheduler)
   - All cron-like functions → Firebase Cloud Scheduler

5. **Subscription/Payment Functions:**
   - `record-subscription` → Firebase Cloud Function
   - `process-paypal-payout` → Firebase Cloud Function
   - `verify-apple-receipt` → Firebase Cloud Function
   - `check-apple-subscription` → Firebase Cloud Function
   - `apple-webhook` → Firebase Cloud Function

6. **Data Processing Functions:**
   - `process-daily-decay` → Firebase Cloud Function
   - `process-referral` → Firebase Cloud Function
   - `trigger-adaptive-event` → Firebase Cloud Function

### Phase 4: Remove Supabase Dependencies

**Priority:** 🟢 MEDIUM

1. Remove `supabase/` directory
2. Remove Supabase config files
3. Remove Supabase migrations (or convert to Firestore migration scripts)
4. Remove any remaining Supabase imports
5. Update documentation

### Phase 5: Cleanup

**Priority:** 🟢 LOW

1. Remove unused Supabase types/interfaces
2. Clean up environment variables
3. Update CI/CD pipelines
4. Remove Supabase from deployment configs

## Migration Steps

### Step 1: Fix Broken Frontend Code

#### Fix `LibraryContent.tsx`

**Current (Broken):**
```typescript
const { data } = await supabase
  .from("quotes")
  .select("id, text, author")
  .order("created_at", { ascending: false })
  .limit(4);
```

**Fixed (Firestore):**
```typescript
const quotes = await getDocuments("quotes", undefined, "created_at", "desc", 4);
const data = quotes.map(q => ({
  id: q.id,
  text: q.text,
  author: q.author
}));
```

#### Fix `HabitCard.tsx`

**Current (Broken):**
```typescript
const { error } = await supabase
  .from('habits')
  .update({ is_active: false })
  .eq('id', id)
  .eq('user_id', user.id);
```

**Fixed (Firestore):**
```typescript
await updateDocument("habits", id, { is_active: false });
```

### Step 2: Data Migration Scripts

Create scripts to migrate data from Supabase to Firestore for each collection.

### Step 3: Function Migration

For each Supabase Edge Function:
1. Create equivalent Firebase Cloud Function
2. Update to use Firestore instead of Supabase client
3. Update frontend calls to use new Firebase function
4. Test thoroughly
5. Remove old Edge Function

### Step 4: Testing

1. Test all migrated functions
2. Verify data integrity
3. Test all frontend features
4. Performance testing

## Timeline Estimate

- **Phase 1 (Fix Broken Code):** 1-2 hours
- **Phase 2 (Data Migration):** 1-2 days
- **Phase 3 (Function Migration):** 2-4 weeks
- **Phase 4 (Cleanup):** 1-2 days
- **Phase 5 (Final Cleanup):** 1 day

**Total:** ~3-5 weeks

## Risks & Considerations

1. **Data Loss Risk:** Ensure all data is backed up before migration
2. **Downtime:** Plan for minimal downtime during migration
3. **Testing:** Extensive testing required for each migrated function
4. **Rollback Plan:** Keep Supabase infrastructure until migration is verified

## Success Criteria

- ✅ No Supabase references in frontend code
- ✅ All Supabase Edge Functions migrated to Firebase Cloud Functions
- ✅ All data migrated to Firestore
- ✅ All tests passing
- ✅ No broken functionality
- ✅ Supabase infrastructure can be safely removed

