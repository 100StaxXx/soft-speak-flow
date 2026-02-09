
# Split Add Quest into Two-Step Wizard

## Overview

Split the current single-screen layout back into a two-step wizard, and remove the duplicated duration/time fields from Advanced Settings.

## Step 1: Title and Difficulty

The colored banner with:
- Quest title input (auto-focused)
- Difficulty circle selector (easy/medium/hard)
- "Next" button in footer (disabled until title is non-empty)

## Step 2: Scheduling and Details

Everything else:
- Duration row (tappable, expands to chips)
- Date and Time chips (side by side)
- Time wheel (when time chip tapped)
- Subtasks + Notes card
- Advanced Settings collapsible (recurrence, reminders, contact linking, location -- **without** the `scheduledTime`, `estimatedDuration`, and `moreInformation` fields since those are already on this page)
- Footer: "Create Task" (disabled without date+time), "Add to Inbox", "Or create a Campaign"
- Back button to return to Step 1

## Technical Details

### `src/components/AddQuestSheet.tsx`

- Add `step` state (`1 | 2`), default to `1`
- **Step 1** renders: colored banner (title + difficulty) + "Next" footer button
- **Step 2** renders: colored banner (read-only summary) + duration, date/time, subtasks, notes, advanced settings, footer
- Back arrow on Step 2 header to go to Step 1
- Reset `step` to `1` on close

### `src/components/AdvancedQuestOptions.tsx`

- Add optional props `hideScheduledTime`, `hideDuration`, `hideMoreInformation` (all default `false`)
- When `true`, skip rendering the corresponding sections
- `AddQuestSheet` passes all three as `true` since those fields already exist on the main Step 2 UI

### Files Changed

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` | Add `step` state, split render into Step 1 (title+difficulty) and Step 2 (scheduling+details), back button on Step 2 |
| `src/components/AdvancedQuestOptions.tsx` | Add `hideScheduledTime`, `hideDuration`, `hideMoreInformation` props to conditionally skip those sections |
