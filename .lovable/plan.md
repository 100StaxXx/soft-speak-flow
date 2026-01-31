
# Remove "3x/wk" Frequency Option

## Overview

Remove the "3x/wk" preset from the frequency picker in the Edit Ritual sheet and related components.

## Changes Required

### File: `src/components/Pathfinder/FrequencyPresets.tsx`

| Line | Change |
|------|--------|
| 6 | Update `FrequencyType` to remove `'3x_week'` from the union type |
| 17 | Remove the preset entry `{ value: '3x_week', label: '3x/wk', days: [0, 2, 4] }` |
| 90 | Remove the `case '3x_week'` from `getDefaultDaysForFrequency()` helper |

**Before:**
```typescript
type FrequencyType = 'daily' | '5x_week' | '3x_week' | 'weekly' | 'custom';

const presets = [
  { value: 'daily', label: 'Daily', days: [0, 1, 2, 3, 4, 5, 6] },
  { value: '5x_week', label: 'Weekdays', days: [0, 1, 2, 3, 4] },
  { value: '3x_week', label: '3x/wk', days: [0, 2, 4] },  // REMOVE
  { value: 'weekly', label: 'Weekly', days: [0] },
  { value: 'custom', label: 'Custom', days: [] },
];
```

**After:**
```typescript
type FrequencyType = 'daily' | '5x_week' | 'weekly' | 'custom';

const presets = [
  { value: 'daily', label: 'Daily', days: [0, 1, 2, 3, 4, 5, 6] },
  { value: '5x_week', label: 'Weekdays', days: [0, 1, 2, 3, 4] },
  { value: 'weekly', label: 'Weekly', days: [0] },
  { value: 'custom', label: 'Custom', days: [] },
];
```

## Result

The frequency picker will show only: **Daily**, **Weekdays**, **Weekly**, **Custom**

Users who want a 3x/week schedule can still achieve this using the "Custom" option and selecting Mon/Wed/Fri manually.

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/components/Pathfinder/FrequencyPresets.tsx` | Remove `3x_week` from type, presets array, and helper function |

### Database Compatibility

The database schema still supports `3x_week` as a valid enum value. Existing rituals with `3x_week` frequency will continue to work - they'll just show the Custom preset selected when edited. No database migration is needed.

### Type Cast Update

The type cast in `EditRitualSheet.tsx` (line 332) will automatically exclude `3x_week` since the type is inferred from the prop, but no change is needed there since the frequency value from existing data will still be accepted.
