# Quest System Review - Bonus Quest Slot Implementation

## Executive Summary
**Status**: ❌ **BONUS QUEST SLOT NOT IMPLEMENTED**

The bonus quest slot feature has NOT been implemented yet. The current system still enforces a hard limit of 4 quests per day with no logic for unlocking a 5th "Bonus Quest" slot.

---

## Requirements (Not Met)
- **Base limit**: 4 quests ✅ (Currently enforced)
- **Bonus Quest Unlock Conditions**: ❌ (NOT IMPLEMENTED)
  - Unlock 5th slot if user completes all 4 quests that day, OR
  - Unlock 5th slot if user is on a 7+ day streak

---

## Critical Issues Found

### 1. ❌ Database Function Missing Bonus Logic
**File**: `supabase/migrations/20251125103000_add_daily_task_helpers.sql`
**Lines**: 32-34

```sql
IF existing_count >= 4 THEN
  RAISE EXCEPTION 'MAX_TASKS_REACHED';
END IF;
```

**Problem**: Hard-coded limit of 4 with NO bonus quest slot logic.

**Required Fix**: The function needs to:
1. Check if user has completed all 4 quests today
2. Check if user has a 7+ day streak (from profiles.current_habit_streak)
3. Allow 5 quests if either condition is met

---

### 2. ❌ Frontend Hook Missing Bonus Logic
**File**: `src/hooks/useDailyTasks.ts`
**Lines**: 91-94, 328

```typescript
if (existingTasks && existingTasks.length >= 4) {
  addInProgress.current = false;
  throw new Error('Maximum 4 tasks per day');
}

// ...

const canAddMore = tasks.length < 4;
```

**Problem**: Frontend enforces hard limit of 4 with no bonus slot check.

**Required Fix**: 
1. Create a function to check bonus slot eligibility
2. Calculate dynamic max quests (4 or 5)
3. Update `canAddMore` to use dynamic limit

---

### 3. ❌ UI Shows Static Limit
**File**: `src/pages/Tasks.tsx`
**Line**: 685

```tsx
<p className="text-sm text-muted-foreground">Max 4 quests per day</p>
```

**Problem**: Static text doesn't reflect bonus quest slot availability.

**Required Fix**: Dynamic text showing:
- "Max 4 quests per day" (when bonus not unlocked)
- "Max 5 quests per day (Bonus Slot Unlocked! 🎯)" (when eligible)

---

## Implementation Plan

### Step 1: Update Database Function
Create new migration to modify `add_daily_task` function:

```sql
-- Check for bonus quest slot eligibility
DECLARE
  v_can_add_bonus boolean := false;
  v_user_streak integer;
  v_completed_today integer;
BEGIN
  -- Get user's current streak
  SELECT current_habit_streak INTO v_user_streak
  FROM profiles
  WHERE id = p_user_id;
  
  -- Count completed quests today
  SELECT COUNT(*) INTO v_completed_today
  FROM daily_tasks
  WHERE user_id = p_user_id
    AND task_date = target_date
    AND completed = true;
  
  -- Check bonus conditions
  v_can_add_bonus := (v_completed_today >= 4) OR (v_user_streak >= 7);
  
  -- Apply dynamic limit
  IF existing_count >= 4 AND NOT v_can_add_bonus THEN
    RAISE EXCEPTION 'MAX_TASKS_REACHED';
  ELSIF existing_count >= 5 THEN
    RAISE EXCEPTION 'MAX_TASKS_REACHED';
  END IF;
END;
```

### Step 2: Update useDailyTasks Hook
Add bonus slot logic:

```typescript
// Fetch profile to check streak
const { profile } = useProfile();

// Check bonus slot eligibility
const getBonusSlotEligibility = () => {
  const completedToday = tasks.filter(t => t.completed).length;
  const allFourCompleted = tasks.length >= 4 && completedToday >= 4;
  const hasLongStreak = (profile?.current_habit_streak || 0) >= 7;
  return allFourCompleted || hasLongStreak;
};

const hasBonusSlot = getBonusSlotEligibility();
const maxQuests = hasBonusSlot ? 5 : 4;
const canAddMore = tasks.length < maxQuests;
```

### Step 3: Update UI
Show dynamic limit and bonus status:

```tsx
<div>
  <h3 className="font-semibold">
    {isSameDay(selectedDate, new Date()) ? "Today's Quests" : format(selectedDate, 'MMM d')}
  </h3>
  <p className="text-sm text-muted-foreground">
    Max {maxQuests} quests per day
    {hasBonusSlot && <span className="text-primary ml-1">🎯 Bonus Slot Unlocked!</span>}
  </p>
</div>
```

---

## Additional Issues Found

### 4. ⚠️ Efficiency: Redundant Database Queries
**File**: `src/hooks/useDailyTasks.ts`
**Lines**: 80-88

The `addTask` function fetches tasks again from the database even though they're already in React Query cache.

**Recommendation**: Use optimistic updates or rely on cache, only fetch to prevent race conditions.

---

### 5. ⚠️ Race Condition in toggleTask
**File**: `src/hooks/useDailyTasks.ts`
**Lines**: 194-287

The `toggleTask` function has complex async logic with potential race conditions:
- Multiple database calls
- XP award between calls
- Companion attribute updates

**Recommendation**: Move more logic to database triggers or use transactions.

---

### 6. ⚠️ Potential Bug: Completed Task Can't Be Unchecked
**File**: `src/hooks/useDailyTasks.ts`
**Lines**: 214-216

```typescript
if (wasAlreadyCompleted && !completed) {
  throw new Error('Cannot uncheck completed tasks');
}
```

This is by design to prevent XP farming, but could be frustrating for users who accidentally check a task.

**Recommendation**: Add a grace period (e.g., 30 seconds) where unchecking is allowed without XP penalty.

---

### 7. ✅ Good: XP Calculation
**File**: `src/pages/Tasks.tsx`
**Lines**: 133-137

The XP calculation correctly applies the MAIN_QUEST_MULTIPLIER (1.5x):

```typescript
const totalXP = tasks.reduce((sum, task) => {
  if (!task.completed) return sum;
  const reward = task.is_main_quest ? task.xp_reward * MAIN_QUEST_MULTIPLIER : task.xp_reward;
  return sum + reward;
}, 0);
```

---

### 8. ✅ Good: Guild Bonus Logic
**File**: `src/hooks/useDailyTasks.ts`
**Lines**: 160-192

The guild bonus (10%) is properly calculated and applied.

---

### 9. ⚠️ Inconsistency: Main Quest Multiplier
The MAIN_QUEST_MULTIPLIER is defined as 1.5x in the frontend, but this value should potentially be a shared constant or come from the database to ensure consistency.

**Recommendation**: Move to a shared config file or database table.

---

### 10. ⚠️ Missing: Bonus Quest Visual Distinction
If a 5th "Bonus Quest" slot is unlocked, there should be visual indication that this is a special bonus slot, not just a regular 5th quest.

**Recommendation**: Add special styling or badge for the bonus quest slot.

---

## Testing Checklist

### Test Cases Needed:
- [ ] Add 4 quests normally ✓ (Should work)
- [ ] Try to add 5th quest without bonus (Should fail)
- [ ] Complete all 4 quests, then add 5th (Should work)
- [ ] User with 7+ day streak adds 5th quest (Should work)
- [ ] User with 6 day streak tries to add 5th (Should fail)
- [ ] Edge case: User completes 4th quest while add dialog is open
- [ ] Edge case: Streak updates while on quest page
- [ ] Edge case: Date changes (midnight) while adding quest
- [ ] Race condition: Two rapid quest additions
- [ ] Performance: Query efficiency with large task history

---

## Summary

**Bugs**: 0 critical bugs found in current implementation
**Missing Features**: Bonus Quest Slot (COMPLETE FEATURE NOT IMPLEMENTED)
**Inefficiencies**: 2 (redundant queries, race conditions)
**Warnings**: 3 (unchecking tasks, main quest multiplier location, bonus visual distinction)

**Priority**:
1. 🔴 **CRITICAL**: Implement bonus quest slot logic (database + frontend + UI)
2. 🟡 **MEDIUM**: Fix redundant database queries
3. 🟢 **LOW**: Add visual distinction for bonus slot
4. 🟢 **LOW**: Consider grace period for unchecking tasks

---

## Estimated Implementation Time
- Database function update: 15 minutes
- Frontend hook update: 20 minutes  
- UI updates: 15 minutes
- Testing: 30 minutes
- **Total**: ~1.5 hours

---

Generated: 2025-11-25
