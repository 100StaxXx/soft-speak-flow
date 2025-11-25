# Quick Fix Guide - Top 10 Priority Actions

> **Last Updated:** 2025-11-25  
> **Full Report:** See `PRODUCTION_READINESS_AUDIT.md`

## 🚨 P0 - Critical (Fix Before Production) - ~5 hours total

### 1. Environment Variable Validation (5 min)
**File:** `src/integrations/supabase/client.ts`

```typescript
// Add after line 6, before createClient call:
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing required environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY'
  );
}
```

---

### 2. Fix Empty Catch Blocks (30 min)

#### File: `src/hooks/useCompanion.ts:187-189`
```typescript
// BEFORE:
generateStageZeroCard().catch(() => {
  // prevent unhandled rejection logging
});

// AFTER:
generateStageZeroCard().catch((error) => {
  logger.error('Failed to generate stage 0 card (non-critical):', error);
});
```

#### File: `src/hooks/useCompanion.ts:229-231`
```typescript
// BEFORE:
generateStoryWithRetry().catch(() => {
  // Final catch to prevent unhandled rejection
});

// AFTER:
generateStoryWithRetry().catch((error) => {
  logger.error('Failed to generate story (non-critical):', error);
});
```

#### File: `src/pages/Index.tsx:112-114`
```typescript
// BEFORE:
fetchMentorData().catch(error => {
  console.error('Unhandled error in fetchMentorData:', error);
});

// AFTER:
fetchMentorData().catch(error => {
  logger.error('Failed to fetch mentor data:', error);
  setMentorImage(mentorImages['darius']); // Fallback
});
```

#### File: `src/pages/Tasks.tsx:406-429`
```typescript
// Add proper error handling inside the promise chain
// Replace .then() with async/await and add try-catch
```

---

### 3. Add Null Guards for Non-Null Assertions (2 hours)

**Pattern to fix:** Any code using `user!.id` without checking if `user` exists first.

#### File: `src/hooks/useDailyTasks.ts:41`
```typescript
// BEFORE:
queryFn: async () => {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', user!.id) // ❌ Unsafe
    // ...
}

// AFTER:
queryFn: async () => {
  if (!user?.id) {
    throw new Error('User not authenticated');
  }
  
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', user.id) // ✅ Safe
    // ...
}
```

**Apply this pattern to ALL hooks using `user!.id`:**
- `useDailyTasks.ts`
- `useEpics.ts`
- `useAchievements.ts`
- `useCompanionAttributes.ts`

---

### 4. Add useEffect Cleanup (1 hour)

#### File: `src/pages/Index.tsx:57-115`
```typescript
// BEFORE:
useEffect(() => {
  const fetchMentorData = async () => {
    // ... async operations
  };
  fetchMentorData().catch(/* ... */);
}, [profile?.selected_mentor_id]);

// AFTER:
useEffect(() => {
  let cancelled = false;
  
  const fetchMentorData = async () => {
    // ... async operations
    if (cancelled) return; // Don't update state if unmounted
    
    // ... state updates only if not cancelled
  };
  
  fetchMentorData().catch(/* ... */);
  
  return () => {
    cancelled = true; // Cleanup
  };
}, [profile?.selected_mentor_id]);
```

**Apply to:**
- `src/pages/Index.tsx` (line 57)
- `src/pages/Tasks.tsx` (line 378)

---

### 5. Fix Mutation Error Handling (1 hour)

#### File: `src/hooks/useXPRewards.ts:49-56`
```typescript
// BEFORE:
updateMindFromHabit(companion.id).catch(err => {
  console.error('Mind update failed:', err);
});
updateBodyFromActivity(companion.id).catch(err => {
  console.error('Body update failed:', err);
});

// AFTER:
try {
  await Promise.allSettled([
    updateMindFromHabit(companion.id),
    updateBodyFromActivity(companion.id)
  ]);
} catch (err) {
  logger.warn('Attribute update failed (non-critical):', err);
}
```

**Apply pattern to all similar locations in:**
- `useXPRewards.ts` (lines 49-56, 110-117)
- `useDailyTasks.ts` (lines 266-272)

---

## ⚠️ P1 - High Priority (Fix Before TestFlight) - ~15 hours total

### 6. Replace Console Statements with Logger (4 hours)

**Files to prioritize (highest console.log count):**
1. `src/pages/Onboarding.tsx` (21 instances) ⚠️
2. `src/hooks/useCompanion.ts` (17 instances)
3. `src/hooks/useXPRewards.ts` (11 instances)

**Pattern:**
```typescript
// BEFORE:
console.log('XP awarded:', xp);
console.error('Failed:', error);

// AFTER:
logger.debug('XP awarded:', xp);
logger.error('Failed:', error);
```

**Import at top of each file:**
```typescript
import { logger } from "@/utils/logger";
```

---

### 7. Fix `any` Types (3 hours)

#### Create type definitions:

**File:** `src/types/xp-events.ts` (new file)
```typescript
export interface XPEventMetadata {
  task_id?: string;
  habit_id?: string;
  mission_id?: string;
  milestone?: number;
  achievement_type?: string;
  streak?: number;
  [key: string]: string | number | boolean | undefined;
}
```

**Then replace in:** `src/hooks/useCompanion.ts:253`
```typescript
// BEFORE:
metadata?: Record<string, any>;

// AFTER:
import { XPEventMetadata } from "@/types/xp-events";
metadata?: XPEventMetadata;
```

**High priority files to fix:**
- `src/hooks/useCompanion.ts` (5 instances)
- `src/pages/Profile.tsx` (5 instances)
- `src/components/PushNotificationSettings.tsx` (4 instances)

---

### 8. Centralize Error Messages (2 hours)

**Create:** `src/utils/errorMessages.ts`
```typescript
export const USER_ERRORS = {
  INSUFFICIENT_CREDITS: "Service temporarily unavailable. Please contact support.",
  RATE_LIMITED: "Service is busy. Please wait a moment and try again.",
  NETWORK_ERROR: "Network connection lost. Please check your internet.",
  AUTH_ERROR: "Authentication failed. Please log in again.",
  COMPANION_CREATE_FAILED: "Unable to create your companion. Please try again.",
  TASK_LIMIT_REACHED: "Daily quest limit reached.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
} as const;

export function getUserFriendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  
  if (msg.includes("INSUFFICIENT_CREDITS") || msg.includes("Insufficient AI credits")) {
    return USER_ERRORS.INSUFFICIENT_CREDITS;
  }
  if (msg.includes("RATE_LIMITED") || msg.includes("AI service is currently busy")) {
    return USER_ERRORS.RATE_LIMITED;
  }
  if (msg.includes("NetworkError") || msg.includes("fetch failed")) {
    return USER_ERRORS.NETWORK_ERROR;
  }
  if (msg.includes("auth") || msg.includes("401")) {
    return USER_ERRORS.AUTH_ERROR;
  }
  
  return USER_ERRORS.UNKNOWN_ERROR;
}
```

**Then replace error handling in:**
- `src/hooks/useCompanion.ts` (lines 96-103)
- `src/hooks/useDailyMissions.ts`
- All mutation `onError` callbacks

---

### 9. Add JSDoc Comments (2 hours)

#### File: `src/hooks/useCompanion.ts:320-369`
```typescript
/**
 * Awards XP to the user's companion and triggers evolution if thresholds are met.
 * 
 * @param companionData - Current companion state
 * @param xpAmount - Amount of XP to award
 * @param eventType - Type of event triggering XP (for analytics)
 * @param metadata - Additional event metadata
 * @param currentUser - Current authenticated user
 * 
 * @returns Object containing evolution status and new XP values
 * 
 * @throws {Error} If user is not authenticated
 * @throws {Error} If database update fails
 * 
 * @remarks
 * - XP events are logged server-side via database triggers
 * - Evolution is checked against centralized thresholds
 * - Race conditions prevented by xpInProgress ref
 */
const performXPAward = async (
  companionData: Companion,
  xpAmount: number,
  eventType: string,
  metadata: XPEventMetadata,
  currentUser: typeof user
) => {
  // ... existing code
};
```

**Add JSDoc to:**
- `performXPAward` (useCompanion.ts)
- `evolveCompanion` mutation (useCompanion.ts)
- `retryWithBackoff` (utils/retry.ts)
- All complex utility functions

---

### 10. Add Query Pagination (1 hour)

#### File: `src/hooks/useEpics.ts:28`
```typescript
// BEFORE:
.eq("user_id", user.id)
.order("created_at", { ascending: false });

// AFTER:
.eq("user_id", user.id)
.order("created_at", { ascending: false })
.limit(50); // Prevent loading thousands of epics
```

**Add pagination/limits to:**
- `useEpics.ts` (epic query)
- `useAchievements.ts` (if queries exist)
- Any other large list queries

---

## 📝 Testing Checklist After Fixes

- [ ] App starts without env vars → Clear error message
- [ ] Complete task while offline → Retry logic or error
- [ ] Spam-click task completion → No duplicates
- [ ] Navigate away during async fetch → No warnings
- [ ] Check browser console → No errors/warnings
- [ ] Check Network tab → Proper retry behavior
- [ ] Log out mid-operation → Graceful handling

---

## 🔍 Files Requiring Most Attention

| File | P0 Issues | P1 Issues | LOC | Priority |
|------|-----------|-----------|-----|----------|
| `src/hooks/useCompanion.ts` | 2 | 22 | 556 | 🔴 Critical |
| `src/pages/Onboarding.tsx` | 1 | 21 | ? | 🔴 Critical |
| `src/hooks/useXPRewards.ts` | 2 | 13 | 210 | 🟠 High |
| `src/hooks/useDailyTasks.ts` | 1 | 2 | 370 | 🟠 High |
| `src/pages/Index.tsx` | 2 | 2 | 271 | 🟠 High |
| `src/pages/Tasks.tsx` | 1 | 3 | 1024 | 🟡 Medium |
| `src/integrations/supabase/client.ts` | 1 | 0 | 17 | 🔴 Critical |

---

## Estimated Time Breakdown

| Priority | Total Time | Items |
|----------|-----------|-------|
| **P0** | ~5 hours | 5 fixes |
| **P1** | ~15 hours | 5 fixes |
| **TOTAL** | **~20 hours** | **10 fixes** |

---

## Order of Operations

1. **Start here:** Environment validation (5 min)
2. **Then:** Fix empty catch blocks (30 min)
3. **Next:** Add null guards to auth code (2 hrs)
4. **Then:** useEffect cleanup (1 hr)
5. **Finally P0:** Mutation error handling (1 hr)

**After P0 complete, prioritize P1 by file:**
1. Onboarding.tsx - replace console.log (1 hr)
2. useCompanion.ts - replace console + add JSDoc (2 hrs)
3. useXPRewards.ts - fix any types + console (2 hrs)
4. Create errorMessages.ts + refactor (2 hrs)
5. Remaining files as time permits

---

## Quick Commands

```bash
# Find all console.log statements
rg "console\.(log|error|warn)" --type ts --type tsx

# Find all 'any' types
rg "\bany\b" --type ts --type tsx

# Find all non-null assertions
rg "!\." --type ts --type tsx

# Run TypeScript compiler
npm run tsc --noEmit
```

---

## Getting Help

- Full details: `PRODUCTION_READINESS_AUDIT.md`
- Questions: Check the detailed examples in the full report
- Patterns: Look at fixed examples in this guide
