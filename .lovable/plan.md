

# Show All-Day Tasks in a Dedicated Banner Section

## Approach

Most calendar apps (Google Calendar, Apple Calendar, Fantastical, Structured) handle all-day events the same way: they render them as **compact horizontal banners pinned at the top** of the day's timeline, above the time-slotted tasks. They never occupy a time slot or inflate the vertical space.

## Changes

### 1. Separate "All Day" tasks from scheduled/unscheduled buckets (`TimelineView.tsx`)

Add a third filtered group:

```
allDayTasks = dayTasks.filter(t => t.estimated_duration === 1440)
scheduledTasks = dayTasks.filter(t => t.scheduled_time && t.estimated_duration !== 1440)
unscheduledTasks = dayTasks.filter(t => !t.scheduled_time && t.estimated_duration !== 1440)
```

Render `allDayTasks` in a new section **above** the scheduled timeline (after milestones, before time-slotted tasks). Each all-day task renders as a compact pill/banner:

- Small colored left accent bar (category color)
- Task title (single line, truncated)
- Completed checkbox on the right
- Fixed height (~40px), no duration visualization
- Tappable (fires `onTaskClick`)

### 2. Create a lightweight `AllDayTaskBanner` component

A simple inline component (or small new file) that renders each all-day task as a compact horizontal card:

```
[colored dot] Task Title              [checkbox]
```

Styled with `rounded-lg bg-muted/30 px-3 py-2` -- unobtrusive, compact, clearly distinct from the time-slotted cards below.

### 3. Cap `TimelinePill` height (`TimelinePill.tsx`)

As a safety net, cap the pill max height at 96px so even if an all-day task somehow ends up in the pill renderer, it won't explode the layout.

### 4. Update duration label (`TimelineTaskCard.tsx`)

`getDurationText(1440)` returns `"All Day"` instead of `"24h"`.

## Files Changed

| File | Change |
|---|---|
| `src/components/calendar/TimelineView.tsx` | Filter allDayTasks separately; render them as compact banners above the scheduled timeline |
| `src/components/calendar/AllDayTaskBanner.tsx` | New small component -- compact horizontal card for all-day tasks |
| `src/components/calendar/TimelinePill.tsx` | Cap max height at 96px |
| `src/components/calendar/TimelineTaskCard.tsx` | Return "All Day" for 1440-minute duration |

