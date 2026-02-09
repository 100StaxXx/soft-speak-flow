

# Push Timeline Times Closer to Left Edge

## Problem

The parent container (`TodaysAgenda.tsx` line 699) applies `px-4` (16px) padding, and the time column is `w-11` (44px). Combined, the time labels start ~16px from the edge -- they need to be tighter.

## Changes

### File: `src/components/TimelineTaskRow.tsx`

- Reduce the time column width from `w-11` to `w-9` (36px) -- still enough for "10:30a" at 10px font
- This pulls times ~8px closer to the left

### File: `src/components/TodaysAgenda.tsx`

- Reduce the container padding from `px-4` to `px-2` on the section wrapping the timeline rows (line 699), pulling everything closer to the left edge
- Update the "Anytime" divider spacer from `w-14` to `w-9` to match the new column width

| File | Change |
|---|---|
| `src/components/TimelineTaskRow.tsx` | Shrink time column from `w-11` to `w-9` |
| `src/components/TodaysAgenda.tsx` | Reduce container left padding from `px-4` to `px-2`; update anytime divider spacer to `w-9` |

