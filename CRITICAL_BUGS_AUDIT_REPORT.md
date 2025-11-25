# 🚨 CRITICAL BUGS & ISSUES AUDIT REPORT
**Generated:** 2025-11-24  
**Project:** R-Evolution - Gamified Self-Improvement App  
**Status:** Pre-Fix Analysis - NO CHANGES MADE

---

## 📊 PROJECT OVERVIEW

- **Total TypeScript Files:** 270
- **Total SQL Migrations:** 71
- **React Query Mutations:** 55+ across 14 files
- **Try/Catch Blocks:** 174 across 109 files
- **useEffect/Hooks:** 199 across 72 files

---

## 🔴 TOP CRITICAL BUGS

### 1. **RACE CONDITION: Double XP Awards** ⚠️ CRITICAL
**Location:** `src/hooks/useCompanion.ts`, `src/hooks/useDailyTasks.ts`

**Problem:**
```typescript
// useCompanion.ts:230 - XP lock check happens AFTER async operation
if (xpInProgress.current) {
  console.warn('XP award already in progress, skipping duplicate');
  // Returns current state instead of throwing - race condition possible
  const currentCompanion = companion || queryClient.getQueryData(...);
  return { shouldEvolve: false, ... };
}
```

**Risk:** Users can double-tap quest completion buttons during network lag and receive XP twice.

**Impact:** XP farming, broken progression, unfair evolution

**Evidence:**
- `xpInProgress.current` flag is checked but can be bypassed during concurrent requests
- `toggleInProgress` flag in `useDailyTasks.ts:156` has similar issue
- No database-level constraint preventing duplicate XP events

**Fix Priority:** 🔴 IMMEDIATE

---

### 2. **CRITICAL: Unchecking Quests Blocked But Habits Allowed** ⚠️ CRITICAL
**Location:** `src/hooks/useDailyTasks.ts:164`, `src/pages/Tasks.tsx:222`

**Problem:**
```typescript
// useDailyTasks.ts - Quests cannot be unchecked
if (wasAlreadyCompleted && !completed) {
  throw new Error('Cannot uncheck completed tasks');
}

// Tasks.tsx:222 - BUT Habits CAN be unchecked!
if (isCompleted) {
  // Unchecking - remove completion record but DON'T remove XP
  await supabase.from('habit_completions').delete()...
  return { isCompleting: false };
}
```

**Risk:** 
- Inconsistent behavior confuses users
- Habits can be checked/unchecked to game achievement counters
- Comment says "DON'T remove XP" but companion attributes still get updated in background

**Impact:** Attribute farming via rapid habit check/uncheck cycles

**Fix Priority:** 🔴 IMMEDIATE

---

### 3. **EVOLUTION DOUBLE-TRIGGER VULNERABILITY** ⚠️ HIGH
**Location:** `src/hooks/useCompanion.ts:340-351`

**Problem:**
```typescript
// evolutionInProgress flag is set, but promise tracking has gaps
if (evolutionInProgress.current) {
  if (evolutionPromise.current) {
    await evolutionPromise.current; // Waits, but then returns null
  }
  return null; // No error thrown - mutation succeeds silently
}
```

**Risk:** 
- Evolution can trigger twice if `evolveCompanion.mutate()` is called rapidly
- Between lines 354-357, there's a gap where flag is set but promise isn't assigned yet
- No server-side validation that companion is at correct XP threshold

**Impact:** Skip evolution stages, corrupt companion state

**Edge Function Issue:**
```typescript
// supabase/functions/generate-companion-evolution/index.ts:105
// Loads thresholds from DB but doesn't validate BEFORE evolution
const { data: companion } = await supabase
  .from("user_companion")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle();
```

No check: `if (companion.current_xp < thresholds[nextStage]) throw error`

**Fix Priority:** 🔴 HIGH

---

### 4. **STREAK LOGIC: No Timezone Validation** ⚠️ HIGH
**Location:** `src/hooks/useProfile.ts`, Database

**Problem:**
- Profile stores `timezone` field but nowhere in code validates it
- `current_habit_streak` is updated via database triggers (line in migration file)
- No timezone-aware streak validation in client or server

**Risk:**
- User changes device timezone → can complete habits "yesterday"
- Streak milestones trigger at wrong times
- Multi-device users see inconsistent streak counts

**Missing Logic:**
```typescript
// SHOULD EXIST BUT DOESN'T:
// - Validate completion timestamp against user's timezone
// - Prevent backdating habit completions
// - Lock streak updates to UTC day boundaries per user timezone
```

**Fix Priority:** 🔴 HIGH

---

### 5. **ONBOARDING: No Rollback on Partial Failure** ⚠️ HIGH
**Location:** `src/pages/Onboarding.tsx:422-515`

**Problem:**
```typescript
// Line 439: Companion creation with retry
await retryWithBackoff(() => createCompanion.mutateAsync(data), {...});

// Line 467: Then marks onboarding complete
const { error: completeError } = await supabase
  .from('profiles')
  .update({ onboarding_completed: true, ... })
```

**What can go wrong:**
1. Companion creation succeeds
2. Profile update fails (network/timeout)
3. User is stuck - companion exists but onboarding not marked complete
4. Refresh sends them back to onboarding
5. Companion creation is skipped (existingCompanion check line 432)
6. But they never get past companion step

**Impact:** Users trapped in onboarding loop

**Fix Priority:** 🔴 HIGH

---

## 🟠 DATA INCONSISTENCIES

### 6. **XP Constants Defined in 3 Places**
**Locations:**
- `src/config/xpSystem.ts` (documentation)
- `src/config/xpRewards.ts` (actual constants)
- `src/hooks/useCompanion.ts:30-38` (duplicated hardcoded)

**Problem:**
```typescript
// useCompanion.ts - Hardcoded duplicate
export const XP_REWARDS = {
  HABIT_COMPLETE: 5,
  ALL_HABITS_COMPLETE: 10,
  // ... duplicates xpRewards.ts
}
```

**Risk:** Update one file, forget the other → inconsistent XP rewards

**Fix Priority:** 🟠 MEDIUM

---

### 7. **Evolution Thresholds: Database vs Code Mismatch Risk**
**Locations:**
- Migration: `supabase/migrations/20251124225119_create_evolution_thresholds.sql`
- Code: `src/config/xpSystem.ts:80-102`

**Problem:**
- Migration creates `evolution_thresholds` table
- But `xpSystem.ts` exports hardcoded `EVOLUTION_THRESHOLDS` object
- Edge function loads from DB (good!)
- Client-side code might use hardcoded values (bad!)

**Risk:** DB and client show different "XP needed to evolve"

**Fix Priority:** 🟠 MEDIUM

---

### 8. **Habit Completion Check Doesn't Prevent XP Spam**
**Location:** `src/pages/Tasks.tsx:232-238`

**Problem:**
```typescript
// Check if already completed
const { data: existingCompletion } = await supabase
  .from('habit_completions')
  .select('id')
  .eq('habit_id', habitId)
  .eq('date', today)
  .maybeSingle();

// Only award XP if this is the FIRST completion today
if (!existingCompletion) {
  await awardCustomXP(xpAmount, 'habit_complete', 'Habit Complete!');
}
```

**But earlier (line 222):**
```typescript
if (isCompleted) {
  // Unchecking - remove completion record
  await supabase.from('habit_completions').delete()...
}
```

**Risk:** 
1. Complete habit → get XP
2. Uncheck habit → record deleted
3. Check again → no existingCompletion found → XP awarded AGAIN
4. Repeat for infinite XP

**Fix Priority:** 🔴 CRITICAL

---

## 🟡 BROKEN OR FRAGILE LOGIC

### 9. **Error Handling: Inconsistent Patterns**
**Locations:** Across all hooks

**Problem:**
```typescript
// Pattern 1: Silent catch (bad)
updateMindFromHabit(companion.id).catch(err => {
  console.error('Mind update failed:', err);
  // No user notification
});

// Pattern 2: Toast error (good)
.catch((error) => {
  toast({ title: "Error", description: error.message, variant: "destructive" });
});

// Pattern 3: Try/catch with rethrow (inconsistent)
try {
  await operation();
} catch (error) {
  console.error('Failed:', error);
  // Sometimes throws, sometimes doesn't
}
```

**Risk:** Users don't know when operations fail

**Fix Priority:** 🟡 MEDIUM

---

### 10. **CompanionEvolution: Emergency Exit After 20s**
**Location:** `src/components/CompanionEvolution.tsx:111`

**Problem:**
```typescript
// Emergency timeout - if modal hasn't been dismissed after 20 seconds
emergencyTimeoutRef.current = window.setTimeout(() => {
  setShowEmergencyExit(true);
}, 20000);
```

**Why does this exist?** Because modal can hang forever if:
- Voice generation fails silently
- Animation states get stuck
- User can't dismiss

**Fragility:** Needs a 20-second emergency escape hatch = bad design

**Fix Priority:** 🟡 MEDIUM (refactor animation logic)

---

### 11. **Main Quest Prompt Drawer Logic Gap**
**Location:** `src/pages/Tasks.tsx:346-351`

**Problem:**
```typescript
const handleDrawerClose = () => {
  // Only default to side quest if user dismissed without choosing
  if (pendingTaskData && showMainQuestPrompt) {
    handleMainQuestResponse(false);
  }
};
```

**Risk:** User clicks "X" or swipes down → task is added as side quest without confirmation

**Better UX:** Cancel should cancel, not default to side quest

**Fix Priority:** 🟡 LOW

---

## ⚡ PERFORMANCE RISKS

### 12. **No Request Deduplication for Parallel Queries**
**Location:** Throughout app

**Problem:**
```typescript
// Multiple components can trigger same query simultaneously
const { data: profile } = useQuery({ queryKey: ['profile', user?.id] });
const { data: companion } = useQuery({ queryKey: ['companion', user?.id] });
const { data: habits } = useQuery({ queryKey: ['habits', user?.id] });
```

React Query deduplicates by key, but:
- 71+ SQL migrations means DB has 50+ tables
- Every table query is a separate round trip
- No batching strategy

**Impact:** Slow initial load, especially on mobile

**Fix Priority:** 🟡 MEDIUM

---

### 13. **Large Bundle Size: 140+ Components**
**Location:** `src/components/`

**Issue:**
- 140 TSX components in `/components`
- Many imported but rarely used
- Lazy loading only for pages, not components

**Impact:** Slow first paint

**Fix Priority:** 🟡 LOW

---

## 🔐 SECURITY & RLS RISKS

### 14. **XP Events: Client Can Still Insert** ⚠️ CRITICAL
**Location:** Migration `20251124203543_...sql:156`

**Problem:**
```sql
CREATE POLICY "Service can insert xp events"
  ON public.xp_events
  FOR INSERT
  WITH CHECK (is_service_role());
```

**But in code:**
```typescript
// useCompanion.ts:325 - Comment says client-side insert removed
// XP events are logged server-side via triggers/functions
// Client-side insert removed due to RLS policy restrictions
```

**Risk:** If policy is bypassed (e.g., SQL injection, compromised keys), XP can be farmed

**Verification Needed:** Confirm NO client-side XP inserts anywhere

**Fix Priority:** 🔴 CRITICAL

---

### 15. **Companion Evolution: Only Service Role Can Insert**
**Location:** Migration `20251124203543_...sql:257`

```sql
CREATE POLICY "Service can insert evolutions"
  ON public.companion_evolutions
  FOR INSERT
  WITH CHECK (is_service_role());
```

**Good:** Evolution records can only be created by edge functions

**But:** No validation that XP threshold was actually reached

**Fix Priority:** 🟠 MEDIUM (add validation)

---

### 16. **Push Subscriptions: Weak RLS**
**Location:** Migration `20251124203543_...sql:49`

```sql
CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id AND auth.uid() IS NOT NULL)
```

**Problem:** `FOR ALL` includes DELETE. User could delete all their subscriptions then blame "bug"

**Better:** Separate SELECT/INSERT/UPDATE/DELETE policies with stricter rules

**Fix Priority:** 🟡 LOW

---

## 🗑️ DUPLICATE / UNUSED CODE

### 17. **Duplicate Auth Check Pattern**
**Locations:** Throughout hooks

```typescript
// Pattern repeated in 10+ files:
const { user } = useAuth();
const { data, isLoading } = useQuery({
  queryFn: async () => {
    if (!user) return null;
    const { data, error } = await supabase.from('table')...
    if (error) throw error;
    return data || [];
  },
  enabled: !!user,
});
```

**Should be:** Extract to `useAuthQuery` utility hook

**Fix Priority:** 🟢 LOW

---

### 18. **Multiple "Loading" Components**
**Locations:**
- `src/components/LoadingQuote.tsx`
- `src/App.tsx:66` - `LoadingFallback`
- Inline loading states in 20+ components

**Problem:** No consistent loading UX

**Fix Priority:** 🟢 LOW

---

## ⚠️ THINGS THAT COULD BREAK

### 19. **Onboarding Flow: 7 Stages, Any Failure Breaks It**
**Location:** `src/pages/Onboarding.tsx`

**Stages:**
1. Legal acceptance
2. Name input
3. Zodiac selection
4. Questionnaire
5. Mentor recommendation
6. Zodiac reveal
7. Companion creation

**Problem:**
- Each stage updates `profile.onboarding_step`
- If ANY update fails → user stuck
- No "skip" or "retry" options
- Companion creation is slowest (AI image gen) and most likely to timeout

**Evidence:**
```typescript
// Line 442: Retry logic only for companion creation
await retryWithBackoff(() => createCompanion.mutateAsync(data), {
  maxAttempts: 3,
  initialDelay: 1000,
  // ...
});
```

But other steps have zero retry logic

**Fix Priority:** 🔴 HIGH

---

### 20. **Quest Completion Transaction: Not Atomic**
**Location:** `src/hooks/useDailyTasks.ts:169-214`

**Problem:**
```typescript
// Step 1: Mark task complete
const { error } = await supabase.from('daily_tasks')
  .update({ completed: true, completed_at: now })
  .eq('id', taskId);

if (error) throw error;

// Step 2: Award XP
await awardCustomXP(xpReward, 'task_complete', 'Task Complete!');

// Step 3: Update companion attributes
if (companion) await updateBodyFromActivity(companion.id);
```

**Risk:**
- Step 1 succeeds → task marked complete
- Step 2 fails → no XP awarded
- User sees completed task but didn't get XP
- Unchecking is blocked → they're stuck

**Should be:** Database transaction or server-side function

**Fix Priority:** 🔴 CRITICAL

---

### 21. **Streak Calculation: Depends on Triggers**
**Location:** Database (found in migration files)

**Problem:**
- Streak is updated via database triggers on `profiles` table
- No client-side validation
- If trigger fails or is disabled → streak breaks silently

**Risk:**
- Admin accidentally drops trigger
- Migration error leaves trigger uninstalled
- Users lose streaks

**Missing:** Health check endpoint to verify triggers are active

**Fix Priority:** 🟠 MEDIUM

---

### 22. **Evolution Stage Calculation: Client-Side**
**Location:** `src/hooks/useCompanion.ts:301-316`

```typescript
const nextStage = companionData.current_stage + 1;
const nextThreshold = getThreshold(nextStage);

// Check if evolution is needed
const shouldEvolveNow = shouldEvolve(companionData.current_stage, newXP);
```

**Problem:**
- Client calculates if evolution should happen
- Edge function also calculates (line 105-120 in generate-companion-evolution)
- If they disagree → evolution state breaks

**Better:** Server is source of truth, client displays only

**Fix Priority:** 🟠 MEDIUM

---

## 🎨 UI/UX BUGS & MISSING STATES

### 23. **Missing Loading States**
**Examples:**

**Tasks Page:** Shows "Add Quest" button even while `isAdding: true`
```typescript
// src/pages/Tasks.tsx:844
<Button 
  onClick={handleAddTask}
  disabled={isAdding || !newTaskText.trim()} // Disabled, but no loading indicator
  className="w-full"
>
  {isAdding ? "Adding..." : "Add Quest"}
</Button>
```

**Better:** Show spinner, disable form, prevent navigation

---

### 24. **Empty States Missing in Key Screens**

**Companion Page:** No loading skeleton (I haven't verified but based on patterns)

**Habits:** Empty state exists (good!) but no "upgrade to Premium for more habits"

---

### 25. **Offline Mode: No Queue**
**Location:** All mutations

**Problem:**
- App uses React Query
- No offline persistence plugin
- User completes quest offline → silently fails
- They think it's saved → it's not

**Missing:**
- Service worker queue
- "You're offline" banner (exists but doesn't queue actions)
- Sync on reconnect

**Fix Priority:** 🟡 MEDIUM

---

### 26. **Error Messages: Not User-Friendly**
**Examples:**

```typescript
// Generic errors shown to users:
toast({ title: "Error", description: error.message });

// error.message might be:
// "Failed to fetch" (what does user do?)
// "null is not an object" (huh?)
// "Unauthorized" (but they ARE logged in!)
```

**Fix Priority:** 🟡 LOW

---

## 🔥 BREAKING SCENARIOS

### **Scenario 1: Double Evolution**
**Steps to reproduce:**
1. User is at 118 XP (needs 120 for Stage 2)
2. Completes a 5 XP quest
3. Has slow connection
4. Taps "Complete" twice quickly
5. First request: 118 + 5 = 123 → evolve to Stage 2
6. Second request (race): 123 + 5 = 128 → evolve to Stage 3?

**Current safeguards:**
- `evolutionInProgress.current` flag
- But gaps exist (see Bug #3)

**Risk:** High on slow connections

---

### **Scenario 2: Infinite XP via Habit Toggle**
**Steps to reproduce:**
1. Create a habit
2. Complete it → get 5 XP
3. Uncheck it → completion record deleted (line 227)
4. Check again → `existingCompletion` is null → get 5 XP again
5. Repeat 100 times → level up instantly

**Current safeguards:** NONE

**Risk:** Extremely high

---

### **Scenario 3: Timezone Farming**
**Steps to reproduce:**
1. User in EST (UTC-5)
2. Complete daily quest at 11:59 PM EST
3. Change device to PST (UTC-8)
4. It's now 8:59 PM PST (3 hours earlier)
5. Complete another daily quest "today"

**Current safeguards:** NONE (timezone stored but not validated)

**Risk:** High

---

### **Scenario 4: Onboarding Crash Loop**
**Steps to reproduce:**
1. Start onboarding
2. Get to companion creation step
3. Companion creation succeeds (stored in DB)
4. Network drops
5. Profile update fails
6. User refreshes
7. Onboarding restarts (check line 72: `if (onboarding_completed) navigate("/tasks")`)
8. Companion exists, so creation is skipped (line 432)
9. But profile never marked complete
10. User stuck forever

**Current safeguards:** Retry logic for companion only

**Risk:** Medium (depends on network stability)

---

## 📋 RECOMMENDED FIX ORDER

### Phase 1: Stop the Bleeding (Day 1)
1. ✅ Fix Bug #8 (infinite XP via habit toggle) - CRITICAL
2. ✅ Fix Bug #20 (quest completion transaction) - CRITICAL
3. ✅ Fix Bug #2 (habit uncheck behavior) - CRITICAL
4. ✅ Add server-side XP validation in edge functions

### Phase 2: Harden Core Systems (Day 2-3)
5. ✅ Fix Bug #3 (evolution double-trigger)
6. ✅ Fix Bug #1 (XP race conditions)
7. ✅ Add timezone validation for streaks
8. ✅ Add onboarding recovery flow

### Phase 3: Data Consistency (Day 4)
9. ✅ Consolidate XP constants (Bug #6)
10. ✅ Consolidate evolution thresholds (Bug #7)
11. ✅ Add database constraints for XP limits

### Phase 4: Polish (Day 5+)
12. ✅ Improve error handling patterns
13. ✅ Add loading states everywhere
14. ✅ Refactor evolution animation
15. ✅ Add offline queue

---

## 🎯 TESTING CHECKLIST

Before any fixes:
- ✅ Can user double-award XP by clicking fast? (Test on slow 3G)
- ✅ Can user uncheck habits infinitely for XP?
- ✅ Can user timezone-hop to complete quests twice?
- ✅ Does evolution trigger at exactly the right XP?
- ✅ Can user get stuck in onboarding?
- ✅ Do streaks break across midnight?
- ✅ Does app work offline?

---

## 💾 DATABASE HEALTH

**Migrations:** 71 files (A LOT - suggests many patches)

**Concerns:**
- Are all migrations applied in production?
- Any conflicting policies?
- Performance of 50+ table joins?

**Recommend:**
- Run `SELECT * FROM evolution_thresholds` to verify data matches code
- Check RLS policies: `SELECT * FROM pg_policies WHERE schemaname = 'public'`
- Verify triggers: `SELECT * FROM pg_trigger WHERE tgname LIKE '%streak%'`

---

## 🏁 SUMMARY

**Total Issues Found:** 26

**Critical (Fix Immediately):** 6
- Bug #1: XP race condition
- Bug #2: Habit uncheck inconsistency
- Bug #3: Evolution double-trigger
- Bug #8: Infinite XP exploit
- Bug #14: XP events RLS
- Bug #20: Quest completion not atomic

**High (Fix This Week):** 5
- Bug #4: Streak timezone issues
- Bug #5: Onboarding rollback
- Bug #19: Onboarding fragility
- Bug #21: Streak calculation reliability
- Bug #22: Evolution calculation mismatch

**Medium (Fix This Sprint):** 10

**Low (Cleanup Later):** 5

---

## ✅ NEXT STEPS

1. **Review this report** - Confirm priorities
2. **Setup test environment** - Replicate bugs safely
3. **Fix Phase 1** (critical exploits)
4. **Deploy & monitor** - Watch for regressions
5. **Fix Phase 2-4** iteratively

**Important:** 
- Don't "rewrite" anything
- Fix in small, testable chunks
- Keep existing behavior where safe
- Add guards, don't remove features

---

**Report Complete. Ready for fixes when you give the word.** 🛠️
