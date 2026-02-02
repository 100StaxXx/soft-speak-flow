
# Fix Frequency Not Reflecting Current Recurrence Setting in Edit Ritual Menu

## Problem

When editing a ritual from the Quests view, the "Frequency" section shows "Custom" but no days are selected. The frequency picker should show the actual recurrence setting for the ritual (e.g., if the ritual runs on specific days, those days should be highlighted).

## Root Cause

When opening the Edit Ritual sheet from a **task** in `Journeys.tsx`, the ritual data is constructed from the task object:

```typescript
setEditingRitual({
  habitId: task.habit_source_id,
  taskId: task.id,
  title: task.task_text,
  // ... other task fields
  recurrence_pattern: task.recurrence_pattern,
  recurrence_days: task.recurrence_days,
  // ❌ MISSING: frequency and custom_days
});
```

The `frequency` and `custom_days` fields are stored on the **habit** (template), not on the task. Since they're not passed, `EditRitualSheet` defaults to `"daily"` and the day picker shows empty.

In contrast, when opening from `EpicCheckInDrawer`, it correctly passes the habit's `frequency` and `custom_days`.

---

## Solution

When opening the Edit Ritual sheet from a task in `Journeys.tsx`, look up the source habit to get its `frequency` and `custom_days`:

### Option 1: Fetch Habit Data Inline (Recommended)

When a ritual task is clicked, fetch the habit data before setting `editingRitual`:

```typescript
const handleEditTask = useCallback(async (task) => {
  if (task.habit_source_id) {
    // Fetch the habit to get frequency and custom_days
    const { data: habit } = await supabase
      .from('habits')
      .select('frequency, custom_days, description')
      .eq('id', task.habit_source_id)
      .single();
    
    setEditingRitual({
      habitId: task.habit_source_id,
      taskId: task.id,
      title: task.task_text,
      description: habit?.description || null,
      difficulty: task.difficulty || 'medium',
      frequency: habit?.frequency || 'daily',        // ✅ From habit
      custom_days: habit?.custom_days || [],          // ✅ From habit
      estimated_minutes: task.estimated_duration,
      preferred_time: task.scheduled_time,
      category: task.category,
      recurrence_pattern: task.recurrence_pattern,
      recurrence_days: task.recurrence_days,
      reminder_enabled: task.reminder_enabled,
      reminder_minutes_before: task.reminder_minutes_before,
    });
  } else {
    setEditingTask(task);
  }
}, []);
```

---

## File Changes

| File | Change |
|------|--------|
| `src/pages/Journeys.tsx` | Update `handleEditTask` to fetch habit data for `frequency` and `custom_days` |

---

## Technical Notes

- The fetch is fast since it's a single row lookup by primary key
- This ensures the Edit Ritual sheet always has the source-of-truth frequency data from the habit template
- The `recurrence_days` from the task can be used as a fallback, but `custom_days` from the habit is the authoritative source

## Result

After this change:
- Opening Edit Ritual from any task will show the correct frequency preset selected (Daily, Weekdays, Weekly, or Custom)
- If Custom, the specific days will be highlighted in the day picker
- The frequency setting will match what was configured when the ritual was created
