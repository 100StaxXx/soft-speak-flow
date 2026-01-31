

# Improve Schedule Visibility & Editing for Rituals

## Problem Summary

Users can't easily see or edit **which days** their rituals are scheduled for:

| Location | Current State | Issue |
|----------|---------------|-------|
| Campaign Creation → Habit List | Shows "Daily" or "Custom days" | Doesn't show **which** custom days |
| Campaign → Rituals Drawer | Shows "Daily" or "3x per week" etc | No day-level detail |
| Edit Ritual Sheet | Has frequency dropdown + day picker | Day picker only appears for "custom" frequency |
| Quests → Advanced Options | Same as Edit Ritual | No "every other X" type patterns |

---

## Solution Overview

### Part 1: Show Schedule Summary in Lists

Add a visual day indicator chip to show exactly which days a ritual is scheduled:

**In `EpicHabitList.tsx` (Campaign Creation):**
```
[Morning Run] Easy · M T W T F
             ^^^^^^^^^^^^^^^^^
             New: show selected days as small letters
```

**In `EpicCheckInDrawer.tsx` (Rituals drawer):**
```
[Sleep Optimization] Daily          → Shows "Daily"
[Resistance Training] M W F         → Shows actual days
```

---

### Part 2: Always Show Day Picker in Edit Ritual Sheet

Currently the day picker only appears when frequency = "custom". Change to always show day selection so users can:
1. See their current schedule
2. Quickly change which days without switching to "custom" first

---

### Part 3: Add Frequency Presets Component

Create a unified `FrequencyPresets` style component for the Edit Ritual Sheet that shows:
- Quick presets: Daily, Weekdays, 3x/wk, Weekly, Custom
- Day chips that update based on preset selection
- Users can click individual days to customize

This already exists in `src/components/Pathfinder/FrequencyPresets.tsx` - reuse this pattern.

---

## Implementation Details

### Files to Modify

| File | Change |
|------|--------|
| `src/components/EpicHabitList.tsx` | Add day indicator chips showing M T W T F S S |
| `src/components/EpicCheckInDrawer.tsx` | Show day chips next to frequency badge |
| `src/components/EditRitualSheet.tsx` | Replace frequency dropdown with `FrequencyPresets` component |

### New Helper Function

Create a utility to format day arrays into readable display:

```tsx
// Format [0, 2, 4] → "M W F"
// Format [0,1,2,3,4,5,6] → "Daily"
// Format [0,1,2,3,4] → "Weekdays"
export function formatDaysDisplay(days: number[]): string {
  if (!days || days.length === 0) return 'Daily';
  if (days.length === 7) return 'Daily';
  if (arraysEqual(days, [0,1,2,3,4])) return 'Weekdays';
  
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return days.map(d => labels[d]).join(' ');
}
```

---

## Visual Examples

### EpicHabitList (During Campaign Creation)

Before:
```
┌─────────────────────────────────────┐
│ Morning Run                    ✏️ 🗑 │
│ Custom days                         │
└─────────────────────────────────────┘
```

After:
```
┌─────────────────────────────────────┐
│ Morning Run                    ✏️ 🗑 │
│ [M][T][W][T][F][ ][ ] · 7:00 AM    │
└─────────────────────────────────────┘
```

### EditRitualSheet (Editing Ritual)

Before:
```
Frequency
┌──────────────────────┐
│ 3x per week       ▼ │
└──────────────────────┘
(no day picker visible unless "custom" selected)
```

After:
```
Schedule
[Daily] [Weekdays] [3x/wk] [Weekly] [Custom]
                   ^^^^^^^^
                   Selected
┌───────────────────────────────────────┐
│ (M) (T) (W) (T) (F) ( ) ( )           │
│  ✓       ✓       ✓                    │
└───────────────────────────────────────┘
Repeats every Mon, Wed, Fri
```

---

## Summary

| Enhancement | User Benefit |
|-------------|--------------|
| Day chips in habit lists | See at a glance which days each ritual runs |
| Frequency presets in editor | Quick selection of common patterns |
| Always-visible day picker | Easy to customize exact days |
| Readable schedule summary | "Repeats every Mon, Wed, Fri" label |

This ensures users can see and control their ritual schedules at every touchpoint - during campaign creation and when editing existing rituals.

