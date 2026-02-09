

# Redesign Add Quest Wizard to Match Structured Reference

## Overview

Consolidate the wizard into a single-screen layout (matching the uploaded Structured screenshot), add subtask support with dynamic rows, and conditionally disable the "Create Task" button when no date/time is selected.

## New Layout (Single Screen, Top to Bottom)

```text
+------------------------------------------+
| [X]                                      |
|                                          |
| [Difficulty Icon]  15 min - Inbox        |
|                    Quest Title (editable) |
|        [Difficulty circle selector]      |
+------ colored banner --------------------+
|                                          |
| [clock] 15 min                        >  |  <- Duration row (tappable, opens chips)
|                                          |
| [Date chip]  [Time chip]                 |  <- Side-by-side pill buttons
|                                          |
| +--------------------------------------+ |
| | [ ] Add Subtask                      | |  <- Checkbox + inline input
| |--------------------------------------|  |
| | Add notes, meeting links or          | |  <- Notes textarea
| | phone numbers...                     | |
| +--------------------------------------+ |
|                                          |
| (Advanced Settings - collapsible)        |
|                                          |
|       [ Create Task ]                    |  <- Disabled if no date AND time
|    Add to Inbox instead                  |
|    Or create a Campaign                  |
+------------------------------------------+
```

## Key Changes

### 1. Remove the Two-Step Wizard

Merge Steps 1 and 2 into a single screen. The colored banner at top contains the title input (editable inline), difficulty selector, and summary info. Below the banner: duration, date/time chips, subtasks, notes, advanced settings, and footer buttons.

### 2. Colored Header Banner (Editable)

- Difficulty icon + summary line ("15 min - Inbox" or "15 min - Mon, Feb 9")
- Quest title as an editable input field inside the banner
- Difficulty circle selector below the title (same HabitDifficultySelector)

### 3. Duration Row

- A tappable row showing "[clock icon] 15 min >" that expands to show duration chips when tapped
- Replaces the current dedicated Duration section

### 4. Date and Time Chips

- Two side-by-side pill buttons: "Date" and "Time"
- Date chip opens a Calendar popover; shows "Date" when unset, formatted date when set
- Time chip opens a time picker popover or inline selector; shows "Time" when unset
- Both are optional -- user can skip them entirely

### 5. Subtask Section

- A dark card containing:
  - A checkbox + "Add Subtask" placeholder input
  - When the user types and presses Enter (or moves to next line), a new empty subtask row appears below
  - Each subtask row: checkbox (unchecked) + text input + delete button on hover/tap
  - Subtasks are stored in local state as `string[]` and passed to the `onAdd` callback
- Add `subtasks: string[]` to `AddQuestData` interface

### 6. Notes Textarea

- Below subtasks in the same card: a "Add notes, meeting links or phone numbers..." textarea
- Maps to existing `moreInformation` field

### 7. Conditional "Create Task" Button

- "Create Task" (renamed from "Add Quest") is **disabled** unless both date AND time are selected
- "Add to Inbox instead" always available (requires only title)
- "Or create a Campaign" link stays at bottom

### 8. Advanced Settings

- Collapsible dropdown below notes, containing recurrence, reminders, contact linking, location

## Data Changes

- Add `subtasks: string[]` to `AddQuestData` interface
- Consumers (`Journeys.tsx`, `Inbox.tsx`, `Community.tsx`) will receive `subtasks` and can use the existing `useSubtasks` hook's `bulkAddSubtasks` to persist them after task creation

## Files Changed

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` | Full redesign: single screen, inline title in banner, duration row, date/time chips, subtask rows, notes, conditional button state |
| `src/pages/Journeys.tsx` | Handle new `subtasks` field from `AddQuestData` -- call `bulkAddSubtasks` after task insert |
| `src/pages/Inbox.tsx` | Same: handle `subtasks` field |
| `src/pages/Community.tsx` | Same: handle `subtasks` field |

