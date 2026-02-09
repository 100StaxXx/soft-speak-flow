

# Add Inbox as a New Bottom Nav Tab

## Overview

Add an "Inbox" tab to the left of Quests in the bottom navigation. This gives undated tasks their own dedicated page instead of being a collapsible section inside the Quests timeline.

## Navigation Order (left to right)

Mentor | Inbox | Quests | Companion

## Changes

### 1. Create Inbox Page

**New file: `src/pages/Inbox.tsx`**

A simple page that:
- Uses the existing `useInboxTasks` hook for data
- Renders a list of undated tasks with toggle, delete, and "schedule" actions
- Has a header with the inbox count
- Includes the FAB (+) button for adding new tasks (reuses `CreationPickerSheet`)
- Each task card has a "Schedule" action that lets users pick a date, moving it to the Quests timeline
- Empty state: friendly message like "Your inbox is empty -- capture tasks with the + button"

### 2. Add Route

**File: `src/App.tsx` (or router config)**

Add route: `<Route path="/inbox" element={<Inbox />} />`

### 3. Update Bottom Nav

**File: `src/components/BottomNav.tsx`**

- Add a new `NavLink` for `/inbox` between Mentor and Quests
- Icon: `Inbox` from lucide-react
- Show unread count badge when inbox has tasks
- Add prefetch entry for the Inbox page
- Color accent: a distinct color (e.g., cyan/teal) to differentiate from Quests purple

### 4. Remove Inbox Section from TodaysAgenda

**File: `src/components/TodaysAgenda.tsx`**

- Remove the collapsible "Inbox" section at the bottom of the timeline since it now has its own tab
- Keep the timeline focused on scheduled + anytime tasks only

### 5. Update AddQuestSheet "Send to Inbox"

**File: `src/components/AddQuestSheet.tsx`**

- The "Send to Inbox" toggle stays as-is; tasks created with it will appear on the new Inbox page

## Technical Details

| File | Action |
|---|---|
| `src/pages/Inbox.tsx` | **New** -- Dedicated inbox page with task list, schedule actions, FAB |
| `src/App.tsx` | Add `/inbox` route |
| `src/components/BottomNav.tsx` | Add Inbox NavLink between Mentor and Quests, with count badge |
| `src/components/TodaysAgenda.tsx` | Remove collapsible inbox section |

## What Stays the Same

- `useInboxTasks` hook (already built, no changes needed)
- Database schema (already supports `task_date = NULL`)
- FAB and CreationPickerSheet flow
- All existing task mutation logic

