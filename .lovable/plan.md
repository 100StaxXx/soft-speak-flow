

# Fix Bad Habits Not Appearing After Adding

## Problem
When you add a bad habit, the toast says "Bad habit added!" but the list still shows "No habits tracked yet." The data saves correctly to the database (confirmed in network logs and DB), but the UI never updates.

## Root Cause
The mutation's `onSuccess` calls `invalidateQueries({ queryKey: ['bad-habits'] })`, which should trigger a refetch for the active query keyed as `['bad-habits', userId]`. However, the refetch is not firing (zero GET requests appear in the network after any POST). This is likely due to the component being wrapped in `memo` combined with the Dialog portal interaction preventing React Query from recognizing the query as actively observed.

## Fix

**File: `src/hooks/useResistMode.ts`** (lines 77-103, the `addHabitMutation`)

Update the `onSuccess` callback to directly update the query cache with the returned data from the mutation, then invalidate as a background refresh:

```typescript
onSuccess: (newHabit) => {
  // Immediately add the new habit to the cache
  queryClient.setQueryData(
    ['bad-habits', user?.id],
    (old: BadHabit[] | undefined) => [newHabit, ...(old ?? [])]
  );
  // Also invalidate to ensure full consistency
  queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
  toast.success('Bad habit added! Ready to resist.');
},
```

Also apply the same pattern to `removeHabitMutation` for consistency -- optimistically remove from cache before the invalidation:

```typescript
onSuccess: (_data, habitId) => {
  queryClient.setQueryData(
    ['bad-habits', user?.id],
    (old: BadHabit[] | undefined) => (old ?? []).filter(h => h.id !== habitId)
  );
  queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
  toast.success('Habit removed');
},
```

## Why This Works
Instead of relying on `invalidateQueries` to trigger a refetch (which isn't firing), we directly update the cached data with `setQueryData`. This guarantees the UI updates immediately since React Query notifies all subscribers when cache data changes. The background `invalidateQueries` still runs to ensure eventual consistency.

## Technical Details
- One file changed: `src/hooks/useResistMode.ts`
- Two mutations updated: `addHabitMutation` and `removeHabitMutation`
- The mutation already returns the new habit data via `.select().single()`, so no additional DB calls needed
