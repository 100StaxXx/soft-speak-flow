

# Remove Day View from Calendar Modal -- Go Straight to Month View

## Overview

When users tap the date header in the Quests tab, the modal currently opens in "Day View" with an option to switch to "Month View". The change removes the Day View entirely so the modal opens directly into Month View.

## Changes

### 1. HourlyViewModal: Remove Day View

**File: `src/components/HourlyViewModal.tsx`**

- Remove the `ViewMode` type and `viewMode` state -- always render Month View
- Remove the Day/Month dropdown `Select` in the header
- Remove the day navigation chevrons (prev/next day buttons)
- Remove the `CalendarDayView` import and its rendering branch
- Remove day-specific auto-scroll logic
- Simplify header to just show "Month View" title with close button
- When a date is tapped in month view, close the modal and navigate to that date on the Quests timeline (instead of switching to day view)
- Keep the Year View flow intact (accessible from month view)

### 2. Update TodaysAgenda Integration

**File: `src/components/TodaysAgenda.tsx`**

- When a date is selected from the month modal, close the modal and set the selected date (scrolling the timeline to that day)
- No other changes needed since TodaysAgenda already has `onDateSelect`

### 3. Cleanup

- Remove `CalendarDayView` import from `HourlyViewModal.tsx`
- The `CalendarDayView` component file itself stays (it may be used elsewhere like the Community/Calendar page)

## Files Changed

| File | Change |
|---|---|
| `src/components/HourlyViewModal.tsx` | Remove day view mode, default to month, simplify header |
| `src/components/TodaysAgenda.tsx` | Minor: ensure date selection from modal closes it and navigates |

