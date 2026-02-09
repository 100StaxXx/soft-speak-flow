
# Rename "Task" to "Quest" in User-Facing Text

## Overview
Update all user-visible strings that reference "task" or "tasks" to use "quest" or "quests" instead. This is a text-only change -- no logic, no variable names, no database columns. Only UI labels, toast messages, placeholders, aria-labels, and descriptions.

## Files and Changes

### 1. `src/pages/Inbox.tsx`
- `"Capture tasks with the + button..."` -> `"Capture quests with the + button..."`
- `"Add a task"` -> `"Add a quest"`
- `aria-label="Edit task"` -> `aria-label="Edit quest"`
- `aria-label="Delete task"` -> `aria-label="Delete quest"`

### 2. `src/components/AddQuestSheet.tsx`
- `"Create Task"` button label -> `"Create Quest"`

### 3. `src/components/TodaysAgenda.tsx`
- `"No tasks for this day"` -> `"No quests for this day"`

### 4. `src/components/calendar/TimelineView.tsx`
- `"Add Task"` inline button -> `"Add Quest"`
- `{/* Inline Add Task Button */}` comment -> `{/* Inline Add Quest Button */}`

### 5. `src/components/scheduler/FocusSchedulerView.tsx`
- `"Tasks"` heading -> `"Quests"`
- `"No tasks for this day"` -> `"No quests for this day"`
- `"Add Task"` buttons (x2) -> `"Add Quest"`
- `{/* Add task button */}` comments -> `{/* Add quest button */}`

### 6. `src/hooks/useTaskMutations.ts`
- `"Task added successfully!"` -> `"Quest added!"`
- `"Failed to add task"` -> `"Failed to add quest"`
- `"Task Complete!"` -> `"Quest Complete!"`
- `"Failed to toggle task"` -> `"Failed to toggle quest"`
- `"Task deleted successfully!"` -> `"Quest deleted!"`
- `"Failed to delete task"` -> `"Failed to delete quest"`
- `"Failed to restore task"` -> `"Failed to restore quest"`
- `"Failed to reorder tasks"` -> `"Failed to reorder quests"`
- `"Failed to move task"` (x2) -> `"Failed to move quest"`
- `"Task moved to ..."` -> `"Quest moved to ..."`

### 7. `src/hooks/useDailyTaskReschedule.ts`
- `"Failed to prioritize tasks"` -> `"Failed to prioritize quests"`
- `"Moved X tasks to tomorrow"` -> `"Moved X quests to tomorrow"`
- `"Failed to move tasks"` -> `"Failed to move quests"`

### 8. `src/hooks/useRecurringTaskSpawner.ts`
- `"Failed to create recurring tasks"` -> `"Failed to create recurring quests"`

### 9. `src/features/tasks/components/SmartTaskInput.tsx`
- `"Failed to create tasks"` -> `"Failed to create quests"`
- `"Failed to break down task..."` -> `"Failed to break down quest..."`

### 10. `src/features/tasks/components/EnhancedTaskCard.tsx`
- `"Delete task"` dropdown item -> `"Delete quest"`

### 11. `src/features/tasks/components/TaskBatchPreview.tsx`
- `"Review Tasks"` dialog title -> `"Review Quests"`
- `"Detected Tasks"` section header -> `"Detected Quests"`
- `{/* Add Task */}` comment -> `{/* Add Quest */}`

### 12. `src/features/tasks/components/DecomposeTaskDialog.tsx`
- `"Failed to add subtasks"` -> `"Failed to add subtasks"` (keep as-is, subtasks are sub-items)

### 13. `src/components/TaskCard.tsx`
- `aria-label="Edit task"` -> `aria-label="Edit quest"`
- `aria-label="Delete task"` -> `aria-label="Delete quest"`

### 14. `src/components/PermissionRequestDialog.tsx`
- `"...to create tasks and chat..."` -> `"...to create quests and chat..."`
- `"...adding tasks faster..."` -> `"...adding quests faster..."`

### 15. `src/features/tasks/components/DependencyPicker.tsx`
- `"Search tasks..."` -> `"Search quests..."`
- `"No tasks found."` -> `"No quests found."`

### 16. `src/features/tasks/components/TaskManagerPanel.tsx`
- `"Add a task..."` placeholder -> `"Add a quest..."`

## What Stays Unchanged
- All variable names, function names, database columns (`task_text`, `task_date`, etc.)
- Internal code comments that are purely technical
- Hook names, component names, file names
- Database query keys
- The word "subtask" (these are sub-items of quests, keeping as-is)
