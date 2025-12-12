# Mini Games Bug Report

**Date:** Generated Report  
**Severity Levels:** 🔴 Critical | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL BUGS

### Bug #1: Quest Interval Calculation Always Returns Wrong Value

**Location:** `src/hooks/useEncounterTrigger.ts:142`

**Issue:**
The quest interval calculation is mathematically incorrect. After line 137 updates `nextEncounterRef.current` to `nextEncounterValue` (which is `newTotal + getRandomInterval()`), the calculation on line 142 becomes:

```typescript
const questInterval = newTotal - ((nextEncounterRef.current ?? newTotal) - getRandomInterval());
// After line 137: nextEncounterRef.current = newTotal + getRandomInterval()
// So: questInterval = newTotal - ((newTotal + getRandomInterval()) - getRandomInterval())
//    = newTotal - newTotal
//    = 0
```

This always results in 0, which gets clamped to 2, so the quest interval is always reported as 2 regardless of actual quests completed.

**Impact:**
- Quest interval scaling in mini games will always use the minimum value
- Game difficulty adjustments based on quest frequency are broken
- Reports incorrect data about player activity patterns

**Fix:**
The quest interval should be calculated BEFORE updating `nextEncounterRef.current`, or stored separately. The correct calculation should track the previous encounter threshold:

```typescript
if (shouldTrigger) {
  // Calculate interval BEFORE updating ref
  const previousThreshold = (nextEncounterRef.current ?? newTotal) - getRandomInterval();
  const questInterval = newTotal - previousThreshold;
  
  // Now update ref
  nextEncounterRef.current = nextEncounterValue;
  
  return { 
    shouldTrigger: true, 
    triggerType: 'quest_milestone',
    questInterval: Math.min(Math.max(questInterval, 2), 4),
  };
}
```

**Better Fix:**
Store the previous encounter threshold separately to make the calculation clearer:

```typescript
// Calculate interval using stored previous threshold
const previousThreshold = (nextEncounterRef.current ?? (newTotal - getRandomInterval()));
const questInterval = newTotal - previousThreshold;

// Update for next time
nextEncounterRef.current = nextEncounterValue;
```

---

### Bug #2: Epic Progress Checkpoint Triggers on Every Progress Change

**Location:** `src/components/EpicCard.tsx:153-165`

**Issue:**
The condition `encounterCheckRef.current !== currentProgress && currentProgress > 0` will trigger an encounter event on EVERY progress change, not just when milestones (25%, 50%, 75%, 100%) are crossed.

**Current Logic:**
```typescript
if (encounterCheckRef.current !== currentProgress && currentProgress > 0) {
  const prevCheck = encounterCheckRef.current < 0 ? 0 : encounterCheckRef.current;
  encounterCheckRef.current = currentProgress;
  window.dispatchEvent(/* ... */);
}
```

If progress goes from 23% → 24% → 25%, this will fire 3 times instead of just when crossing 25%.

**Impact:**
- Multiple encounter triggers for a single epic milestone
- Potential duplicate encounters
- Wasted resources and confusing UX
- Could trigger encounters for non-milestone progress (e.g., 1% → 2%)

**Fix:**
Use the same milestone detection logic as `checkEpicCheckpoint`:

```typescript
// Dispatch event for Astral Encounter trigger on epic milestone crossings
const milestones = [25, 50, 75, 100];
const prevCheck = encounterCheckRef.current < 0 ? 0 : encounterCheckRef.current;

// Find if we crossed a milestone
const crossedMilestone = milestones.find(
  m => prevCheck < m && currentProgress >= m
);

if (crossedMilestone) {
  encounterCheckRef.current = currentProgress;
  window.dispatchEvent(
    new CustomEvent('epic-progress-checkpoint', {
      detail: {
        epicId: epic.id,
        previousProgress: prevCheck,
        currentProgress,
      },
    })
  );
} else if (currentProgress !== encounterCheckRef.current) {
  // Update ref even if no milestone crossed (for accurate next comparison)
  encounterCheckRef.current = currentProgress;
}
```

**Note:** The `checkEpicCheckpoint` function already handles milestone detection correctly, but this component should not dispatch events for non-milestone progress changes.

---

## 🟡 MEDIUM BUGS

### Bug #3: Dependency Array Uses Wrong Property Name

**Location:** `src/hooks/useEncounterTrigger.ts:151`

**Issue:**
The `checkQuestMilestone` callback dependency array uses `user?.id` but the hook uses `user?.uid` everywhere else (lines 70, 76, 93, 106, 125, etc.).

```typescript
}, [user?.id, ensureEncountersEnabled]);
// Should be: }, [user?.uid, ensureEncountersEnabled]);
```

**Impact:**
- Callback may not update when user changes
- Potential stale closure issues
- Inconsistent with rest of codebase

**Fix:**
Change to `user?.uid` to match the rest of the codebase.

---

### Bug #4: Stale Closure Risk in Mini Game Completion Handler

**Location:** `src/components/astral-encounters/AstralEncounterModal.tsx:81-111`

**Issue:**
The `handleMiniGameComplete` callback includes `phaseResults` in the dependency array, but the function creates a new array from it. This could cause stale state if multiple phase completions happen quickly.

```typescript
const handleMiniGameComplete = useCallback((result: MiniGameResult) => {
  const newResults = [...phaseResults, result]; // Uses phaseResults from closure
  setPhaseResults(newResults);
  // ... rest of logic uses newResults
}, [adversary, encounter, currentPhaseIndex, phaseResults, onComplete]);
```

**Impact:**
- If multiple phases complete rapidly (unlikely but possible), could use stale `phaseResults`
- Race condition between setState and callback execution

**Better Pattern:**
Use functional setState to avoid stale closure:

```typescript
const handleMiniGameComplete = useCallback((result: MiniGameResult) => {
  setPhaseResults(prevResults => {
    const newResults = [...prevResults, result];
    
    // Calculate if all phases done
    if (adversary && currentPhaseIndex < adversary.phases - 1) {
      // Not done yet, phaseResults will be used in next callback
      return newResults;
    } else {
      // All phases complete, calculate final result
      const totalAccuracy = Math.round(
        newResults.reduce((sum, r) => sum + r.accuracy, 0) / newResults.length
      );
      // ... rest of completion logic
      return newResults;
    }
  });
}, [adversary, encounter, currentPhaseIndex, onComplete]);
```

Or restructure to handle completion in a separate effect that watches `phaseResults`.

---

### Bug #5: No Atomic Quest Count Increment

**Location:** `src/hooks/useEncounterTrigger.ts:112-128`

**Issue:**
Quest count is incremented locally, then updated to database. If multiple quests complete simultaneously (e.g., from auto-complete or rapid clicking), counts could be lost.

**Current Flow:**
1. Read current count from ref or DB
2. Increment locally: `questCountRef.current += 1`
3. Update database: `updateDocument('profiles', user.uid, { total_quests_completed: newTotal })`

If two quests complete at the same time:
- Both read count = 5
- Both increment to 6 locally
- Both write 6 to DB
- Final count = 6 (should be 7)

**Impact:**
- Lost quest count increments in race conditions
- Encounters may trigger too early or late
- Incorrect tracking of player progress

**Mitigation:**
The database should use atomic increment. However, since this is client-side JavaScript with Firestore, we'd need to use a transaction or use Firestore's `increment()` function:

```typescript
import { increment } from 'firebase/firestore';

await updateDocument('profiles', user.uid, {
  total_quests_completed: increment(1),
  // Also update next_encounter_quest_count atomically
});
```

**Alternative:** Use a Firestore transaction to ensure atomicity, though this requires server-side function or careful client-side transaction handling.

---

### Bug #6: Pending Encounter Check Fetches All Encounters

**Location:** `src/hooks/useAstralEncounters.ts:293-300`

**Issue:**
The code fetches ALL encounters for a user, then filters in-memory for incomplete ones:

```typescript
const pendingEncounters = await getDocuments(
  'astral_encounters',
  [['user_id', '==', user.uid]],
  // No filter for completed_at
);

const pendingEncounter = pendingEncounters.find(e => !e.completed_at);
```

**Impact:**
- Inefficient: fetches all historical encounters when only need incomplete ones
- Performance degrades as user accumulates encounters
- Unnecessary bandwidth and processing

**Fix:**
Add a filter to the query:

```typescript
const pendingEncounters = await getDocuments(
  'astral_encounters',
  [
    ['user_id', '==', user.uid],
    ['completed_at', '==', null], // Only incomplete encounters
  ]
);
```

**Note:** Firestore queries with `null` may need adjustment. Alternative:

```typescript
// Firestore doesn't support != null directly, so fetch and filter
// OR use a composite query if you have an index
const pendingEncounters = await getDocuments(
  'astral_encounters',
  [['user_id', '==', user.uid]],
  'created_at',
  'desc',
  50 // Limit to recent encounters
);
const pendingEncounter = pendingEncounters.find(e => !e.completed_at);
```

---

## 🟢 LOW PRIORITY / EDGE CASES

### Bug #7: Missing Error Handling for Epic Category Detection

**Location:** `src/hooks/useEncounterTrigger.ts:173`

**Issue:**
If `getDocument('epics', epicId)` fails or returns null, the code continues with `epic?.title || ''` which defaults to empty string. The category detection will always return 'general' in this case, but there's no logging.

**Impact:**
- Silent failures when epic lookup fails
- No visibility into why category detection isn't working
- Themed adversaries won't match epic if epic fetch fails

**Fix:**
Add error handling and logging:

```typescript
const epic = await getDocument<{ title: string; description: string }>('epics', epicId);
if (!epic) {
  console.warn(`Epic ${epicId} not found, using default category`);
}
```

---

### Bug #8: Quest Count Not Initialized on First Quest

**Location:** `src/hooks/useEncounterTrigger.ts:75-101`

**Issue:**
On the very first quest completion, if `next_encounter_quest_count` is null in the database, it's initialized to `getRandomInterval()` (2-4). However, the current quest count logic assumes the count has been incremented.

If a user completes their first quest:
- `questCountRef.current` = 0 (from profile.total_quests_completed)
- `nextEncounterRef.current` = random 2-4 (e.g., 3)
- Quest completes, count increments to 1
- 1 < 3, so no trigger (correct)

But if the user's profile already has `total_quests_completed = 1` from a previous session, and `next_encounter_quest_count` is null, it will initialize to a random value, potentially causing inconsistent behavior.

**Impact:**
- Edge case with new users or migrated profiles
- Inconsistent first encounter timing

**Fix:**
Ensure initialization logic accounts for existing quest counts:

```typescript
questCountRef.current = profile.total_quests_completed || 0;
const nextEncounter = profile.next_encounter_quest_count;
if (nextEncounter === null || nextEncounter === undefined) {
  // Initialize to current count + random interval
  nextEncounterRef.current = questCountRef.current + getRandomInterval();
} else {
  nextEncounterRef.current = nextEncounter;
}
```

---

### Bug #9: Weekly Trigger Doesn't Create Encounter Record

**Location:** `src/hooks/useEncounterTrigger.ts:199-233`

**Issue:**
The `checkWeeklyTrigger` only returns a trigger result but doesn't actually create the encounter record. The encounter creation happens in `checkEncounterTrigger` which is called from the provider. However, if the weekly check happens and triggers, but then a quest completion also triggers before the weekly encounter is created, there could be timing issues.

**Impact:**
- Rare edge case where weekly trigger might be lost
- Two triggers happening simultaneously could cause issues

**Note:** This might be intentional design - the provider handles encounter creation. But the comment suggests it should create an encounter, which it doesn't directly.

---

### Bug #10: No Validation for Quest Interval Parameter

**Location:** `src/components/astral-encounters/AstralEncounterModal.tsx:134`

**Issue:**
The `questInterval` parameter is used directly in calculation without validation:

```typescript
const intervalScale = (questInterval - 3) * 0.15;
```

If `questInterval` is undefined, null, or out of expected range (2-4), this could produce unexpected values.

**Impact:**
- Game difficulty could be wrong if questInterval is malformed
- NaN or unexpected scaling values

**Fix:**
Add validation:

```typescript
const intervalScale = ((questInterval ?? 3) - 3) * 0.15;
// Or clamp: Math.max(2, Math.min(4, questInterval ?? 3))
```

---

## Summary

### Critical Bugs (Fix Immediately):
1. Quest interval calculation always wrong
2. Epic checkpoint triggers on every progress change

### Medium Bugs (Fix Soon):
3. Wrong dependency property name
4. Stale closure risk in phase completion
5. Non-atomic quest count increment
6. Inefficient pending encounter query

### Low Priority:
7-10. Edge cases and minor improvements

---

## Recommended Fix Priority

1. **Bug #2** (Epic checkpoint) - Easy fix, prevents spam triggers
2. **Bug #1** (Quest interval) - Easy fix, corrects game difficulty
3. **Bug #3** (Dependency array) - Trivial fix
4. **Bug #6** (Query optimization) - Easy performance improvement
5. **Bug #5** (Atomic increment) - Requires Firestore increment API
6. **Bug #4** (Stale closure) - Requires refactoring

---

**End of Bug Report**
