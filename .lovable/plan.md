

# Drag-to-Reschedule: Adjust Quest Time by Dragging

## Overview
Long-press a quest card, then drag it vertically to change its scheduled time. The time label on the left updates live in 10-minute increments as you drag. On release, the new time is persisted.

## Approach: Extend Existing Patterns (Not a New Component)

Rather than creating a brand new `DraggableTimeline` component, we'll add time-reschedule logic **directly into the existing scheduled items rendering** in `TodaysAgenda.tsx`. This keeps things simple and reuses the proven long-press + drag patterns from `DraggableTaskList`.

## How It Works

1. **Long-press (500ms)** a scheduled quest card -- haptic fires, card lifts with scale + shadow
2. **Drag vertically** -- the time label in the left column updates in real-time, snapping to 10-minute intervals (e.g., 9:00a, 9:10a, 9:20a)
3. **Release** -- card settles, `updateTask` mutation fires with the new `scheduled_time`, timeline re-sorts
4. Dragging an **anytime quest** into the scheduled zone gives it a time (based on drag position relative to existing scheduled items)

## Technical Changes

### 1. New hook: `src/hooks/useTimelineDrag.ts`

A self-contained hook that manages the drag-to-reschedule interaction:

- **State**: `draggingTaskId`, `previewTime` (the snapped time string shown during drag), `dragOffsetY`
- **Long-press detection**: 500ms timer, cancels on >10px scroll movement (same proven pattern as `DraggableTaskList`)
- **Time calculation**: Maps vertical drag delta to 10-minute intervals:
  - Each 10-minute slot = 40px of vertical movement
  - `newMinutes = originalMinutes + Math.round(deltaY / 40) * 10`
  - Clamp between 00:00 and 23:50
- **Haptics**: Light impact on each 10-minute snap, medium on drop
- **Auto-scroll**: Reuses `useAutoscroll` hook for edge scrolling
- **Returns**: `{ startDrag, handlers, draggingTaskId, previewTime, dragOffsetY, isDragging }`

### 2. Update `src/components/TimelineTaskRow.tsx`

- Add `overrideTime` prop -- when set, displays this time instead of the task's actual time (used during drag preview)
- Add `isDragTarget` prop for subtle highlight styling when the row is being dragged

### 3. Update `src/components/TodaysAgenda.tsx`

- Import and use `useTimelineDrag` hook
- Add `onUpdateScheduledTime` prop (wired to `updateTask` mutation)
- Wrap each `TimelineTaskRow` in the scheduled section (lines 862-871) with long-press handlers from the hook
- Pass `overrideTime={previewTime}` to the actively dragged row
- Apply the lifted card styling (scale, shadow, z-index) to the dragged item via inline styles (same pattern as `DraggableTaskList` lines 384-394)
- On drag end, call `onUpdateScheduledTime(taskId, newTime)` and let the timeline re-sort

### 4. Update `src/pages/Journeys.tsx`

- Pass `onUpdateScheduledTime` callback that calls `updateTask.mutateAsync({ taskId, updates: { scheduled_time: newTime } })`

## Interaction Details (Matching Existing Feel)

| Aspect | Implementation |
|--------|---------------|
| Long-press threshold | 500ms (matches `DraggableTaskList`) |
| Scroll cancel | 10px vertical movement before activation cancels |
| Card lift | `scale(1.03)`, elevated box-shadow (same as `DraggableTaskList` line 386-391) |
| Other items | `opacity: 0.7`, `pointerEvents: none` (same pattern) |
| Time snap | Every 40px = 10 minutes, light haptic on each snap |
| Drop | Medium haptic, bounce animation (`scale [1, 1.02, 0.98, 1]`) |
| Touch handling | Both pointer events (desktop) AND touch events (iOS) on window, `{ passive: false }` for touch move |
| Transform | Direct CSS `transform: translateY()` on dragged item -- no framer-motion animation lag |

## Why This Works

- Reuses the exact interaction model users already know from reorder drag
- No new component needed -- just a hook + minor prop additions
- Time calculation is pure math (no complex DOM measurement)
- The `useAutoscroll` hook handles edge-of-screen scrolling automatically
- Proven touch handling pattern prevents conflicts with page scroll
