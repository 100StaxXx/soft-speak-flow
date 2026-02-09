

# Redesign Add Quest Step 2 to Match Structured Style

## Overview

Redesign the scheduling step (Step 2) of the Add Quest wizard to match the Structured app's visual style: a colored header banner with task info, a scrollable time wheel picker, and duration chip buttons.

## Visual Layout (Top to Bottom)

```text
+------------------------------------------+
| [X]                                      |  <- Close button
| [Difficulty Icon]  9:45 - 10:30 AM (45m) |  <- Colored banner with
|                    Quest Title            |     difficulty-based color
+------------------------------------------+
| [Calendar] Mon, Feb 9, 2026   Today >    |  <- Date row
+------------------------------------------+
| Time                              [...]  |  <- Section label
| +--------------------------------------+ |
| |         9:00 AM                      | |  <- Scrollable time wheel
| |         9:15 AM                      | |     (15-min increments)
| |       [ 9:45 - 10:30 AM ]           | |  <- Selected = highlighted pill
| |        10:45 AM                      | |
| |        11:00 AM                      | |
| +--------------------------------------+ |
+------------------------------------------+
| Duration                          [...]  |
| [ 1 ] [ 15 ] [ 30 ] [45m] [ 1h ] [1.5h] |  <- Chip buttons
+------------------------------------------+
| (Advanced Settings - collapsible)        |
+------------------------------------------+
|         [ Add Quest ]                    |  <- Primary action
|     Add to Inbox instead                 |
|     Or create a Campaign                 |
+------------------------------------------+
```

## Changes

### File: `src/components/AddQuestSheet.tsx` -- Step 2 Redesign

**1. Colored Header Banner**
- Add a banner at the top of Step 2 with a background color based on difficulty (easy=green, medium=amber/coral, hard=red)
- Show the difficulty icon (from HabitDifficultySelector), time range text (e.g., "9:45 - 10:30 AM (45 min)"), and the quest title
- Include an X close button in the top-left corner

**2. Date Row**
- Replace the current Popover-based date picker button with a horizontal row:
  - Left: Calendar emoji/icon + formatted date ("Mon, Feb 9, 2026")
  - Right: "Today >" shortcut button that jumps to today's date
- Tapping the date text still opens the Calendar popover
- Styled as a dark card/row with rounded corners (matching Structured's dark cards)

**3. Scrollable Time Wheel**
- Replace the HTML `<input type="time">` with a custom scrollable time picker
- Generate time slots in 15-minute increments (6:00 AM through 11:45 PM)
- Display as a vertical scrollable list inside a rounded dark container
- Selected time is highlighted with a colored pill (matching difficulty color)
- Show time range (start time - end time based on duration) on the selected pill
- Auto-scroll to center the selected time on mount
- Unselected times fade out proportionally from center (opacity gradient)

**4. Duration Chip Buttons**
- Replace the number `<input>` with a horizontal row of pill/chip buttons
- Options: 1m, 15m, 30m, 45m, 1h, 1.5h (mapping to 1, 15, 30, 45, 60, 90 minutes)
- Selected chip gets the difficulty accent color
- Styled inside a dark rounded container to match the time picker aesthetic

**5. Footer**
- Keep "Add Quest" primary button, "Add to Inbox instead", and "Or create a Campaign" link
- Style the primary button with the difficulty accent color (coral/salmon like Structured)

**6. Advanced Settings**
- Keep the collapsible section below duration, before footer
- No visual changes needed

### File: `src/components/AddQuestSheet.tsx` -- Step 1 Minor Adjustments

- No major changes, but the "Next" button could adopt the difficulty accent color for consistency

## Technical Details

- The time wheel is a scrollable `div` with `overflow-y: auto` and `snap-type: y mandatory` for smooth snapping
- Each time slot is a button with `scroll-snap-align: center`
- Use `useEffect` + `scrollIntoView` to auto-center the selected time
- Difficulty color map: `{ easy: 'emerald', medium: 'rose/coral', hard: 'red' }`
- The header banner dynamically updates its time range text as time/duration change
- Duration chips are simple toggle buttons in a flex row

## Files Changed

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` | Redesign Step 2: colored banner header, date row with "Today" shortcut, scrollable time wheel, duration chips, accent-colored footer button |

