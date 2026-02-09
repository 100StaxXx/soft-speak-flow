
# Tighten Timeline Layout Slightly

## Overview

Keep the time in both spots (timeline column + inside card). Just shrink things slightly and shift the timeline times left for better alignment.

## Changes

### 1. TimelineTaskRow.tsx

- **Compact time format**: Change from "9:30 AM" to "9:30a" (lowercase, no space) so it never wraps in the narrow column
- **Reduce font**: `text-[11px]` to `text-[10px]`
- **Shift left**: Reduce column width from `w-16` to `w-14` and remove `pr-1` padding
- **Tighten gap**: `gap-3` to `gap-2`
- **Shrink dot**: `w-2.5 h-2.5` to `w-2 h-2`

### 2. TodaysAgenda.tsx

- **Shrink task title**: `text-base` (16px) to `text-sm` (14px)
- **Shrink in-card time**: `text-sm` to `text-xs`, clock icon from `w-4 h-4` to `w-3 h-3`
- **Update "Anytime" divider spacer**: from `w-16` to `w-14` to match new column width

| File | Change |
|---|---|
| `src/components/TimelineTaskRow.tsx` | Compact time format, smaller font/dot, narrower column, tighter gap |
| `src/components/TodaysAgenda.tsx` | Shrink task title and in-card time text slightly; update divider spacer |
