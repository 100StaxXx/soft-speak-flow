

# Fix Habit Surfacing Error

## Why It's Happening Now

The code hasn't changed - this is likely a **data timing issue**. The upsert approach works when there's no conflict, but fails when:
- Multiple habit surfacing calls happen simultaneously (race condition)
- The partial unique index can't be matched by the Supabase JS client

## Solution

Replace the upsert with a safer "filter-then-insert" pattern that avoids the conflict entirely.

## Technical Changes

### File: `src/hooks/useHabitSurfacing.ts`

**Current code (lines 151-162):**
```typescript
const { data, error } = await supabase
  .from('daily_tasks')
  .upsert(tasks, { 
    onConflict: 'user_id,task_date,habit_source_id',
    ignoreDuplicates: true 
  })
  .select('id');
```

**New approach:**
```typescript
// First, get all existing habit tasks for today to filter duplicates
const { data: existingTasks } = await supabase
  .from('daily_tasks')
  .select('habit_source_id')
  .eq('user_id', user.id)
  .eq('task_date', taskDate)
  .not('habit_source_id', 'is', null);

const existingHabitIds = new Set(existingTasks?.map(t => t.habit_source_id) || []);

// Filter out habits that already have tasks
const newTasks = tasks.filter(t => !existingHabitIds.has(t.habit_source_id));

if (newTasks.length === 0) {
  return [];
}

// Insert only new tasks
const { data, error } = await supabase
  .from('daily_tasks')
  .insert(newTasks)
  .select('id');
```

## Why This Works

- Explicitly checks for existing tasks before inserting
- Avoids the upsert/partial index compatibility issue entirely
- Same end result: only one task per habit per day

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useHabitSurfacing.ts` | Replace upsert with check-then-insert pattern in `surfaceAllHabits` mutation |

