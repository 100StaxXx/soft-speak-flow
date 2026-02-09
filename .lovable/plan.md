

# Fix Timeline Time Label Alignment

## Problem

Looking at the screenshot, two issues:
1. The time labels ("9:30a", "10:30a") are right-aligned in a wide column, pushing them too far from the left edge of the screen
2. The time labels sit slightly above the task content -- they need to vertically center with the checkbox/icon row

## Changes

### File: `src/components/TimelineTaskRow.tsx`

- **Left-align times**: Change `text-right` to `text-left` on the time column so times hug the left edge of the screen
- **Reduce column width**: Shrink from `w-14` (56px) to `w-11` (44px) -- just enough for "10:30a"
- **Fix vertical alignment**: Change `pt-4` to `pt-[18px]` so the time text vertically centers with the checkbox and task title row beside it

| File | Change |
|---|---|
| `src/components/TimelineTaskRow.tsx` | Left-align time text, narrow column to `w-11`, adjust vertical padding for alignment |

