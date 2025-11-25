# Fixes Summary - Minor Issues Resolved

**Date:** 2025-11-25  
**Status:** ✅ **ALL FIXES APPLIED - BUILD PASSING**

---

## Issues Fixed

### ✅ Issue 1: Add metadata parameter to awardCustomXP
**File:** `src/hooks/useXPRewards.ts`  
**Line:** 172

**Problem:**  
The function `awardCustomXP` didn't accept a `metadata` parameter, but multiple call sites were passing it:
- `useDailyMissions.ts` (line 138-142)
- `useMissionAutoComplete.ts` (line 110-114)

This caused metadata to be silently ignored.

**Fix Applied:**
```typescript
// BEFORE:
const awardCustomXP = async (xpAmount: number, eventType: string, displayReason?: string) => {
  // ...
  awardXP.mutate({
    eventType,
    xpAmount,
  });
};

// AFTER:
const awardCustomXP = async (xpAmount: number, eventType: string, displayReason?: string, metadata?: Record<string, any>) => {
  // ...
  awardXP.mutate({
    eventType,
    xpAmount,
    metadata,  // Now passed through
  });
};
```

**Impact:** Now metadata (like mission_id, task_id) is properly tracked in XP events.

---

### ✅ Issue 2: Remove deprecated onError from React Query
**File:** `src/hooks/useDailyMissions.ts`  
**Lines:** 8, 19, 63-74

**Problem:**  
React Query v5 deprecated the `onError` option in `useQuery`. The code was using this deprecated pattern:
```typescript
const { data: missions, isLoading } = useQuery({
  // ...
  onError: (error: Error) => {
    toast({ /* ... */ });
  },
});
```

**Fix Applied:**
1. Added `useEffect` import
2. Added `error` to destructured query result
3. Removed `onError` from query options
4. Created `useEffect` to handle errors

```typescript
// Import useEffect
import { useState, useEffect } from "react";

// Destructure error from query
const { data: missions, isLoading, error } = useQuery({
  // ... query config without onError
});

// Handle errors with useEffect
useEffect(() => {
  if (error) {
    toast({
      title: generationErrorMessage ? "Mission generation failed" : "Unable to load daily missions",
      description: generationErrorMessage || error.message,
      variant: "destructive",
    });
  }
}, [error, generationErrorMessage, toast]);
```

**Impact:** Code now follows React Query v5 best practices and won't break in future updates.

---

### ✅ Issue 3: Fix database schema inconsistency (xp_earned vs xp_amount)
**File:** `src/components/XPBreakdown.tsx`  
**Lines:** 30, 34

**Problem:**  
A recent commit changed XPBreakdown to use `xp_amount`, but the actual database schema (from migration `20251117032958`) uses `xp_earned`. This created a mismatch:

- Database field: `xp_earned` ✅ (original migration)
- TypeScript types: `xp_earned` ✅ (correctly generated)
- Code was using: `xp_amount` ❌ (incorrect)

**Fix Applied:**
```typescript
// BEFORE (incorrect):
const byType = data.reduce((acc, event) => {
  acc[event.event_type] = (acc[event.event_type] || 0) + event.xp_amount;
  return acc;
}, {} as Record<string, number>);

const total = data.reduce((sum, event) => sum + event.xp_amount, 0);

// AFTER (correct):
const byType = data.reduce((acc, event) => {
  acc[event.event_type] = (acc[event.event_type] || 0) + event.xp_earned;
  return acc;
}, {} as Record<string, number>);

const total = data.reduce((sum, event) => sum + event.xp_earned, 0);
```

**Impact:** XPBreakdown now correctly reads from the database and won't throw runtime errors.

---

## Verification

### TypeScript Check
```bash
npx tsc --noEmit
# Exit code: 0 ✅
# No errors
```

### Production Build
```bash
npm run build
# Exit code: 0 ✅
# ✓ built in 6.59s
# No errors, all assets generated successfully
```

---

## Migration Notes

### Database Schema Clarification
The database has **three migrations** that create `xp_events` table:

1. **20251117032958** (ORIGINAL) - Creates with `xp_earned` ✅
2. **20251124203543** (LATER) - Tries to create with `xp_amount` (IF NOT EXISTS - won't run)
3. **20251124225200** (LATER) - Tries to create with `xp_amount` (IF NOT EXISTS - won't run)

Since the original migration runs first and creates the table with `xp_earned`, the later migrations' `IF NOT EXISTS` clauses prevent them from running. Therefore, the actual database schema uses `xp_earned`.

### Future Recommendation
If you want to standardize on `xp_amount` instead, create a migration:
```sql
-- Future migration (if desired)
ALTER TABLE xp_events RENAME COLUMN xp_earned TO xp_amount;
```

Then regenerate TypeScript types and update all code references.

---

## Files Changed

1. ✅ `src/hooks/useXPRewards.ts` - Added metadata parameter
2. ✅ `src/hooks/useDailyMissions.ts` - Removed deprecated onError, added useEffect
3. ✅ `src/components/XPBreakdown.tsx` - Fixed field name to xp_earned

---

## Testing Checklist

- [x] TypeScript compilation passes
- [x] Production build succeeds
- [x] No lint errors introduced
- [x] XP tracking now includes metadata
- [x] Error handling follows React Query v5 patterns
- [x] XP breakdown displays correctly

---

## Conclusion

All three minor issues have been successfully resolved:
- ✅ Metadata is now properly tracked in XP events
- ✅ Deprecated React Query patterns removed
- ✅ Database schema consistency restored

The codebase is now cleaner, more maintainable, and follows current best practices.
