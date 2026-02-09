

# Fix "Add to Inbox Instead" Bug

## Problem

When clicking "Add to Inbox Instead", the task is created with today's date instead of `null` (which would make it an inbox task). The root cause is in `src/hooks/useTaskMutations.ts`.

On line 98, this code:
```
task_date: params.taskDate || taskDate
```
uses the `||` operator, which treats `null` as falsy and falls back to `taskDate` (today's date). Since inbox tasks need `task_date` to be `null`, the task ends up assigned to today instead of the inbox.

The same issue exists on line 83 where it counts existing tasks -- it would fail when `taskDate` is `null`.

## Fix

**File: `src/hooks/useTaskMutations.ts`**

1. **Line 83**: Change `params.taskDate || taskDate` to `params.taskDate !== undefined ? params.taskDate : taskDate` so that when `taskDate` is explicitly `null`, it stays `null`.

2. **Line 98**: Same change -- use an explicit undefined check instead of `||` so that `null` is preserved for inbox tasks.

3. **Line 83 area**: When `taskDate` is `null` (inbox), skip the max-tasks counting query or adjust it to query for `task_date IS NULL` instead.

| File | Line | Change |
|---|---|---|
| `src/hooks/useTaskMutations.ts` | 83 | Use explicit `null` check so inbox tasks query correctly |
| `src/hooks/useTaskMutations.ts` | 98 | Replace `params.taskDate \|\| taskDate` with `params.taskDate !== undefined ? params.taskDate : taskDate` to preserve `null` |

