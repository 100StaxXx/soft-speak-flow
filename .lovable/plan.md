

# Add Custom/All Day Duration Options and Soften Colors

## Overview

Add "All Day" and "Custom" duration options to the duration chip selector, and change the difficulty color palette from harsh reds/roses to softer tones.

## Changes

### File: `src/components/AddQuestSheet.tsx`

**1. Add "All Day" and "Custom" duration chips**

- Add two new entries to `DURATION_OPTIONS`: `{ label: "All Day", value: 1440 }` and a special `{ label: "Custom", value: -1 }` sentinel
- When "Custom" is selected, show a numeric input field below the chips where the user can type any number of minutes
- Add state `customDurationInput` for the free-form input
- When the user types a custom value, update `estimatedDuration` accordingly
- "All Day" simply sets duration to 1440 (24 hours)

**2. Update `durationLabel` memo**

- Handle 1440 as "All Day"
- Handle custom values that don't match predefined chips gracefully (e.g., "25 min")

**3. Soften the difficulty color palette**

Replace the current harsh colors in `DIFFICULTY_COLORS`:
- **Easy**: Keep emerald (already soft)
- **Medium**: Change from `rose-500` (hot pink/red) to `amber-500` / `orange-400` (warm, soft amber)
- **Hard**: Change from `red-600` to `violet-500` / `purple-500` (soft purple instead of aggressive red)

Updated map:
```
easy:   bg-emerald-600, pill bg-emerald-500
medium: bg-amber-500, pill bg-amber-500
hard:   bg-violet-500, pill bg-violet-500
```

## Files Changed

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` | Add "All Day" + "Custom" to duration chips with custom input, soften difficulty colors to amber/violet |

