

# Performance and Polish Overhaul: Structured-Level Smoothness

## Goal

Make the Quests (task management) experience feel as fluid, responsive, and polished as the Structured app -- known for its buttery-smooth animations, instant interactions, and minimal visual noise.

---

## Key Areas of Improvement

### 1. Eliminate Animation Jank and Reduce Re-renders

**Problem:** TodaysAgenda.tsx is 1,148 lines with inline `renderTaskItem` callback containing heavy logic. Every state change (expanding tasks, toggling completion, sorting) triggers re-computation of the entire render tree.

**Changes:**
- Extract `renderTaskItem` into a standalone `QuestRow` component with its own `memo()` boundary
- Move `justCompletedTasks` and `optimisticCompleted` state management into the `QuestRow` component so completion animations don't trigger parent re-renders
- Split TodaysAgenda into smaller sub-components: `QuestListSection`, `RitualCampaignSection`, `AgendaHeader`

**Files:**
- Create `src/components/tasks/QuestRow.tsx` -- extracted, memoized task row
- Create `src/components/tasks/QuestListSection.tsx` -- quest list with draggable + swipeable
- Create `src/components/tasks/RitualCampaignSection.tsx` -- campaign groups
- Create `src/components/tasks/AgendaHeader.tsx` -- date, streak, XP, progress bar
- Refactor `src/components/TodaysAgenda.tsx` -- slim orchestrator composing sub-components

### 2. Instant Checkbox Feedback (Structured-style)

**Problem:** Current checkbox has a spring animation delay. Structured uses instant visual feedback with a satisfying fill animation.

**Changes:**
- Replace the current spring-based Check icon animation with a CSS-only radial fill effect (0ms perceived delay)
- Add a subtle scale pulse on the row itself (not just the checkbox) on completion
- Use `will-change: transform` only during active animations, then remove
- Strikethrough animation should start simultaneously with checkbox fill, not after

**Files:**
- `src/components/tasks/QuestRow.tsx` (new component)
- `src/index.css` -- add optimized checkbox animation keyframes

### 3. Smoother Drag-and-Drop Reordering

**Problem:** DraggableTaskList uses `requestAnimationFrame` for offset updates but still re-renders `visualOrder` state on every swap. The 500ms long-press delay feels sluggish.

**Changes:**
- Reduce long-press activation to 400ms with a visual "lift" hint at 200ms (subtle scale/shadow preview)
- Use CSS transforms exclusively during drag (no layout recalculations)
- Add a ghost placeholder where the dragged item was (like Structured's translucent gap)
- Smoother swap animation: other items slide with a spring transition instead of instant repositioning
- Add `layout` animation to non-dragging items so they animate into new positions

**Files:**
- Refactor `src/components/DraggableTaskList.tsx`

### 4. Swipe Actions: Reduce Friction

**Problem:** Current swipe requires hold-to-confirm (300ms hold at threshold). This adds unnecessary friction compared to Structured's simple swipe-to-threshold-and-release.

**Changes:**
- Remove hold-to-confirm pattern; execute action on release past threshold
- Reduce threshold from 140px to 100px for quicker action
- Add velocity-based trigger: fast swipe executes regardless of distance
- Smoother background reveal with spring-based transforms
- Add subtle parallax effect on action icons

**Files:**
- Refactor `src/components/SwipeableTaskItem.tsx`

### 5. List Transitions (Add/Remove/Complete)

**Problem:** Tasks appear/disappear without transition. Completed tasks jump to bottom (when setting is off) without animation.

**Changes:**
- Wrap quest list in `AnimatePresence` with `layout` animations for smooth entry/exit
- New tasks slide in from top with a subtle spring
- Completed tasks (when moving to bottom) slide down smoothly with opacity transition
- Deleted tasks collapse height smoothly (not just opacity fade)

**Files:**
- `src/components/tasks/QuestListSection.tsx` (new)
- `src/components/DraggableTaskList.tsx`

### 6. Progress Bar and Header Polish

**Problem:** Progress bar animation is decent but the header area feels cluttered with too many elements competing for attention.

**Changes:**
- Use a thinner progress bar (2px, like Structured) with a glow effect on the fill
- Animate the completion count with a number counter (not instant text swap)
- Subtle parallax scroll effect: header compresses as user scrolls down the task list

**Files:**
- `src/components/tasks/AgendaHeader.tsx` (new)

### 7. Input UX: Faster Task Creation

**Problem:** CompactSmartInput has many features (voice, autocomplete, plan-my-day) that add visual noise. The input should feel instant.

**Changes:**
- Defer loading of voice input, autocomplete suggestions, and plan features until input is focused
- Add keyboard shortcut hint on focus
- Submit animation: input text slides up and out as new task slides into list

**Files:**
- Minor optimizations in `src/features/tasks/components/CompactSmartInput.tsx`

---

## Technical Details

### New Component Architecture

```text
TodaysAgenda (slim orchestrator, ~200 lines)
  |-- AgendaHeader (date, streak, XP, progress)
  |-- CompactSmartInput (task creation)
  |-- QuestListSection (draggable list of QuestRows)
  |     |-- DraggableTaskList
  |           |-- QuestRow (memo'd, self-contained completion state)
  |                 |-- SwipeableTaskItem wrapper
  |-- RitualCampaignSection (campaign groups)
        |-- CampaignGroup (header + collapsible ritual list)
```

### Performance Optimizations Summary

| Optimization | Impact |
|---|---|
| Extract QuestRow with memo boundary | Prevents full list re-render on single task toggle |
| CSS-only checkbox animation | 0ms perceived delay vs 200ms spring |
| Remove swipe hold-to-confirm | ~300ms faster swipe actions |
| Layout animations for list reflow | Smooth visual transitions instead of jumps |
| Defer non-essential input features | Faster initial render of task list |
| Reduce DraggableTaskList re-renders | Fewer state updates during drag |

### Animation Specifications

- **Checkbox fill**: 150ms ease-out radial fill
- **Strikethrough**: 300ms linear, starts with checkbox
- **Task entry**: 200ms spring (stiffness: 500, damping: 30)
- **Task exit (delete)**: 200ms ease-out height collapse + opacity
- **Drag lift**: 200ms scale to 1.03 + shadow elevation
- **Swap reposition**: 250ms spring for non-dragged items
- **Swipe threshold**: 100px, velocity trigger at 800px/s
- **Progress bar**: 400ms ease-out width transition

### Files Modified (Summary)

| File | Action |
|---|---|
| `src/components/tasks/QuestRow.tsx` | Create |
| `src/components/tasks/QuestListSection.tsx` | Create |
| `src/components/tasks/RitualCampaignSection.tsx` | Create |
| `src/components/tasks/AgendaHeader.tsx` | Create |
| `src/components/TodaysAgenda.tsx` | Major refactor (slim down) |
| `src/components/DraggableTaskList.tsx` | Refactor drag UX |
| `src/components/SwipeableTaskItem.tsx` | Simplify swipe logic |
| `src/index.css` | Add animation keyframes |
| `src/features/tasks/components/CompactSmartInput.tsx` | Minor optimization |

