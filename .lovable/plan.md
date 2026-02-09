

# Redesign Edit Quest Dialog to Match Add Quest Layout

## Problem
The Edit Quest dialog uses a traditional form layout (labeled inputs, date picker, etc.) that looks different from the Add Quest sheet's step 2. The user wants them to match visually.

## Solution
Rewrite the `EditQuestDialog` to mirror the Add Quest sheet's step 2 layout, with an editable title in the header.

## Key UI Elements to Copy from AddQuestSheet Step 2

1. **Difficulty-colored header banner** with back arrow, editable title (instead of read-only), summary line (duration + date), and close button
2. **Duration row** -- tappable, expands to duration chips (1m, 15m, 30m, 45m, 1h, 1.5h, All Day, Custom)
3. **Date and Time chips** side by side (calendar popover + time wheel picker)
4. **Subtasks + Notes card** -- subtask rows with checkboxes, "Add Subtask" row, and notes textarea
5. **Advanced Settings** collapsible section (recurrence, reminders, location, contact linking)
6. **Footer** with "Save Changes" button (replaces "Create Task") and "Delete" button (replaces "Add to Inbox")

## Changes

### `src/features/quests/components/EditQuestDialog.tsx` -- Full Rewrite

**Header**: Difficulty-colored banner with:
- Back/close buttons
- Editable Input for task title (instead of static text)
- Summary line showing duration + date

**Body** (scrollable, matches AddQuestSheet step 2):
- Duration row (tappable, expands to chip selector with same DURATION_OPTIONS)
- Date + Time chips side by side (same calendar popover + time wheel)
- Subtasks card (fetch existing subtasks via `useSubtasks` hook, allow add/edit/delete)
- Notes textarea
- Photo section (existing QuestImagePicker)
- Advanced Settings collapsible (recurrence, reminders, location)

**Footer**:
- "Save Changes" primary button (difficulty-colored)
- "Delete" destructive button (if onDelete provided)

### Dependencies to Import
- Reuse same helper functions: `formatTime12`, `generateTimeSlots`, `DURATION_OPTIONS`, `DIFFICULTY_COLORS`, `DifficultyIcon` from AddQuestSheet (or extract shared constants)
- Import `useSubtasks` from `@/features/tasks/hooks` to load/manage subtasks for the task being edited
- Import `Collapsible` components, `Textarea`, `Checkbox` same as AddQuestSheet

### What Stays the Same
- Props interface (`EditQuestDialogProps`) stays the same
- `onSave` callback signature stays the same
- Delete confirmation dialog stays the same
- Sheet-based bottom drawer stays the same

### Technical Notes
- No step wizard needed (edit goes straight to the "step 2" view)
- Title is editable in the header Input field (not read-only like AddQuestSheet step 2)
- Difficulty selector: small icons in header (same as AddQuestSheet step 1's compact selector) since users need to change difficulty too
- Subtasks: load existing subtasks on open via `useSubtasks(task.id)`, wire up add/edit/delete
- The constants (DIFFICULTY_COLORS, DURATION_OPTIONS, TIME_SLOTS, formatTime12) should be extracted to a shared file to avoid duplication

### New Shared File: `src/components/quest-shared.ts`
Extract from AddQuestSheet:
- `DIFFICULTY_COLORS`
- `DifficultyIcon`
- `formatTime12`
- `generateTimeSlots` / `TIME_SLOTS`
- `DURATION_OPTIONS`

Update AddQuestSheet to import from this shared file instead of defining inline.
