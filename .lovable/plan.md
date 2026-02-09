

# Replace Quest Input with "+" FAB and Creation Type Picker + Inbox Feature

## Overview

Replace the current text-box-and-send-arrow quest creation flow with a floating "+" button (FAB) in the bottom right. Tapping it opens a sheet asking whether to create a **Quest** or a **Campaign**. Additionally, introduce an **Inbox** concept: tasks without a date or time, accessible from the Quests tab.

---

## Changes

### 1. Add "+" FAB to Journeys Page

The `DraggableFAB` component already exists but is unused. Wire it into `src/pages/Journeys.tsx` so it appears above the bottom nav. Tapping it opens a new **Creation Picker** sheet instead of directly opening AddQuestSheet.

**File:** `src/pages/Journeys.tsx`
- Import and render `DraggableFAB` with `onTap` opening the new picker
- Remove the `onAddQuest={() => setShowAddSheet(true)}` prop from TodaysAgenda (the FAB replaces it)

### 2. Create "Creation Picker" Sheet

A new bottom drawer component that presents two options:
- **Quest** -- with a brief description like "A task for today or any day"
- **Campaign** -- "A multi-day journey with rituals and milestones"

Selecting Quest opens the existing `AddQuestSheet`. Selecting Campaign opens the existing `Pathfinder` wizard.

**New file:** `src/components/CreationPickerSheet.tsx`
- Simple Drawer with two tappable cards (icon + label + subtitle)
- Props: `open`, `onOpenChange`, `onSelectQuest`, `onSelectCampaign`

### 3. Remove Inline CompactSmartInput from TodaysAgenda

Currently, TodaysAgenda renders a text input at the bottom of the task list for quick-add. This will be removed since the FAB is the new entry point for creation.

**File:** `src/components/TodaysAgenda.tsx`
- Remove the `CompactSmartInput` rendering (around lines 835-840 and 913-920)
- Keep the empty-state messaging but replace the input with a prompt to "Tap + to add your first quest"
- Remove the `onAddQuest` button/usage since the FAB handles it globally

### 4. Add Inbox Support

#### 4a. Database: Allow null task_date

Tasks in the `daily_tasks` table currently require a `task_date`. Inbox tasks are tasks with `task_date = NULL` (no assigned date).

**Migration:** `ALTER TABLE daily_tasks ALTER COLUMN task_date DROP NOT NULL;`

Also add an index for fast inbox queries:
`CREATE INDEX idx_daily_tasks_inbox ON daily_tasks(user_id) WHERE task_date IS NULL AND completed = false;`

#### 4b. Inbox Hook

**New file:** `src/hooks/useInboxTasks.ts`
- Fetches tasks where `task_date IS NULL` and `completed = false`
- Supports add, toggle, delete, and "schedule" (assign a date to move out of inbox)

#### 4c. Inbox UI in TodaysAgenda

Add an expandable "Inbox" section at the bottom of TodaysAgenda (below quests and campaigns). Shows a collapsed count badge by default; expands to show undated tasks. Users can drag an inbox task onto a date pill to schedule it.

**File:** `src/components/TodaysAgenda.tsx`
- Add collapsible Inbox section with task count badge
- Each inbox task can be tapped to edit (assign date/time) or swiped to delete

#### 4d. AddQuestSheet: "No Date" Option

When creating a quest via AddQuestSheet, add an option to skip the date (send to inbox). This means the quest gets `task_date: null`.

**File:** `src/components/AddQuestSheet.tsx`
- In expanded mode, add a toggle or chip: "Add to Inbox (no date)" that sets task_date to null
- Adjust the `onAdd` callback to pass `null` date when inbox is selected

---

## Summary of Files

| File | Action |
|---|---|
| `src/components/CreationPickerSheet.tsx` | **New** -- Quest vs Campaign picker drawer |
| `src/pages/Journeys.tsx` | Add DraggableFAB, wire to CreationPickerSheet, connect Quest/Campaign flows |
| `src/components/TodaysAgenda.tsx` | Remove inline CompactSmartInput, add Inbox section |
| `src/components/AddQuestSheet.tsx` | Add "Send to Inbox" toggle (no date) |
| `src/hooks/useInboxTasks.ts` | **New** -- hook for fetching/managing undated tasks |
| Database migration | Allow nullable `task_date`, add inbox index |

