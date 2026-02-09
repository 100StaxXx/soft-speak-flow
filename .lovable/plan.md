

# Fix "Add to Inbox Instead" from Quests Page

## Problem

When clicking "Add to Inbox Instead" from the Quests/Journeys page, the task still gets a date instead of going to the Inbox. Two issues cause this:

1. **`AddTaskParams.taskDate` is typed as `string`** (line 42 in `useTaskMutations.ts`), not `string | null`. This means `null` can't be passed properly.

2. **`Journeys.tsx` line 255** casts `null` to `string` with `taskDate as string`, which silently loses the `null` value.

## Fix

| File | Change |
|---|---|
| `src/hooks/useTaskMutations.ts` (line 42) | Change `taskDate?: string` to `taskDate?: string \| null` in `AddTaskParams` |
| `src/pages/Journeys.tsx` (line 255) | Remove the `as string` cast so `null` flows through correctly: change to `taskDate: taskDate,` |

These two small changes will allow `null` to propagate all the way to the database insert, correctly creating an inbox task (no date).

