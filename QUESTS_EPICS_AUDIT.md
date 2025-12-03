# Comprehensive Quests & Epics Tab Audit

## Executive Summary

This audit covers the complete Quests tab functionality including Daily Quests, Epics, Star Paths (templates), Guild features, and related integrations. The codebase is generally well-structured with good error handling, but several issues and improvements have been identified.

---

## Architecture Overview

### Key Components

| Component | Purpose |
|-----------|---------|
| `Tasks.tsx` | Main quests/epics page with tabs |
| `Epics.tsx` | Standalone epics page (duplicate route) |
| `EpicCard.tsx` | Epic display with progress, habits, guild features |
| `CreateEpicDialog.tsx` | Epic creation with theme selection |
| `JoinEpicDialog.tsx` | Join epic via invite code |
| `JoinEpic.tsx` | Deep-link epic join page |
| `StarPathsBrowser.tsx` | Epic templates browser |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useDailyTasks.ts` | Quest CRUD, completion, XP awards |
| `useEpics.ts` | Epic CRUD, status updates |
| `useEpicTemplates.ts` | Star Path templates |
| `useCalendarTasks.ts` | Calendar view data fetching |
| `useGuildRivalry.ts` | Guild rivalry system |
| `useGuildShouts.ts` | Guild shout notifications |

---

## 🐛 Bugs Found

### 1. **CRITICAL: JoinEpic.tsx Missing Epic Limit Check**
**File:** `src/pages/JoinEpic.tsx`
**Lines:** 54-108

The `JoinEpic.tsx` page (deep-link route) does NOT check the 2-epic limit before allowing join, unlike `JoinEpicDialog.tsx` which properly checks.

```typescript
// JoinEpic.tsx - MISSING the limit check that exists in JoinEpicDialog.tsx
const joinEpic = useMutation({
  mutationFn: async () => {
    // ... no check for MAX_EPICS limit
  }
});
```

**Impact:** Users can bypass the 2-epic limit by using deep links.

**Fix Required:** Add epic limit check matching `JoinEpicDialog.tsx`:
```typescript
const MAX_EPICS = 2;
const { data: ownedEpics } = await supabase
  .from('epics')
  .select('id')
  .eq('user_id', user.id)
  .eq('status', 'active');

const { data: joinedEpics } = await supabase
  .from('epic_members')
  .select('epic_id, epics!inner(user_id, status)')
  .eq('user_id', user.id)
  .neq('epics.user_id', user.id)
  .eq('epics.status', 'active');

const totalActiveEpics = (ownedEpics?.length || 0) + (joinedEpics?.length || 0);
if (totalActiveEpics >= MAX_EPICS) {
  throw new Error(`You can only have ${MAX_EPICS} active epics at a time`);
}
```

---

### 2. **MEDIUM: TaskCard XP Display Shows Wrong Value After Completion**
**File:** `src/components/TaskCard.tsx`
**Lines:** 75-87

The `showXP` state logic fires whenever `task.completed` becomes true, even on initial render if the task was already completed. This can show stale XP animations.

```typescript
useEffect(() => {
  if (task.completed && !justCompleted) {
    setJustCompleted(true);
    setShowXP(true);  // This fires even on page reload for completed tasks
    // ...
  }
}, [task.completed, justCompleted]);
```

**Impact:** Minor - XP animation may show briefly when viewing already-completed tasks.

**Fix:** Track initial mount state:
```typescript
const isInitialMount = useRef(true);
useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false;
    return;
  }
  // ... rest of logic
}, [task.completed]);
```

---

### 3. **LOW: Duplicate Page - Epics.tsx vs Tasks.tsx Epics Tab**
**Files:** `src/pages/Epics.tsx` and `src/pages/Tasks.tsx`

There are two separate pages for Epics:
1. `Tasks.tsx` has an "Epics" tab
2. `Epics.tsx` is a standalone page

Both have slightly different UIs and feature sets. This creates maintenance burden and potential inconsistencies.

**Impact:** UX confusion, code duplication.

**Recommendation:** Consolidate to single implementation.

---

### 4. **MEDIUM: SharedEpics.tsx Creates Duplicate Habits Without Linking to Original**
**File:** `src/pages/SharedEpics.tsx`
**Lines:** 36-98

When joining a public epic from `SharedEpics.tsx`, it creates a **new** epic for the user instead of joining the existing one. This is inconsistent with the guild-based approach in `JoinEpicDialog.tsx`.

```typescript
// Creates a COPY of the epic instead of joining the original
const { data: newEpic, error: epicError } = await supabase
  .from('epics')
  .insert({
    user_id: user.id,
    title: originalEpic.title,
    // ...
  })
```

**Impact:** Users don't join the guild/community - they create isolated copies.

**Fix:** Use the same approach as `JoinEpicDialog.tsx` - add user to `epic_members` table.

---

### 5. **LOW: ConstellationTrail Progress Check Runs on Every Render**
**File:** `src/components/EpicCard.tsx`
**Lines:** 103-153

The postcard generation check runs frequently on re-renders, though the server-side deduplication prevents actual duplicates.

```typescript
useEffect(() => {
  // This runs on every progress change and component mount
  if (currentProgress > previousProgress) {
    checkAndGeneratePostcard(/* ... */);
  }
}, [epic.progress_percentage, ...]);
```

**Impact:** Minor - unnecessary API calls (handled by server dedup).

---

### 6. **MEDIUM: HabitCard Archive Lacks User ID Verification**
**File:** `src/components/HabitCard.tsx`
**Lines:** 45-69

The archive operation doesn't explicitly pass `user_id` in the update query:

```typescript
const { error } = await supabase
  .from('habits')
  .update({ is_active: false })
  .eq('id', id);  // Missing: .eq('user_id', user.id)
```

**Impact:** Relies entirely on RLS. Should add explicit user check for defense-in-depth.

---

## ⚠️ Edge Cases & Potential Issues

### 1. **Race Condition in Main Quest Setting**
**File:** `src/hooks/useDailyTasks.ts`
**Lines:** 367-409

The `setMainQuest` mutation uses a two-step update (unset all, then set one) which could race if user clicks rapidly:

```typescript
// Step 1: Unset all
await supabase.from('daily_tasks').update({ is_main_quest: false })...
// Step 2: Set new one  
await supabase.from('daily_tasks').update({ is_main_quest: true })...
```

**Mitigation:** The `toggleInProgress` ref pattern used elsewhere isn't applied here.

**Recommendation:** Add mutex or use a single transaction.

---

### 2. **Timezone Handling - Local Device Date Used**
**File:** `src/hooks/useDailyTasks.ts`
**Lines:** 27-32

```typescript
// NOTE: Using local device date. This works for most users but has edge cases:
// - Users who travel across timezones may see incorrect "today"
const taskDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
```

The codebase acknowledges this limitation in comments. Tasks could appear on wrong days for traveling users.

---

### 3. **Calendar Task Drop - Conflict Check Has UX Gap**
**File:** `src/components/CalendarWeekView.tsx`
**Lines:** 144-156

When dropping a task on a conflicting time slot, it plays an error sound but doesn't show a toast/message:

```typescript
if (!hasConflict) {
  playSound('complete');
  onTaskDrop(taskId, day, time);
} else {
  playSound('error');  // No visual feedback!
}
```

**Fix:** Add toast notification for failed drops.

---

### 4. **Epic Habit Limit Silently Enforced**
**File:** `src/components/CreateEpicDialog.tsx`
**Lines:** 102-108, 283-298

Epics are limited to 2 habits, but when loading from a template with more habits, extras are silently dropped:

```typescript
const templateHabits: NewHabit[] = template.habits.slice(0, 2).map(...)
```

**Recommendation:** Show user notification that template was truncated.

---

### 5. **Quest Limit Mismatch: UI Says 4, DB Allows 10**
**Files:** 
- `src/hooks/useDailyTasks.ts` line 160: `'Maximum 4 tasks per day'`
- `supabase/migrations/20251129040100_enforce_quest_limits.sql` line 18: `IF quest_count >= 10`

The UI error message mentions 4, but the database allows 10:

```sql
-- In migration
IF quest_count >= 10 THEN
  RAISE EXCEPTION 'Maximum quest limit reached...';
```

**Fix:** Align the limits (either UI or DB).

---

## 🔒 Security Considerations

### 1. **Good: RLS Properly Implemented**
All queries include user authentication checks and Row Level Security handles authorization.

### 2. **Good: Double-Completion Prevention**
The toggle task mutation uses atomic conditional update:
```typescript
.eq('completed', false) // Prevent double-completion
```

### 3. **Improvement Needed: Explicit User Checks**
Some mutations rely only on RLS without explicit `user_id` filtering. Add defense-in-depth checks.

### 4. **Good: XP Award Race Protection**
```typescript
// CRITICAL: Verify the update actually happened
if (!updateResult || updateResult.length === 0) {
  throw new Error('Task was already completed');
}
// Award XP only after verified database update
await awardCustomXP(totalXP, ...);
```

---

## ⚡ Performance Considerations

### 1. **Good: Query Caching with TanStack Query**
Appropriate `staleTime` values are set:
- Tasks: 2 minutes
- Epics: 3 minutes
- Calendar: 2 minutes

### 2. **Good: Batch Loading in GuildMembersSection**
```typescript
// Batch fetch profiles and companions in parallel
const [profilesRes, companionsRes] = await Promise.all([
  supabase.from("profiles").select(...).in("id", userIds),
  supabase.from("user_companion").select(...).in("user_id", userIds),
]);
```

### 3. **Improvement: Memoization in Tasks.tsx**
The `totalXP` calculation is properly memoized:
```typescript
const totalXP = useMemo(() => {
  return tasks.reduce((sum, task) => {...}, 0);
}, [tasks]);
```

### 4. **Potential Issue: Real-time Subscriptions Not Cleaned Up**
**File:** `src/components/EpicCard.tsx`
The subscription cleanup is correct, but multiple EpicCards could create many subscriptions.

---

## 🎨 UX Issues

### 1. **Tutorial Modal Can't Be Dismissed by Click-Outside**
**File:** `src/components/QuestsTutorialModal.tsx`
```typescript
onOpenChange={(isOpen) => {
  if (!isOpen) return;  // Prevents closing
}}
```
This is intentional but could frustrate users.

### 2. **Main Quest Prompt Timing**
**File:** `src/pages/Tasks.tsx`
**Lines:** 368-375

The main quest prompt appears BEFORE the task is created, not after. If user dismisses, task is created as side quest. This flow could be clearer.

### 3. **No Loading State for Epic Creation**
The create button shows "Creating Epic..." but there's no overlay or disabled state preventing double-clicks during slow networks.

### 4. **Week View Drag-Drop - No Visual Drag Preview**
The week view supports drag-drop but doesn't show a ghost preview of where the task will land.

---

## 📋 Recommendations

### High Priority Fixes

1. **Fix JoinEpic.tsx epic limit bypass** - Security/fairness issue
2. **Fix SharedEpics.tsx to join instead of copy** - Feature correctness
3. **Add toast feedback for calendar drop failures** - UX
4. **Align quest limit (4 vs 10) between UI and DB** - Consistency

### Medium Priority Improvements

1. **Consolidate Epics.tsx and Tasks.tsx Epics tab** - Code maintenance
2. **Add explicit user_id checks in mutations** - Defense in depth
3. **Add drag preview for week view** - UX polish
4. **Show template truncation warning** - User clarity

### Low Priority / Nice to Have

1. **Track initial mount for XP animation** - Minor visual bug
2. **Add mutex for setMainQuest** - Edge case prevention
3. **Consider UTC-based date handling** - Timezone robustness

---

## Test Scenarios to Verify

1. ✅ Create quest → XP awarded correctly based on position (1-3 = 100%, 4+ diminished)
2. ✅ Complete main quest → 1.5x XP multiplier applied
3. ✅ Toggle completed quest → Cannot uncheck (XP farming prevention)
4. ⚠️ Join epic via deep link with 2 active epics → Should reject (currently doesn't)
5. ✅ Create epic with 2 habits → Success
6. ✅ Join guild via code → Habits copied, membership created
7. ✅ Complete epic habit → Progress updates automatically (trigger works)
8. ✅ Complete epic at 100% → Manual completion button appears
9. ⚠️ Join from SharedEpics → Creates copy instead of joining guild

---

## Files Audited

- `src/pages/Tasks.tsx` ✅
- `src/pages/Epics.tsx` ✅
- `src/pages/JoinEpic.tsx` ✅
- `src/pages/SharedEpics.tsx` ✅
- `src/hooks/useDailyTasks.ts` ✅
- `src/hooks/useEpics.ts` ✅
- `src/hooks/useEpicTemplates.ts` ✅
- `src/hooks/useCalendarTasks.ts` ✅
- `src/hooks/useGuildRivalry.ts` ✅
- `src/components/EpicCard.tsx` ✅
- `src/components/CreateEpicDialog.tsx` ✅
- `src/components/JoinEpicDialog.tsx` ✅
- `src/components/TaskCard.tsx` ✅
- `src/components/HabitCard.tsx` ✅
- `src/components/EpicCheckInDrawer.tsx` ✅
- `src/components/StarPathsBrowser.tsx` ✅
- `src/components/ConstellationTrail.tsx` ✅
- `src/components/CalendarWeekView.tsx` ✅
- `src/components/GuildMembersSection.tsx` ✅
- `src/components/GuildActivityFeed.tsx` ✅
- `src/components/AdvancedQuestOptions.tsx` ✅
- `src/components/QuestsTutorialModal.tsx` ✅
- `src/config/xpRewards.ts` ✅
- `src/utils/questCategorization.ts` ✅
- `supabase/migrations/20251129040000_fix_epic_progress_trigger.sql` ✅
- `supabase/migrations/20251129040100_enforce_quest_limits.sql` ✅

---

*Audit completed: December 2024*
