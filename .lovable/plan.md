

# Reorder Rituals Within Campaign Groups

## Overview

Enable drag-and-drop reordering of rituals within each campaign group using the **exact same** `DraggableTaskList` component that already works for quests. The only difference is where the order gets persisted - rituals update `habits.sort_order` via the existing `reorderHabits` mutation.

## Current Quest Implementation (What We're Reusing)

| Component | Purpose |
|-----------|---------|
| `DraggableTaskList` | Long-press to activate drag, visual reorder with haptic feedback |
| `handleQuestReorder` | Maps reordered tasks to `{ id, sort_order }` updates |
| `reorderTasks` from `useDailyTasks` | Persists to `tasks.sort_order` |

**Key insight**: Rituals are spawned tasks with a `habit_source_id` field. We persist order to `habits.sort_order` so the order carries forward to future days.

---

## Changes Required

| File | Change |
|------|--------|
| `src/components/TodaysAgenda.tsx` | (1) Add `onReorderRituals` prop, (2) Replace ritual `{group.tasks.map()}` with `DraggableTaskList` |
| `src/pages/Journeys.tsx` | (1) Import `useHabits`, (2) Create `handleReorderRituals` callback that maps to habit IDs and calls `reorderHabits` |

---

## Technical Details

### 1. Update TodaysAgenda Props (line ~104)

Add new callback prop:

```tsx
interface TodaysAgendaProps {
  // ... existing props
  onReorderRituals?: (reorderedTasks: Task[]) => void;
}
```

### 2. Replace Ritual Mapping with DraggableTaskList (lines 1091-1092)

**Current (simple map):**
```tsx
<Collapsible open={isExpanded}>
  <CollapsibleContent>
    <div className="pl-4 border-l border-accent/20 ml-3 pb-2 pt-2">
      {group.tasks.map((task) => renderTaskItem(task))}
    </div>
  </CollapsibleContent>
</Collapsible>
```

**New (reuse DraggableTaskList):**
```tsx
<Collapsible open={isExpanded}>
  <CollapsibleContent>
    <div className="pl-4 border-l border-accent/20 ml-3 pb-2 pt-2">
      <DraggableTaskList
        tasks={group.tasks}
        onReorder={(reorderedTasks) => onReorderRituals?.(reorderedTasks)}
        disabled={!onReorderRituals}
        renderItem={(task, dragProps) => (
          <div key={task.id}>
            {renderTaskItem(task, dragProps)}
          </div>
        )}
      />
    </div>
  </CollapsibleContent>
</Collapsible>
```

### 3. Add Handler in Journeys.tsx

Import the habits hook and create the handler:

```tsx
import { useHabits } from "@/features/habits/hooks/useHabits";

// Inside component:
const { reorderHabits } = useHabits();

// Handler for ritual reordering - maps task.habit_source_id to habit updates
const handleReorderRituals = useCallback((reorderedTasks: typeof dailyTasks) => {
  // Filter to only rituals (have habit_source_id) and map to habit updates
  const habitUpdates = reorderedTasks
    .filter(task => task.habit_source_id)
    .map((task, index) => ({
      id: task.habit_source_id!,
      sort_order: index,
    }));
  
  if (habitUpdates.length > 0) {
    reorderHabits(habitUpdates);
  }
}, [reorderHabits]);
```

### 4. Pass to TodaysAgenda (line ~655)

```tsx
<TodaysAgenda
  // ... existing props
  onReorderRituals={handleReorderRituals}
/>
```

---

## Data Flow (Same Pattern as Quests)

```text
User long-presses ritual row
       ↓
DraggableTaskList activates drag (same component as quests)
       ↓
Visual reorder with haptic feedback
       ↓
onReorder callback fires
       ↓
TodaysAgenda.onReorderRituals(reorderedTasks)
       ↓
Journeys.handleReorderRituals → maps task.habit_source_id to habit IDs
       ↓
useHabits.reorderHabits(habitUpdates)
       ↓
Database: UPDATE habits SET sort_order = X WHERE id = Y
       ↓
React Query invalidates ['habits'] → ritual order persists
```

---

## Why This Works Reliably

| Aspect | Implementation |
|--------|---------------|
| **Drag mechanism** | Reuses proven `DraggableTaskList` - same long-press, haptics, visual feedback |
| **No new code paths** | Just wiring existing components together |
| **Persistence** | Updates `habits.sort_order` so order persists across days |
| **Campaign scoping** | Each campaign group is a separate `DraggableTaskList` instance |

---

## Edge Cases

- **Single ritual in group**: `DraggableTaskList` auto-disables when `tasks.length <= 1`
- **Mixed campaigns**: Rituals only reorder within their own campaign group (no cross-campaign)
- **Standalone rituals**: Same drag behavior, just grouped under "Standalone" header

