

# Fix Ritual Reordering on Toggle

## Problem

When you check/uncheck a ritual, the rituals visibly "move" or reorder in the list. This happens because:

1. **Identical sort values in database**: All ritual tasks have `sort_order: 0` and many were created at the exact same millisecond
2. **Non-deterministic ordering**: When multiple rows share the same `sort_order` and `created_at`, the database returns them in arbitrary order
3. **Refetch triggers re-render**: Completing a task invalidates the query cache, causing a refetch that returns rituals in a different order

## Solution

Add a **stable, deterministic fallback sort** to ensure rituals always appear in the same order, regardless of database return order.

### Changes Required

| File | Change |
|------|--------|
| `src/components/TodaysAgenda.tsx` | Add tertiary sort by `id` to ensure deterministic ordering |

### Implementation

Update the `sortGroup` function in TodaysAgenda to include task ID as the final tiebreaker:

```text
Current sorting:
  1. sort_order (or scheduled_time/priority/xp)
  2. scheduled_time (secondary)
  → If both are equal, order is random ❌

New sorting:
  1. sort_order (or scheduled_time/priority/xp)
  2. scheduled_time (secondary)
  3. Task ID (final tiebreaker)
  → Order is always consistent ✓
```

### Code Change

In the `sortGroup` function (around line 238-275), after all sorting logic, add:

```typescript
// Final tiebreaker - sort by ID for deterministic ordering
if (orderA === orderB && !a.scheduled_time && !b.scheduled_time) {
  return a.id.localeCompare(b.id);
}
```

This ensures that even when two rituals have:
- Same `sort_order` (both 0)
- Same `scheduled_time` (both null)
- Same `created_at` (same batch creation)

They will still appear in a consistent order based on their unique ID.

## Why This Works

- Task IDs are unique and immutable (UUIDs)
- `localeCompare` on UUIDs provides stable, predictable ordering
- No visual "jumping" even when the database returns data in different order
- Zero impact on user experience - they won't notice the ID-based ordering

## Summary

This is a one-file, minimal change that eliminates the visual glitch without changing any user-facing behavior or requiring database migrations.

