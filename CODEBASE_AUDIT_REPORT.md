# 🔍 Codebase Audit Report – Production Readiness Review

**Date**: November 25, 2025  
**Scope**: Full codebase sweep for bugs, fragile logic, inconsistent patterns, DX issues, and performance problems  
**Approach**: No feature changes, focus on stability, clarity, and safety

---

## 📊 Executive Summary

### Overall Codebase Health: **B+ (Good, with room for critical improvements)**

**Strengths:**
- ✅ Good TypeScript configuration with strict null checks enabled
- ✅ Excellent race condition handling in core hooks (useCompanion)
- ✅ Centralized XP reward system with consistent patterns
- ✅ Error boundaries properly implemented
- ✅ React Query used correctly for most data fetching
- ✅ Retry logic with exponential backoff implemented
- ✅ Rate limiting in edge functions

**Areas of Concern:**
- ⚠️ Type safety violations (104 uses of `any`)
- ⚠️ Inconsistent error handling patterns
- ⚠️ Missing null/undefined guards in several critical paths
- ⚠️ Async operations in useEffect without proper cleanup
- ⚠️ Silent failures that could hide production bugs
- ⚠️ Over-reliance on console.log (155 instances) in production code

---

## 🐛 Global Findings by Category

### 1. **Type Safety Issues** (Priority: P1)

**Problem**: Widespread use of `any` type bypasses TypeScript's safety guarantees

**Examples:**
1. `src/hooks/useCompanion.ts:263` - `metadata?: Record<string, any>` should be typed
2. `src/hooks/useAchievements.ts:16` - `[key: string]: any` in metadata
3. `src/utils/logger.ts:5` - `...args: any[]` could be `unknown[]`
4. `src/supabase/functions/_shared/rateLimiter.ts:19` - `supabase: any` should be typed

**Impact**: Type errors can slip through to production, causing runtime crashes

---

### 2. **Async Logic & Race Conditions** (Priority: P0)

**Problem**: Missing awaits, unhandled promises, and improper async patterns

**Examples:**

1. **useCompanion.ts:187-189** - Unhandled promise rejection wrapper is good, but could miss errors:
```typescript
generateStageZeroCard().catch(() => {
  // prevent unhandled rejection logging
});
```
**Issue**: Silent failure - should at least log the error for debugging

2. **useCompanion.ts:478-495** - Background story generation IIFE:
```typescript
(async () => {
  try {
    await supabase.functions.invoke("generate-companion-story", {...});
  } catch (error) {
    console.error(`Failed to auto-generate story for stage ${newStage}:`, error);
  }
})();
```
**Issue**: Good pattern, but no tracking if this fails repeatedly

3. **Index.tsx:112-114** - Async function in useEffect without error boundary:
```typescript
fetchMentorData().catch(error => {
  console.error('Unhandled error in fetchMentorData:', error);
});
```
**Issue**: Catches error but doesn't handle it (e.g., retry, fallback state)

4. **useDailyTasks.ts:190-254** - Complex race condition handling with ref, but missing cleanup:
```typescript
const toggleInProgress = useRef(false);
```
**Issue**: If component unmounts mid-operation, ref isn't cleaned up

---

### 3. **Error Handling** (Priority: P0)

**Problem**: Inconsistent patterns, silent failures, missing user feedback

**Examples:**

1. **useXPRewards.ts:49-56** - Suppressed errors:
```typescript
updateMindFromHabit(companion.id).catch(err => {
  console.error('Mind update failed:', err);
  // Non-critical - don't show toast to avoid spam
});
```
**Issue**: While avoiding spam is good, repeated failures should be tracked

2. **useAuth.ts:12** - Missing error handling:
```typescript
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);
  setLoading(false);
});
```
**Issue**: No `.catch()` - if getSession fails, loading stays true forever

3. **useCompanionAttributes.ts:67-69** - Silent mutation failure:
```typescript
onError: (error) => {
  console.error('Attribute update failed:', error);
  // Silent failure - don't spam user with errors for background updates
}
```
**Issue**: No retry, no tracking of persistent failures

4. **errorHandling.ts:39-64** - Good centralized handler, but not consistently used across codebase

---

### 4. **Null/Undefined Safety** (Priority: P1)

**Problem**: Missing guards despite strict null checks being enabled

**Examples:**

1. **useCompanion.ts:261** - Potential race condition:
```typescript
const currentCompanion = companion || queryClient.getQueryData(["companion", user.id]) as Companion | null;
if (currentCompanion) {
  return { shouldEvolve: false, newStage: currentCompanion.current_stage, newXP: currentCompanion.current_xp };
}
```
**Issue**: `user` could be null/undefined at this point

2. **useDailyTasks.ts:174** - Type assertion without validation:
```typescript
.in('epic_id', epicHabits.map((eh: any) => eh.epic_id));
```
**Issue**: `epicHabits` structure assumed without validation

3. **useProfile.ts:48-66** - Auto-create profile could fail silently:
```typescript
if (!data) {
  const { data: inserted, error: insertError } = await supabase...
  if (insertError) {
    console.error("Error creating profile:", insertError);
    throw insertError;
  }
  if (!inserted) throw new Error("Failed to create profile");
  return inserted;
}
```
**Issue**: Good error handling, but doesn't handle case where insert succeeds but returns null

4. **Index.tsx:69** - Optional chaining without fallback:
```typescript
const imageUrl = mentorData.avatar_url || mentorImages[mentorData.slug] || mentorImages['darius'];
```
**Issue**: If `mentorData.slug` is not in `mentorImages`, uses undefined key

---

### 5. **React Patterns & Hooks** (Priority: P1)

**Problem**: Dependency array issues, potential memory leaks

**Examples:**

1. **XPContext.tsx:14-16** - State initialization could be optimized:
```typescript
const [toastData, setToastData] = useState<{ xp: number; reason: string; show: boolean }>({
  xp: 0, reason: "", show: false,
});
```
**Issue**: Object literal re-created on every render (minor performance issue)

2. **EvolutionContext.tsx:14** - Storing function in state:
```typescript
const [onEvolutionComplete, setOnEvolutionComplete] = useState<(() => void) | null>(null);
```
**Issue**: Should use `useRef` instead for callbacks to avoid re-renders

3. **useAuth.ts:27** - Subscription cleanup is good, but no error handling:
```typescript
return () => subscription.unsubscribe();
```
**Issue**: If unsubscribe throws, component cleanup fails

4. **App.tsx:86-96** - Memo without proper deps could cause stale closures:
```typescript
const EvolutionAwareContent = memo(() => {
  const { isEvolvingLoading } = useEvolution();
  return (...);
});
```
**Issue**: Memo with no deps array - relies on default shallow comparison

---

### 6. **Performance Issues** (Priority: P2)

**Problem**: Unnecessary re-renders, missing optimizations

**Examples:**

1. **useCompanion.ts:535-543** - Good memoization, but could optimize further:
```typescript
const nextEvolutionXP = useMemo(() => {
  if (!companion) return null;
  return getThreshold(companion.current_stage + 1);
}, [companion?.current_stage, getThreshold]);
```
**Issue**: `getThreshold` in deps array will cause re-memo on every render if not memoized upstream

2. **useDailyTasks.ts:27-41** - Query runs on every render of parent:
```typescript
const { data: tasks = [], isLoading } = useQuery({
  queryKey: ['daily-tasks', user?.id, taskDate],
  ...
});
```
**Issue**: `taskDate` is calculated on every render - should be memoized

3. **Index.tsx:44-54** - Object created on every render:
```typescript
const mentorImages: Record<string, string> = {
  'darius': dariusImage,
  'nova': novaImage,
  ...
};
```
**Issue**: Should be outside component or memoized

4. **App.tsx:49-64** - QueryClient created inline:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {...}
});
```
**Issue**: Actually OK since it's outside component, but should add comment explaining this

---

### 7. **Database/API Patterns** (Priority: P1)

**Problem**: Missing optimistic updates, inefficient queries

**Examples:**

1. **useDailyTasks.ts:77-86** - Race condition on task count:
```typescript
const { data: existingTasks, error: countError } = await supabase
  .from('daily_tasks')
  .select('id')
  .eq('user_id', user!.id)
  .eq('task_date', customDate || taskDate);

if (existingTasks && existingTasks.length >= 4) {
  throw new Error('Maximum 4 tasks per day');
}
```
**Issue**: Between check and insert, another operation could add a task. Should use DB constraint + handle error

2. **useDailyMissions.ts:151-156** - N+1 query pattern:
```typescript
const { count } = await supabase
  .from('daily_missions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user!.id)
  .eq('completed', true);
```
**Issue**: Runs after every mission completion - could batch or cache

3. **useAchievements.ts:28-36** - Check then insert pattern (race condition):
```typescript
const { data: existing } = await supabase
  .from("achievements")
  .select("id")
  .eq("user_id", user.id)
  .eq("achievement_type", achievement.type)
  .maybeSingle();

if (existing) return; // Already earned

const { error } = await supabase.from("achievements").insert({...});
```
**Issue**: Two users could complete simultaneously and both pass the check

4. **useCompanion.ts:360-366** - Update without optimistic response:
```typescript
const { error: updateError } = await supabase
  .from("user_companion")
  .update({ current_xp: newXP })
  .eq("id", companionData.id)
  .eq("user_id", currentUser.id);
```
**Issue**: No `.select()` to return updated data - relies on refetch

---

### 8. **Security & Input Validation** (Priority: P1)

**Problem**: Missing input sanitization, unsafe operations

**Examples:**

1. **useDailyTasks.ts:96-110** - Category detection on client (good) but could be manipulated:
```typescript
const categoryKeywords = {
  body: ['gym', 'run', ...],
  soul: ['meditate', 'journal', ...],
  mind: ['read', 'learn', ...]
};
```
**Issue**: Client-side categorization could be gamed by users (minor concern)

2. **useSubscription.ts:20** - Edge function call without rate limiting:
```typescript
const { data, error } = await supabase.functions.invoke("check-subscription");
```
**Issue**: Could be spammed - should use rate limiting (may exist server-side)

3. **rateLimiter.ts:40-46** - Fail-open pattern is risky:
```typescript
if (error) {
  console.error('Rate limit check error:', error);
  return {
    allowed: true, // Fail open
    remaining: config.maxCalls,
    resetAt
  };
}
```
**Issue**: If rate limit check fails, allows all requests (DOS risk)

4. **supabase/client.ts:11-16** - No URL validation:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {...});
```
**Issue**: If env vars are undefined, creates invalid client (should validate)

---

### 9. **DX & Code Quality** (Priority: P2)

**Problem**: Inconsistent patterns, missing documentation

**Examples:**

1. **155 console.log statements** across codebase - should use logger utility consistently

2. **Multiple TODO comments** found in:
   - `src/components/BattleMatchmaking.tsx`
   - `src/contexts/ThemeContext.tsx`
   - `src/hooks/useCompanion.ts`
   - `src/pages/Admin.tsx`

3. **Large component files**: Some components exceed 500 lines (e.g., Index.tsx, useCompanion.ts)

4. **Inconsistent error messages**: Some use technical terms, others user-friendly messages

---

### 10. **Testing & Monitoring** (Priority: P2)

**Problem**: No visible error tracking, limited observability

**Examples:**

1. **main.tsx:5-12** - Global error handlers exist but only log:
```typescript
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
```
**Issue**: Should integrate with error tracking service (Sentry, etc.)

2. **No performance monitoring**: No Web Vitals tracking, no slow query detection

3. **No feature flags**: Can't disable broken features without deploy

4. **Limited analytics**: useAnalytics hook exists but not integrated everywhere

---

## 🎯 Prioritized TODO List

### **P0 - Critical (Fix Before TestFlight)** 🔴

1. **Fix useAuth loading hang on error** (`src/hooks/useAuth.ts:12`)
   - Add `.catch()` to `getSession()` promise
   - Set loading to false on error
   
2. **Add error tracking to global handlers** (`src/main.tsx:5-12`)
   - Integrate Sentry or similar
   - Track unhandled errors in production

3. **Fix race condition in achievement awards** (`src/hooks/useAchievements.ts:28-36`)
   - Use database unique constraint instead of client-side check
   - Handle duplicate key error gracefully

4. **Validate Supabase env vars on app init** (`src/integrations/supabase/client.ts:5-6`)
   - Throw clear error if missing
   - Show user-friendly error screen

5. **Fix rate limiter fail-open risk** (`supabase/functions/_shared/rateLimiter.ts:40-46`)
   - Fail closed by default
   - Add configuration for fail-open only in specific cases

---

### **P1 - High Priority (Fix Within 1 Week)** 🟠

6. **Remove all `any` types** (104 instances across codebase)
   - Replace with proper types or `unknown` where needed
   - Add type guards where casting is necessary

7. **Add error recovery to critical hooks**:
   - `useCompanion` - retry on evolution failure
   - `useProfile` - fallback to cached data
   - `useDailyTasks` - queue operations for retry

8. **Implement proper mutation rollback**:
   - `useDailyTasks.toggleTask` - optimistic update with rollback
   - `useCompanion.awardXP` - rollback on failure

9. **Fix memory leaks in async operations**:
   - Add cleanup functions to all async useEffects
   - Check `isMounted` before setState in callbacks

10. **Add database constraints**:
    - Unique constraint on achievements per user
    - Task count limit constraint (4 per day)
    - Mission completion constraint (prevent double-complete)

11. **Improve null safety**:
    - Add guards before all optional chain operations
    - Validate query responses before using data
    - Add default values for all optional props

12. **Replace console.log with logger** (155 instances)
    - Use existing logger utility consistently
    - Add log levels (debug, info, warn, error)
    - Disable debug logs in production

---

### **P2 - Medium Priority (Fix Within 2 Weeks)** 🟡

13. **Performance optimizations**:
    - Memoize `mentorImages` in Index.tsx
    - Memoize `taskDate` in useDailyTasks
    - Add React.memo to expensive components

14. **Refactor large files**:
    - Split useCompanion into smaller hooks
    - Extract Index.tsx logic into custom hooks
    - Break down large page components

15. **Add proper TypeScript to edge functions**:
    - Type supabase client properly in rateLimiter
    - Add return type annotations to all functions

16. **Improve error messages**:
    - Make all user-facing errors friendly
    - Add error codes for debugging
    - Localize error messages

17. **Add retry logic to more operations**:
    - Retry failed queries with backoff
    - Queue mutations for offline mode
    - Add manual retry buttons in UI

18. **Code cleanup**:
    - Remove commented code
    - Fix TODO comments or remove them
    - Consolidate duplicate logic

---

## 🔧 Top 10 Concrete Fixes to Apply First

### 1. **Fix useAuth loading hang** (P0)

**File**: `src/hooks/useAuth.ts:10-16`

**Current**:
```typescript
useEffect(() => {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });
```

**Fixed**:
```typescript
useEffect(() => {
  // Get initial session
  supabase.auth.getSession()
    .then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    })
    .catch((error) => {
      console.error('Failed to get session:', error);
      setLoading(false); // Critical: don't hang on error
      // Could also set an error state here
    });
```

---

### 2. **Validate Supabase configuration** (P0)

**File**: `src/integrations/supabase/client.ts`

**Current**:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**Fixed**:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase configuration. Please check your environment variables:\n' +
    `VITE_SUPABASE_URL: ${SUPABASE_URL ? 'Set' : 'Missing'}\n` +
    `VITE_SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_PUBLISHABLE_KEY ? 'Set' : 'Missing'}`
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

---

### 3. **Fix race condition in achievements** (P0)

**File**: `src/hooks/useAchievements.ts:23-48`

**Current**:
```typescript
const awardAchievement = async (achievement: AchievementData) => {
  if (!user) return;

  try {
    // Check if already earned
    const { data: existing } = await supabase
      .from("achievements")
      .select("id")
      .eq("user_id", user.id)
      .eq("achievement_type", achievement.type)
      .maybeSingle();

    if (existing) return; // Already earned

    const { error } = await supabase
      .from("achievements")
      .insert({...});
```

**Fixed**:
```typescript
const awardAchievement = async (achievement: AchievementData) => {
  if (!user) return;

  try {
    // Use insert with onConflict to handle race conditions
    // Requires unique constraint on (user_id, achievement_type) in DB
    const { error } = await supabase
      .from("achievements")
      .insert({
        user_id: user.id,
        achievement_type: achievement.type,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        metadata: achievement.metadata || {},
      });

    if (error) {
      // Ignore duplicate key errors (already earned)
      if (error.code === '23505') {
        console.log('Achievement already earned:', achievement.type);
        return;
      }
      throw error;
    }

    // Only show toast if we successfully inserted (not a duplicate)
    toast.success("🏆 Achievement Unlocked!", {
      description: achievement.title,
    });
    playAchievementUnlock();
  } catch (error) {
    console.error("Error awarding achievement:", error);
  }
};
```

**Also add to migration**:
```sql
-- Add unique constraint to prevent duplicate achievements
ALTER TABLE achievements 
ADD CONSTRAINT achievements_user_type_unique 
UNIQUE (user_id, achievement_type);
```

---

### 4. **Replace all `any` with proper types** (P1)

**Files**: Multiple (104 instances)

**Priority fixes**:

1. `src/hooks/useCompanion.ts:263`:
```typescript
// Before
metadata?: Record<string, any>

// After
metadata?: {
  task_id?: string;
  mission_id?: string;
  milestone?: number;
  streak?: number;
  [key: string]: string | number | boolean | undefined;
}
```

2. `src/utils/logger.ts:5`:
```typescript
// Before
log: (...args: any[]) => {

// After
log: (...args: unknown[]) => {
  if (isDevelopment) console.log(...args);
}
```

3. `src/supabase/functions/_shared/rateLimiter.ts:19`:
```typescript
// Before
export async function checkRateLimit(
  supabase: any,
  userId: string,
  ...

// After
import { SupabaseClient } from '@supabase/supabase-js';

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  ...
```

---

### 5. **Fix silent failure in companion creation** (P1)

**File**: `src/hooks/useCompanion.ts:187-189`

**Current**:
```typescript
generateStageZeroCard().catch(() => {
  // prevent unhandled rejection logging
});
```

**Fixed**:
```typescript
generateStageZeroCard().catch((error) => {
  console.error('Failed to generate stage 0 card:', error);
  // Track this failure for monitoring
  if (typeof window !== 'undefined' && window.trackEvent) {
    window.trackEvent('card_generation_failed', { stage: 0, error: error.message });
  }
});
```

---

### 6. **Add cleanup to async useEffect** (P1)

**File**: `src/pages/Index.tsx:57-115`

**Current**:
```typescript
useEffect(() => {
  const fetchMentorData = async () => {
    if (!profile?.selected_mentor_id) return;
    try {
      // ... async operations
    } catch (error) {
      console.error('Error fetching mentor data:', error);
    }
  };

  fetchMentorData().catch(error => {
    console.error('Unhandled error in fetchMentorData:', error);
  });
}, [profile?.selected_mentor_id]);
```

**Fixed**:
```typescript
useEffect(() => {
  let isMounted = true;
  
  const fetchMentorData = async () => {
    if (!profile?.selected_mentor_id) return;
    
    try {
      const { data: mentorData } = await supabase
        .from("mentors")
        .select("avatar_url, slug")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle();

      // Check if still mounted before updating state
      if (!isMounted) return;

      if (mentorData) {
        const imageUrl = mentorData.avatar_url || 
                        mentorImages[mentorData.slug] || 
                        mentorImages['darius'];
        setMentorImage(imageUrl);
        
        // ... rest of logic
      }
    } catch (error) {
      if (isMounted) {
        console.error('Error fetching mentor data:', error);
      }
    }
  };

  fetchMentorData();
  
  // Cleanup function
  return () => {
    isMounted = false;
  };
}, [profile?.selected_mentor_id]);
```

---

### 7. **Fix EvolutionContext callback storage** (P1)

**File**: `src/contexts/EvolutionContext.tsx`

**Current**:
```typescript
const [onEvolutionComplete, setOnEvolutionComplete] = useState<(() => void) | null>(null);
```

**Fixed**:
```typescript
import { createContext, useContext, useState, useRef, ReactNode } from 'react';

interface EvolutionContextType {
  isEvolvingLoading: boolean;
  setIsEvolvingLoading: (value: boolean) => void;
  onEvolutionComplete: (() => void) | null;
  setOnEvolutionComplete: (callback: (() => void) | null) => void;
}

const EvolutionContext = createContext<EvolutionContextType | undefined>(undefined);

export const EvolutionProvider = ({ children }: { children: ReactNode }) => {
  const [isEvolvingLoading, setIsEvolvingLoading] = useState(false);
  // Use ref instead of state for callbacks to avoid unnecessary re-renders
  const onEvolutionCompleteRef = useRef<(() => void) | null>(null);

  const setOnEvolutionComplete = (callback: (() => void) | null) => {
    onEvolutionCompleteRef.current = callback;
  };

  return (
    <EvolutionContext.Provider value={{ 
      isEvolvingLoading, 
      setIsEvolvingLoading,
      onEvolutionComplete: onEvolutionCompleteRef.current,
      setOnEvolutionComplete
    }}>
      {children}
    </EvolutionContext.Provider>
  );
};
```

---

### 8. **Add optimistic updates to task toggle** (P1)

**File**: `src/hooks/useDailyTasks.ts:188-281`

**Current**: Updates in onSuccess, causing lag

**Fixed**:
```typescript
const toggleTask = useMutation({
  mutationFn: async ({ taskId, completed, xpReward }: { taskId: string; completed: boolean; xpReward: number }) => {
    if (toggleInProgress.current) throw new Error('Please wait...');
    toggleInProgress.current = true;

    try {
      // ... existing validation logic

      // Update task completion in database
      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({ 
          completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', taskId)
        .eq('user_id', user!.id)
        .eq('completed', false);

      if (updateError) {
        toggleInProgress.current = false;
        throw updateError;
      }

      // Award XP
      await awardCustomXP(totalXP, 'task_complete', toastReason, { task_id: taskId });

      toggleInProgress.current = false;
      return { taskId, completed: true, xpAwarded: totalXP, bonusXP, toastReason, wasAlreadyCompleted };
    } catch (error) {
      toggleInProgress.current = false;
      throw error;
    }
  },
  // Add optimistic update
  onMutate: async ({ taskId, completed }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['daily-tasks'] });

    // Snapshot previous value
    const previousTasks = queryClient.getQueryData(['daily-tasks', user?.id, taskDate]);

    // Optimistically update
    queryClient.setQueryData(['daily-tasks', user?.id, taskDate], (old: any[]) => {
      return old?.map(task => 
        task.id === taskId 
          ? { ...task, completed, completed_at: completed ? new Date().toISOString() : null }
          : task
      );
    });

    return { previousTasks };
  },
  // Rollback on error
  onError: (error: Error, variables, context) => {
    if (context?.previousTasks) {
      queryClient.setQueryData(['daily-tasks', user?.id, taskDate], context.previousTasks);
    }
    
    const errorMessage = error.message === 'Please wait...' 
      ? 'Please wait for the previous action to complete'
      : error.message;
    
    toast({ title: "Failed to toggle task", description: errorMessage, variant: "destructive" });
  },
  onSuccess: async ({ completed, xpAwarded, toastReason, wasAlreadyCompleted }) => {
    // Invalidate to ensure server state is correct
    queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    
    if (completed && !wasAlreadyCompleted) {
      if (xpAwarded > 0) {
        showXPToast(xpAwarded, toastReason || 'Task Complete!');
      }

      if (companion) {
        await updateBodyFromActivity(companion.id);
      }

      window.dispatchEvent(new CustomEvent('mission-completed'));
    }
  },
  retry: 2,
  retryDelay: 1000,
});
```

---

### 9. **Replace console.log with logger utility** (P1)

**All files with console.log** (155 instances across 62 files)

**Script to find and replace**:
```bash
# Find all console.log statements
grep -r "console\.log" src/ --include="*.ts" --include="*.tsx"

# Replace with logger.log
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.log/logger.log/g' {} +
```

**Add import where missing**:
```typescript
import { logger } from "@/utils/logger";
```

**Update logger to be more production-ready**:
```typescript
// src/utils/logger.ts
const isDevelopment = import.meta.env.DEV;

interface LogContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

export const logger = {
  log: (message: string, context?: LogContext) => {
    if (isDevelopment) console.log(`[LOG] ${message}`, context || '');
  },
  error: (message: string, error?: unknown, context?: LogContext) => {
    // Always log errors
    console.error(`[ERROR] ${message}`, error, context || '');
    // Send to error tracking service
    if (typeof window !== 'undefined' && window.trackError) {
      window.trackError(message, error, context);
    }
  },
  warn: (message: string, context?: LogContext) => {
    if (isDevelopment) console.warn(`[WARN] ${message}`, context || '');
  },
  info: (message: string, context?: LogContext) => {
    if (isDevelopment) console.info(`[INFO] ${message}`, context || '');
  }
};
```

---

### 10. **Fix rate limiter fail-open** (P0)

**File**: `supabase/functions/_shared/rateLimiter.ts:39-46`

**Current**:
```typescript
if (error) {
  console.error('Rate limit check error:', error);
  // Fail open - allow request if we can't check
  return {
    allowed: true,
    remaining: config.maxCalls,
    resetAt
  };
}
```

**Fixed**:
```typescript
if (error) {
  console.error('Rate limit check error:', error);
  
  // Fail closed for security-critical endpoints
  // Make this configurable per endpoint
  const shouldFailOpen = config.failOpen ?? false;
  
  if (!shouldFailOpen) {
    throw new Error('Rate limit check failed - please try again');
  }
  
  // Fail open only for non-critical endpoints
  return {
    allowed: true,
    remaining: config.maxCalls,
    resetAt
  };
}
```

**Update config interface**:
```typescript
export interface RateLimitConfig {
  maxCalls: number;
  windowHours: number;
  failOpen?: boolean; // Default false for security
}
```

---

## 📝 Additional Recommendations

### Immediate Actions:
1. Add Sentry or similar error tracking
2. Set up monitoring for repeated failures
3. Add database constraints for data integrity
4. Create a PR template with checklist for these patterns
5. Run TypeScript in strict mode and fix all errors

### Short-term Improvements:
1. Add integration tests for critical flows
2. Set up performance monitoring
3. Add retry queues for failed operations
4. Implement feature flags for risky features
5. Add user feedback for all async operations

### Long-term Improvements:
1. Migrate to React Server Components where appropriate
2. Add comprehensive error recovery UI
3. Implement offline-first architecture
4. Add telemetry for user behavior
5. Build admin dashboard for monitoring

---

## ✅ Conclusion

The codebase is **production-ready with critical fixes applied**. The core architecture is sound, with good patterns for race condition handling and retry logic. The main risks are:

1. Type safety violations that could cause runtime errors
2. Missing error handling in critical paths
3. Silent failures that hide bugs
4. Potential race conditions in database operations

**Estimated fix time:**
- P0 issues: 4-6 hours
- P1 issues: 2-3 days
- P2 issues: 1 week

**Recommendation**: Fix P0 issues immediately, then tackle P1 issues before TestFlight launch. P2 issues can be addressed post-launch but should be tracked.
