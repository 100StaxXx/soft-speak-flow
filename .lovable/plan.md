

# Fix Duplicate Ritual/Habit Tasks

## Root Cause Analysis

The app is creating duplicate ritual tasks for the same day. Looking at the database:
- "Active Recovery / Mobility Work" appears twice on 2026-02-02
- "Resistance Training Session" appears twice
- "Sleep Optimization" appears twice
- etc.

**Key finding:** Both duplicates have the same `habit_source_id` but different task IDs, created ~2.5 seconds apart. This is a **race condition** in the habit surfacing system.

### Why This Happens

1. User opens the Quests page
2. `useHabitSurfacing` fetches habits and calculates 5 need surfacing
3. `Journeys.tsx` effect triggers `surfaceAllEpicHabits()`
4. Before the insert completes and query invalidates, the effect runs again
5. Second batch of 5 duplicates gets inserted

The `hasSurfacedRef` guard exists but isn't fully preventing this due to React's rendering behavior and async timing.

---

## Solution: Two-Layer Protection

### Layer 1: Database Unique Constraint (Primary Fix)

Add a partial unique constraint to prevent duplicates at the database level:

```sql
CREATE UNIQUE INDEX idx_daily_tasks_habit_date_unique 
ON daily_tasks (user_id, task_date, habit_source_id) 
WHERE habit_source_id IS NOT NULL;
```

This guarantees only one task per habit per day, regardless of frontend race conditions.

### Layer 2: Use INSERT ON CONFLICT (Application Fix)

Update `useHabitSurfacing.ts` to use upsert logic:

```typescript
// Instead of simple insert, use ON CONFLICT to skip duplicates
const { data, error } = await supabase
  .from('daily_tasks')
  .upsert(tasks, { 
    onConflict: 'user_id,task_date,habit_source_id',
    ignoreDuplicates: true 
  })
  .select('id');
```

### Layer 3: Cleanup Existing Duplicates

Run a one-time cleanup to remove existing duplicate tasks, keeping the earliest one:

```sql
DELETE FROM daily_tasks 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, task_date, habit_source_id 
      ORDER BY created_at ASC
    ) as rn
    FROM daily_tasks 
    WHERE habit_source_id IS NOT NULL
  ) dupes 
  WHERE rn > 1
);
```

---

## Files to Modify

| File | Change |
|------|--------|
| New migration | Add unique constraint on `(user_id, task_date, habit_source_id)` |
| `src/hooks/useHabitSurfacing.ts` | Use upsert with `ignoreDuplicates: true` |

---

## Technical Notes

- The constraint is **partial** (only where `habit_source_id IS NOT NULL`) so it doesn't affect regular tasks
- Supabase's JS client supports `upsert` with `ignoreDuplicates` which translates to `ON CONFLICT DO NOTHING`
- This same pattern should also be applied to recurring task spawning (`useRecurringTaskSpawner`) for consistency

