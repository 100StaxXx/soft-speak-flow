
# Fix: Inbox Task Creation Should Respect Date/Time

## Problem
When creating a task from the Inbox tab via the "+" button, the `handleAddQuest` function always sets `task_date: null` -- meaning every task goes to the inbox regardless of whether the user selected a date/time and clicked "Create Task."

## Solution
Update `handleAddQuest` in `src/pages/Inbox.tsx` to mirror the Journeys page logic: if `data.sendToInbox` is false (i.e., the user picked a date/time and clicked "Create Task"), save the task with the selected date and time so it appears on the Quests page. Only set `task_date: null` when the user explicitly clicks "Add to Inbox."

## Changes

### `src/pages/Inbox.tsx` -- Update `handleAddQuest`

Current code always forces `task_date: null`. The fix:

- If `data.sendToInbox` is `true` (or no date selected): set `task_date: null` (inbox behavior, as today)
- If `data.sendToInbox` is `false`: set `task_date` to the selected date (formatted as `yyyy-MM-dd`), plus pass through `scheduled_time`, `estimated_duration`, `difficulty`, and other fields from the `AddQuestData` object

This matches how `Journeys.tsx` handles the same callback, ensuring tasks with a date/time land on the Quests timeline instead of the inbox.

Also invalidate `["daily-tasks"]` queries when a scheduled task is created, so the Quests page reflects it immediately.
