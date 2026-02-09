

# Fix Timeline Layout: Tighter Text and Better Horizontal Spacing

## Problem

The Quests timeline has two layout issues visible in the screenshot:
1. **Time labels wrap awkwardly** -- "9:30 AM" breaks onto two lines because the left time column (`w-16` = 64px) is too narrow
2. **Time is shown twice** -- once in the left timeline column AND again inside the task card with a Clock icon, wasting space
3. **Overall text feels large** for the compact timeline format

## Changes

### 1. TimelineTaskRow.tsx -- Shrink time text and use compact format

- Change the time format from "9:30 AM" to "9:30a" (lowercase, no space) to fit in the narrow column without wrapping
- Reduce font size from `text-[11px]` to `text-[10px]`
- Reduce the left column width from `w-16` to `w-12` to reclaim horizontal space
- Reduce gap between columns from `gap-3` to `gap-2`

### 2. TodaysAgenda.tsx -- Remove redundant time display inside task cards

Since the timeline row already shows the time on the left, remove the duplicate time+Clock display inside the task card (lines 535-540). This frees up vertical space in each card.

Also update the "Anytime" divider spacer from `w-16` to `w-12` to match the new column width.

### 3. TodaysAgenda.tsx -- Slightly shrink task text

Reduce the task title from `text-base` (16px) to `text-sm` (14px) so everything feels proportional to the compact timeline layout.

## Files Changed

| File | Change |
|---|---|
| `src/components/TimelineTaskRow.tsx` | Compact time format ("9:30a"), smaller font, narrower left column (`w-12`), tighter gap |
| `src/components/TodaysAgenda.tsx` | Remove duplicate time display in task cards; shrink task title to `text-sm`; update anytime divider spacer width |

