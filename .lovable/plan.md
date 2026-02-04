

# Filter Rituals from Widget - Show Only Quests

## Problem

The widget currently displays all tasks including rituals generated from campaigns, making it overcrowded. You want to show only regular quests (manually created tasks) in the widget.

## Solution

Filter out ritual tasks before syncing to the widget by checking for the `habit_source_id` field. Tasks with a `habit_source_id` are rituals spawned from habits/campaigns; tasks without it are regular quests.

## Technical Change

### File: `src/hooks/useWidgetSync.ts`

Add a filter before mapping tasks to widget format:

```typescript
// Before mapping, filter out rituals (tasks from habits/campaigns)
const questsOnly = tasks.filter(task => !task.habit_source_id);

// Map quests to widget format (limit to 10)
const widgetTasks: WidgetTask[] = questsOnly.slice(0, 10).map(task => ({
  // ... existing mapping
}));

// Update counts to reflect quests only
await WidgetData.updateWidgetData({
  tasks: widgetTasks,
  completedCount: questsOnly.filter(t => t.completed).length,
  totalCount: questsOnly.length,
  date: taskDate,
});
```

Also update the fingerprint to use filtered tasks:

```typescript
const questsOnly = tasks.filter(task => !task.habit_source_id);

const fingerprint = JSON.stringify({
  count: questsOnly.length,
  completed: questsOnly.filter(t => t.completed).length,
  ids: questsOnly.slice(0, 10).map(t => t.id + ':' + t.completed),
  date: taskDate,
});
```

## Result

| Before | After |
|--------|-------|
| Widget shows 8/8 (all tasks) | Widget shows 3/3 (quests only) |
| Includes rituals from campaigns | Only manually created quests |
| Overcrowded display | Clean, focused list |

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useWidgetSync.ts` | Filter out tasks where `habit_source_id` is not null |

