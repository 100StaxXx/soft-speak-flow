

# Two-Step Quest Creation with Campaign Link in Footer

## Overview

Redesign AddQuestSheet into a two-step wizard flow, skip the CreationPickerSheet entirely, and add a "Create Campaign" link in the footer.

## Step-by-Step Flow

```text
FAB tap
  |
  v
[Step 1: Title + Difficulty]
- Quest name input (auto-focused)
- Difficulty selector (circular icons from HabitDifficultySelector)
- "Advanced Settings" collapsible (contact, recurrence, reminders, location, photo)
- "Next" button
  |
  v
[Step 2: Date/Time Selection]
- Date picker (calendar popover, defaulting to selectedDate)
- Time picker (scrollable time wheel inspired by the Structured reference image)
- Duration quick-select chips (15m, 30, 45, 1h, 1.5h)
- Suggested Time Slots (smart scheduling)
- Footer: "Schedule Quest" button + "Add to Inbox" link (skips date/time)
- Small "Or create a Campaign" link at bottom
```

## File Changes

### 1. Redesign `src/components/AddQuestSheet.tsx`

- Remove the minimal/expanded two-mode pattern entirely
- Introduce a `step` state: `1` (title + settings) and `2` (date/time)
- **Step 1**: Full-height Sheet (matching EditQuestDialog style) with:
  - Quest Name input (labeled, auto-focused)
  - `HabitDifficultySelector` (same circular icons as Edit Quest)
  - Collapsible "Advanced Settings" section containing: recurrence, reminders, contact linking, location
  - "Next" button in footer (disabled until title is non-empty)
- **Step 2**: Same Sheet, content swaps to date/time selection:
  - Date row with Calendar popover (same pattern as EditQuestDialog)
  - Time input and Duration input in side-by-side grid (same as EditQuestDialog)
  - SuggestedTimeSlots component
  - Footer: "Add Quest" primary button + "Add to Inbox" secondary button (sets sendToInbox=true, skips date/time)
  - Small subtle "Or create a Campaign" text link at the very bottom
- Back button on Step 2 to return to Step 1

### 2. Update `src/pages/Journeys.tsx`

- FAB `onTap` opens AddQuestSheet directly (remove `showCreationPicker` state and `CreationPickerSheet` usage)
- Add a `showPathfinder` handler that can be triggered from AddQuestSheet's "Create Campaign" link
- Pass an `onCreateCampaign` callback prop to AddQuestSheet

### 3. Update `src/pages/Inbox.tsx`

- Same change: FAB opens AddQuestSheet directly, remove CreationPickerSheet usage

### 4. `src/components/CreationPickerSheet.tsx`

- No longer imported anywhere in the default flow (can be kept for future use or removed)

## Technical Details

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` | Full rewrite: two-step wizard (title+settings then date/time), match EditQuestDialog styling, add "Add to Inbox" and "Create Campaign" links |
| `src/pages/Journeys.tsx` | FAB opens AddQuestSheet directly; pass `onCreateCampaign` prop; remove CreationPickerSheet |
| `src/pages/Inbox.tsx` | FAB opens AddQuestSheet directly; remove CreationPickerSheet |
| `src/components/CreationPickerSheet.tsx` | No longer used in default flow |

## What Stays the Same

- All form data fields (difficulty, time, recurrence, reminders, contacts, inbox toggle)
- `onAdd` callback and submit logic
- EditQuestDialog (unchanged)
- Database schema
- FAB component itself

