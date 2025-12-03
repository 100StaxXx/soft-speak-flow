# Quests Tab Comprehensive Audit - December 2024 (Updated)

## Executive Summary

This audit covers the complete Quests tab functionality including Daily Quests, Habits, Epics (Guilds), Calendar Views, Star Paths (templates), and related systems. The codebase is generally well-structured with good error handling, proper RLS implementation, and atomic operations for XP awards. Several issues from a previous audit have been fixed, but some remain.

**Audit Date:** December 3, 2024  
**Status:** Second pass complete - additional issues found

---

## Quick Summary - All Issues Found

| # | Severity | Issue | File | Status |
|---|----------|-------|------|--------|
| 1 | 🔴 CRITICAL | SharedEpics creates copies instead of joining guilds | `SharedEpics.tsx` | Open |
| 2 | ⚠️ MEDIUM | EpicCheckInDrawer dependency array issue | `EpicCheckInDrawer.tsx` | Open |
| 3 | ⚠️ MEDIUM | Schedule Power-Ups shows XP but doesn't award it | `SchedulePowerUps.tsx` | Open |
| 4 | ⚠️ MEDIUM | Quest limit mismatch (4 vs 10) in DB | Migrations | Open |
| 5 | 🟡 LOW | Dead `toReferenceTime` in SchedulePowerUps | `SchedulePowerUps.tsx` | Open |
| 6 | 🟡 LOW | Dead `toReferenceTime` in TimeConflictDetector | `TimeConflictDetector.tsx` | Open |
| 7 | 🟡 LOW | Dead `toReferenceTime` in CalendarMonthView | `CalendarMonthView.tsx` | Open |
| 8 | 🟡 LOW | Recurrence patterns stored but not auto-created | `useDailyTasks.ts` | Open |
| 9 | 🟡 LOW | EpicLeaderboard fetchLeaderboard not in useCallback | `EpicLeaderboard.tsx` | Open |

### Previously Fixed ✅
- JoinEpic.tsx epic limit check
- HabitCard.tsx user_id verification  
- CalendarWeekView.tsx conflict toast
- TaskCard.tsx initial mount tracking

---

## Architecture Overview

### Main Page: `src/pages/Tasks.tsx`
The Quests tab is a comprehensive task management system with:
- **Daily Quests**: One-time tasks with difficulty-based XP rewards
- **Main Quest System**: One main quest per day gets 1.5x XP multiplier
- **Epics Tab**: Long-term goals linked to habits
- **Calendar Views**: List, Week, and Month views with drag-drop scheduling
- **Advanced Options**: Scheduled time, duration, recurrence, reminders

### Key Files

| Component | Purpose | Status |
|-----------|---------|--------|
| `Tasks.tsx` | Main quests/epics page | ✅ Good |
| `Epics.tsx` | Standalone epics page | ⚠️ Duplicate |
| `useDailyTasks.ts` | Quest CRUD, completion | ✅ Good |
| `useEpics.ts` | Epic management | ✅ Good |
| `TaskCard.tsx` | Quest display | ✅ Good |
| `EpicCard.tsx` | Epic with progress | ✅ Good |
| `CalendarWeekView.tsx` | Drag-drop calendar | ✅ Good |
| `JoinEpic.tsx` | Deep-link epic join | ✅ Fixed |
| `SharedEpics.tsx` | Community epics | 🔴 Still Bugged |

---

## 🐛 Bugs Found

### 1. **CRITICAL: SharedEpics.tsx Creates Copies Instead of Joining Guilds**

**File:** `src/pages/SharedEpics.tsx`  
**Lines:** 36-98

The `SharedEpics.tsx` page creates a **new private epic** for the user instead of joining the existing guild. This is inconsistent with how `JoinEpicDialog.tsx` and `JoinEpic.tsx` work.

```typescript
// SharedEpics.tsx - WRONG: Creates a COPY of the epic
const { data: newEpic, error: epicError } = await supabase
  .from('epics')
  .insert({
    user_id: user.id,
    title: originalEpic.title,
    // ...creates a private copy
    is_public: false  // User is isolated, not in guild
  })
```

**Impact:** 
- Users don't actually join the community guild
- No guild chat/rivalry features available
- Leaderboards and shouts won't work
- Defeats the purpose of "Community Epics"

**Fix Required:** Replace copy logic with join-as-member logic:
```typescript
// Add user to epic_members table instead
const { error: memberError } = await supabase
  .from('epic_members')
  .insert({
    epic_id: epicId,
    user_id: user.id,
  });

// Copy habits to user's account (this part is correct)
// Link copied habits to original epic
```

---

### 2. **LOW: Dead Code in SchedulePowerUps.tsx**

**File:** `src/components/SchedulePowerUps.tsx`  
**Lines:** 20-25

Unused `toReferenceTime` function declared but never called:

```typescript
const toReferenceTime = (time: string) => {
  const [hours, minutes = "0"] = time.split(":");
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return new Date(2000, 0, 1, h, m, 0, 0);
};
// ^ This function is never used
```

**Impact:** Minor - dead code, no functional issue.

---

### 3. **LOW: Dead Code in TimeConflictDetector.tsx**

**File:** `src/components/TimeConflictDetector.tsx`  
**Lines:** 25-30

Same unused `toReferenceTime` function:

```typescript
const toReferenceTime = (time: string) => {
  // ... never called
};
```

---

### 4. **MEDIUM: EpicCheckInDrawer.tsx Dependency Array Issue**

**File:** `src/components/EpicCheckInDrawer.tsx`  
**Line:** 56

The `useCallback` dependency uses `habitIds.join(',')` which creates a new string on every render:

```typescript
const fetchTodayCompletions = useCallback(async () => {
  // ...
}, [user?.id, habitIds.join(','), today]);
//            ^^^^^^^^^^^^^^^^^ Creates new string each render
```

**Impact:** The callback is recreated unnecessarily, potentially causing excessive re-fetches.

**Fix:** Use a memoized version or stable reference:
```typescript
const habitIdsKey = useMemo(() => habitIds.sort().join(','), [habitIds]);

const fetchTodayCompletions = useCallback(async () => {
  // ...
}, [user?.id, habitIdsKey, today]);
```

---

### 5. **MEDIUM: Schedule Power-Ups XP Not Actually Awarded**

**File:** `src/components/SchedulePowerUps.tsx`

The component displays bonus XP calculations but there's no code that actually awards this XP. It's purely visual/motivational.

```typescript
return {
  // ...
  totalBonus: (powerHours.length * 15) + (deepWorkBlocks * 20) + ...
};
// This total is displayed but never awarded anywhere
```

**Impact:** Users may expect to receive this bonus XP but don't actually get it.

**Decision Needed:** Either:
1. Implement actual XP awards for schedule achievements
2. Clearly label as "motivation only" UI
3. Remove to avoid confusion

---

### 6. **MEDIUM: Quest Limit Mismatch Between Database Functions**

**Files:** 
- `supabase/migrations/20251125103000_add_daily_task_helpers.sql` (Line 32)
- `supabase/migrations/20251129040100_enforce_quest_limits.sql` (Line 18)

Two different quest limits are defined:

```sql
-- In add_daily_task helper function (not used by client)
IF existing_count >= 4 THEN
  RAISE EXCEPTION 'MAX_TASKS_REACHED';

-- In enforce_daily_quest_limit trigger (active)
IF quest_count >= 10 THEN
  RAISE EXCEPTION 'Maximum quest limit reached...';
```

**Impact:** 
- The client uses direct INSERT, so the 10-quest limit applies
- The `add_daily_task` function with 4-quest limit is unused
- Creates confusion about actual limits

**Fix:** Remove or align the unused function's limit with the trigger.

---

### 7. **LOW: Dead `toReferenceTime` Function in CalendarMonthView**

**File:** `src/components/CalendarMonthView.tsx`  
**Lines:** 28-33

Same pattern of unused helper function found in another calendar component.

---

### 8. **LOW: EpicLeaderboard Uses Deprecated eslint-disable Comment**

**File:** `src/components/EpicLeaderboard.tsx`  
**Line:** 100-101

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [epicId]); // fetchLeaderboard is stable and depends on epicId indirectly
```

While the comment explains the reasoning, the function `fetchLeaderboard` is recreated on every render since it's not wrapped in `useCallback`. This is a minor performance issue.

---

### 9. **LOW: Recurrence Pattern Not Fully Implemented**

**File:** `src/hooks/useDailyTasks.ts`  
**Lines:** 137-154

The `recurrence_pattern` and `recurrence_days` are stored but there's no visible system that auto-creates recurring tasks on subsequent days:

```typescript
const { error } = await supabase
  .from('daily_tasks')
  .insert({
    // ...
    recurrence_pattern: recurrencePattern || null,
    recurrence_days: recurrenceDays || null,
    is_recurring: !!recurrencePattern,
    // ^ Stored but no cron/scheduled job creates future instances
  });
```

**Impact:** Users might set recurring tasks expecting them to auto-appear daily, but they need to be manually created each day.

---

## ✅ Issues Fixed Since Previous Audit

### 1. JoinEpic.tsx Epic Limit Check ✅ FIXED

**Previous Issue:** Deep-link joins bypassed 2-epic limit.  
**Current Status:** Lines 53-78 now properly check epic limits before joining.

### 2. HabitCard.tsx User ID Verification ✅ FIXED

**Previous Issue:** Archive mutation didn't include explicit `user_id` check.  
**Current Status:** Line 64 now includes `.eq('user_id', user.id)`.

### 3. CalendarWeekView.tsx Conflict Toast ✅ FIXED

**Previous Issue:** Drop failures only played error sound, no toast.  
**Current Status:** Lines 154-157 now show toast with description.

### 4. TaskCard.tsx Initial Mount Tracking ✅ FIXED

**Previous Issue:** XP animation fired on page reload for completed tasks.  
**Current Status:** Lines 38, 76-82 use `useRef` to track initial mount.

---

## 🔒 Security Analysis

### Strengths ✅

1. **Row Level Security:** All tables use RLS properly
2. **Atomic XP Awards:** `complete_quest_with_xp` PostgreSQL function ensures no double-completion
3. **Double-completion Prevention:** Toggle uses `.eq('completed', false)` atomic check
4. **User ID Checks:** Most mutations include explicit `user_id` filtering
5. **Rate Limiting:** `toggleInProgress` and `addInProgress` refs prevent rapid double-clicks

### Database Constraints

```sql
-- Quest limit enforced at database level
CREATE TRIGGER enforce_daily_quest_limit
  BEFORE INSERT ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_quest_limit();
  
-- Limit: 10 quests per day (lenient safety limit)
IF quest_count >= 10 THEN
  RAISE EXCEPTION 'Maximum quest limit reached...';
```

---

## ⚡ Performance Analysis

### Strengths ✅

1. **Query Caching:** TanStack Query with appropriate stale times
   - Tasks: 2 minutes
   - Epics: 3 minutes
   - Calendar: 2 minutes

2. **Memoization:** `totalXP` calculation is properly memoized:
```typescript
const totalXP = useMemo(() => {
  return tasks.reduce((sum, task) => {...}, 0);
}, [tasks]);
```

3. **Lazy Loading:** Calendar views only fetch date range needed

4. **Optimistic Updates:** EpicCheckInDrawer uses optimistic UI updates

### Potential Issues ⚠️

1. **Real-time Subscriptions:** Each EpicCard creates a subscription channel - could be many if user has several epics

2. **Calendar Task Refetch:** Week/Month view refetches all tasks in range on any change

---

## 🎨 UX Observations

### Good Patterns ✅

1. **Tutorial Modal:** First-time users get an onboarding tutorial
2. **Main Quest Prompt:** Users prompted to set main quest when adding first task
3. **Difficulty Visual Indicators:** Clear color coding (green/amber/red)
4. **XP Preview:** Shows expected XP before completing tasks
5. **Diminishing Returns Transparency:** UI shows XP reduction after 3rd quest

### UX Issues ⚠️

1. **Tutorial Can't Close by Click-Outside:** Intentional but may frustrate users
2. **No Undo for Quest Completion:** Once complete, can't uncomplete (by design for XP integrity)
3. **Week View Drag Preview:** No ghost preview when dragging tasks

---

## 📋 Recommendations

### High Priority Fixes

| Issue | File | Effort | Impact |
|-------|------|--------|--------|
| SharedEpics copies instead of joins | `SharedEpics.tsx` | Medium | High |
| Quest limit mismatch (4 vs 10) | Migrations | Low | Medium |
| EpicCheckInDrawer dependency array | `EpicCheckInDrawer.tsx` | Low | Medium |

### Medium Priority Cleanup

| Issue | File | Effort |
|-------|------|--------|
| Remove dead `toReferenceTime` functions | `SchedulePowerUps.tsx`, `TimeConflictDetector.tsx`, `CalendarMonthView.tsx` | Low |
| Clarify Schedule Power-Ups XP (visual only) | `SchedulePowerUps.tsx` | Low |
| Consider consolidating Epics.tsx with Tasks.tsx | Multiple | Medium |
| Wrap fetchLeaderboard in useCallback | `EpicLeaderboard.tsx` | Low |

### Low Priority / Future Enhancements

1. Implement actual recurring task creation (cron job or edge function)
2. Add drag preview ghost for week view
3. Consider UTC-based date handling for travelers
4. Add undo capability for accidental quest completion (with XP reversal)
5. Remove or use the `add_daily_task` database function

---

## XP System Summary

### Quest XP Rewards (from `xpRewards.ts`)

| Difficulty | Base XP | Main Quest (1.5x) |
|------------|---------|-------------------|
| Easy | 8 | 12 |
| Medium | 16 | 24 |
| Hard | 28 | 42 |

### Diminishing Returns

| Quest Position | Multiplier |
|----------------|------------|
| 1-3 | 100% |
| 4 | 75% |
| 5 | 50% |
| 6 | 35% |
| 7 | 25% |
| 8 | 15% |
| 9-10 | 10% |
| 11+ | 5% |

### Guild Bonus
- 10% XP bonus for tasks linked to public epics

---

## Files Audited

### Pages
- ✅ `src/pages/Tasks.tsx`
- ✅ `src/pages/Epics.tsx`
- ✅ `src/pages/JoinEpic.tsx`
- 🔴 `src/pages/SharedEpics.tsx`

### Hooks
- ✅ `src/hooks/useDailyTasks.ts`
- ✅ `src/hooks/useEpics.ts`
- ✅ `src/hooks/useCalendarTasks.ts`
- ✅ `src/hooks/useEpicTemplates.ts`
- ✅ `src/hooks/useXPRewards.ts`
- ✅ `src/hooks/useGuildActivity.ts`

### Components
- ✅ `src/components/TaskCard.tsx`
- ✅ `src/components/EpicCard.tsx`
- ✅ `src/components/CreateEpicDialog.tsx`
- ✅ `src/components/JoinEpicDialog.tsx`
- ✅ `src/components/CalendarWeekView.tsx`
- ⚠️ `src/components/CalendarMonthView.tsx` (dead code)
- ✅ `src/components/QuestDragCard.tsx`
- ✅ `src/components/QuestDropZone.tsx`
- ✅ `src/components/AdvancedQuestOptions.tsx`
- ✅ `src/components/QuestsTutorialModal.tsx`
- ⚠️ `src/components/SchedulePowerUps.tsx` (dead code, XP not awarded)
- ⚠️ `src/components/TimeConflictDetector.tsx` (dead code)
- ⚠️ `src/components/EpicCheckInDrawer.tsx` (dependency array issue)
- ⚠️ `src/components/EpicLeaderboard.tsx` (useCallback missing)
- ✅ `src/components/EpicActivityFeed.tsx`
- ✅ `src/components/GuildMembersSection.tsx`
- ✅ `src/components/GuildActivityFeed.tsx`
- ✅ `src/components/GuildShoutsFeed.tsx`
- ✅ `src/components/HabitCard.tsx`
- ✅ `src/components/HabitTemplates.tsx`
- ✅ `src/components/FrequencyPicker.tsx`
- ✅ `src/components/StarPathsBrowser.tsx`
- ✅ `src/components/ConstellationTrail.tsx`
- ✅ `src/components/EmptyState.tsx`

### Config/Utils
- ✅ `src/config/xpRewards.ts`
- ✅ `src/utils/questCategorization.ts`

### Database
- ⚠️ `supabase/migrations/20251129040100_enforce_quest_limits.sql` (limit mismatch)
- ⚠️ `supabase/migrations/20251125103000_add_daily_task_helpers.sql` (unused function)
- ✅ `supabase/migrations/20251124225200_add_quest_completion_transaction.sql`

---

## Test Scenarios

| Scenario | Expected | Status |
|----------|----------|--------|
| Create quest → XP based on position | Quests 1-3: 100%, 4+: diminished | ✅ Working |
| Complete main quest → 1.5x XP | Applied correctly | ✅ Working |
| Toggle completed quest → Reject | Cannot uncheck | ✅ Working |
| Join epic via deep link (2 active) | Should reject | ✅ Fixed |
| Join epic via JoinEpicDialog (2 active) | Should reject | ✅ Working |
| Join from SharedEpics | Should join guild | 🔴 Creates copy instead |
| Drag task to conflicting slot | Show toast error | ✅ Fixed |
| Epic habit completion | Progress updates | ✅ Working |
| Create > 10 quests/day | Should reject | ✅ DB enforced |

---

*Audit completed: December 3, 2024*
