

# Living Companion Talk Popup - Integration Fixes

## Overview

This plan addresses four refinement issues identified in the Living Companion Talk Popup system:

1. **Gating Bypass** - Direct `triggerReaction()` calls bypass "first-of-day" checks
2. **Duplicate Trigger Logic** - EpicCheckInDrawer has redundant reaction calls
3. **Unused `triggerComeback()`** - Never integrated into WelcomeBackModal
4. **Unused `mentor` Source** - Check-in completion doesn't trigger mentor reactions

---

## Changes Summary

### File 1: `src/hooks/useXPRewards.ts`

**Current Problem:**
```typescript
// Line 103 - Bypasses triggerQuestComplete's isFirstToday check
triggerReaction('quest', { momentType: 'momentum_gain' }).catch(...)
```

**Fix:**
- Replace direct `triggerReaction` call with `triggerQuestComplete`
- Track "first quest today" status by checking if this is the first habit completion of the day
- Use `triggerQuestComplete(true)` only when it's the first completion

**Implementation:**
- Add a query to check today's completed quest/habit count before awarding XP
- Call `triggerQuestComplete(isFirstQuestToday)` instead of raw `triggerReaction`

---

### File 2: `src/components/EpicCheckInDrawer.tsx`

**Current Problem (Lines 147-163):**
```typescript
// Duplicate trigger in both branches
if (!taskId) {
  surfaceHabit(habitId);
  triggerReaction('ritual', { momentType: 'discipline_win' }); // Call 1
  return;
}
toggleTask({ taskId, completed: true, xpReward: 25 });
triggerReaction('ritual', { momentType: 'discipline_win' }); // Call 2
```

**Fix:**
- Replace both `triggerReaction` calls with single `triggerRitualComplete`
- Track ritual completion state to determine `isFirstToday` and `completedAllRituals`
- Move the trigger call to after the toggle/surface logic

**Implementation:**
- Use `triggerRitualComplete` instead of direct `triggerReaction`
- Add logic to track if this is the first ritual completion today
- Check if all rituals are now complete for the `breakthrough` moment type

---

### File 3: `src/components/WelcomeBackModal.tsx`

**Current Problem:**
- `triggerComeback()` is defined but never used
- WelcomeBackModal should show a special companion reaction when user returns after 3+ days

**Fix:**
- Import `useLivingCompanionSafe` hook
- Call `triggerComeback()` after successful reunion (inside `handleWelcomeBack`)
- This triggers the `comeback` moment type for returning users

**Implementation:**
```typescript
const { triggerComeback } = useLivingCompanionSafe();

const handleWelcomeBack = async () => {
  setShowReunion(true);
  await markUserActive();
  
  if (!hasAwarded) {
    await awardCustomXP(...);
    setHasAwarded(true);
  }
  
  // Trigger comeback reaction for returning users
  if (health.daysInactive >= 3) {
    triggerComeback().catch(err => console.log('[LivingCompanion] Comeback reaction failed:', err));
  }
  
  setTimeout(() => { onClose(); setShowReunion(false); }, 2000);
};
```

---

### File 4: `src/components/MorningCheckIn.tsx`

**Current Problem:**
- `mentor` source reactions exist in database but no trigger point
- Check-in completion is a perfect moment for mentor encouragement

**Fix:**
- Import `useLivingCompanionSafe` hook
- Call `triggerReaction('mentor', { momentType: 'discipline_win' })` after check-in success
- This enables mentor-specific companion reactions

**Implementation:**
```typescript
const { triggerReaction } = useLivingCompanionSafe();

// After awardCheckInComplete() succeeds
triggerReaction('mentor', { momentType: 'discipline_win' }).catch(err => 
  console.log('[LivingCompanion] Mentor reaction failed:', err)
);
```

---

## Technical Details

### First-of-Day Tracking Logic

For `useXPRewards.ts`, add a helper to check if this is the first quest completion today:

```typescript
// Query to check today's completions before this one
const checkIsFirstQuestToday = async (): Promise<boolean> => {
  if (!user?.id) return false;
  const today = new Date().toISOString().split('T')[0];
  
  const { count } = await supabase
    .from('daily_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('task_date', today)
    .eq('completed', true);
  
  // First if count is 0 (this will be the first) or 1 (just completed)
  return (count ?? 0) <= 1;
};
```

### Ritual Completion Detection for EpicCheckInDrawer

```typescript
// Check if all today's rituals are now complete
const checkAllRitualsComplete = (): boolean => {
  const completedCount = todayHabits.filter(h => 
    habitTaskMap.get(h.id)?.is_completed
  ).length;
  // After this toggle, all will be complete if we're at (total - 1)
  return completedCount === todayHabits.length - 1;
};

// Check if this is the first ritual completion today
const checkIsFirstRitualToday = (): boolean => {
  const completedCount = todayHabits.filter(h => 
    habitTaskMap.get(h.id)?.is_completed
  ).length;
  return completedCount === 0;
};
```

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/hooks/useXPRewards.ts` | Refactor | Use `triggerQuestComplete` with first-of-day tracking |
| `src/components/EpicCheckInDrawer.tsx` | Refactor | Use `triggerRitualComplete` with proper gating |
| `src/components/WelcomeBackModal.tsx` | Add Feature | Integrate `triggerComeback()` on reunion |
| `src/components/MorningCheckIn.tsx` | Add Feature | Add `mentor` source reaction trigger |

---

## Expected Behavior After Fix

| Trigger Point | Companion Reaction |
|---------------|-------------------|
| First quest/habit completion of day | "momentum_gain" moment |
| Subsequent quest completions | No reaction (budget respected) |
| First ritual completion of day | "discipline_win" moment |
| All rituals completed | "breakthrough" moment |
| User returns after 3+ day lapse | "comeback" moment |
| Morning check-in complete | "discipline_win" mentor moment |

