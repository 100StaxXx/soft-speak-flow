

# Convert Ritual Circles to iOS-Optimized Clickable Toggles

## Overview

Convert the static bullet indicators in the Campaigns tab to interactive checkboxes with the **exact same iOS touch handling pattern** used in the Quests tab, ensuring identical clickability and responsiveness.

---

## Pattern to Replicate (from TodaysAgenda.tsx lines 517-570)

The Quests tab uses this optimized pattern:

```typescript
// Touch tracking ref to detect scroll vs tap
const touchStartRef = useRef<{ x: number; y: number } | null>(null);

<button
  data-interactive="true"
  onClick={handleCheckboxClick}
  onTouchStart={(e) => {
    touchStartRef.current = { 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    };
  }}
  onTouchEnd={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only trigger if finger moved less than 5px (not scrolling)
    if (touchStartRef.current) {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
      if (dx < 5 && dy < 5) {
        handleCheckboxClick(e as unknown as React.MouseEvent);
      }
    }
    touchStartRef.current = null;
  }}
  className="relative flex items-center justify-center w-11 h-11 touch-manipulation active:scale-95 transition-transform select-none"
  style={{
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  }}
  aria-label="Mark task as complete"
  role="checkbox"
  aria-checked={isComplete}
  tabIndex={0}
>
  {/* Visual checkbox */}
</button>
```

---

## Implementation in EpicCheckInDrawer.tsx

### 1. Add Required Imports

```typescript
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { playStrikethrough } from "@/utils/soundEffects";
```

### 2. Add State and Refs

```typescript
const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null);
const touchStartRef = useRef<{ x: number; y: number } | null>(null);

// Get habit surfacing data and mutations
const taskDate = format(new Date(), 'yyyy-MM-dd');
const { surfacedHabits, surfaceHabit } = useHabitSurfacing();
const { toggleTask } = useTaskMutations(taskDate);

// Map habit IDs to their task completion state
const habitTaskMap = useMemo(() => {
  const map = new Map<string, { task_id: string | null; is_completed: boolean }>();
  surfacedHabits.forEach(sh => {
    map.set(sh.habit_id, { task_id: sh.task_id, is_completed: sh.is_completed });
  });
  return map;
}, [surfacedHabits]);
```

### 3. Add Toggle Handler with Haptics

```typescript
const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch (e) {
    // Haptics not available on web
  }
};

const handleToggleRitual = async (habitId: string, taskId: string | null, isCompleted: boolean) => {
  if (isCompleted || togglingHabitId) return;
  
  setTogglingHabitId(habitId);
  triggerHaptic(ImpactStyle.Medium);
  playStrikethrough();
  
  try {
    let activeTaskId = taskId;
    
    // Surface the habit as a task if not already done
    if (!activeTaskId) {
      await surfaceHabit(habitId);
      // The surfaceHabit will create the task and invalidate queries
      // The UI will update via realtime sync
      return;
    }
    
    // Toggle the task to completed
    toggleTask.mutate({ 
      taskId: activeTaskId, 
      completed: true, 
      xpReward: 25 
    });
  } finally {
    setTimeout(() => setTogglingHabitId(null), 300);
  }
};
```

### 4. Replace Static Circle (lines 289-292) with Interactive Button

**Current (static):**
```jsx
<div className="h-6 w-6 rounded-full border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
  <div className="w-2 h-2 rounded-full bg-primary/50" />
</div>
```

**New (interactive with iOS optimization):**
```jsx
{(() => {
  const habitState = habitTaskMap.get(habit.id);
  const isCompleted = habitState?.is_completed || false;
  const isTogglingThis = togglingHabitId === habit.id;
  
  return (
    <button
      data-interactive="true"
      onClick={(e) => {
        e.stopPropagation();
        if (!isCompleted && !isTogglingThis) {
          handleToggleRitual(habit.id, habitState?.task_id || null, isCompleted);
        }
      }}
      onTouchStart={(e) => {
        touchStartRef.current = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (touchStartRef.current && !isCompleted && !isTogglingThis) {
          const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
          if (dx < 5 && dy < 5) {
            handleToggleRitual(habit.id, habitState?.task_id || null, isCompleted);
          }
        }
        touchStartRef.current = null;
      }}
      disabled={isCompleted}
      className={cn(
        "relative flex items-center justify-center w-11 h-11 -ml-2.5 touch-manipulation transition-transform select-none",
        !isCompleted && "active:scale-95"
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
      aria-label={isCompleted ? "Ritual completed" : "Mark ritual as complete"}
      role="checkbox"
      aria-checked={isCompleted}
      tabIndex={0}
    >
      <motion.div 
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          isCompleted 
            ? "bg-green-500 border-green-500" 
            : "border-primary/30 hover:border-primary/60",
          isTogglingThis && "animate-pulse border-primary"
        )}
        whileTap={!isCompleted ? { scale: 0.85 } : {}}
      >
        {isCompleted ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
        ) : isTogglingThis ? (
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-primary/50" />
        )}
      </motion.div>
    </button>
  );
})()}
```

### 5. Add Visual Completion State to Habit Text (line 293)

```jsx
<span className={cn(
  "flex-1 text-sm font-medium transition-all",
  habitTaskMap.get(habit.id)?.is_completed && "line-through text-muted-foreground"
)}>
  {habit.title}
</span>
```

---

## iOS Touch Optimization Checklist

| Feature | Quests Tab | Campaigns Tab (New) |
|---------|------------|---------------------|
| 44x44px touch target | `w-11 h-11` ✓ | `w-11 h-11` ✓ |
| Touch vs scroll detection | 5px threshold ✓ | 5px threshold ✓ |
| `onTouchEnd` + `preventDefault` | ✓ | ✓ |
| `WebkitTapHighlightColor: transparent` | ✓ | ✓ |
| `touchAction: manipulation` | ✓ | ✓ |
| `active:scale-95` feedback | ✓ | ✓ |
| `whileTap` animation | ✓ | ✓ |
| Haptic feedback | ✓ | ✓ |
| Strikethrough sound | ✓ | ✓ |
| ARIA accessibility | ✓ | ✓ |
| Spring animation on complete | ✓ | ✓ |

---

## Sync Guarantee

Both tabs use the **same mutations and query invalidations**:
- `toggleTask` mutation updates `daily_tasks` and `habit_completions`
- Query keys invalidated: `['daily-tasks']`, `['habits']`, `['habit-surfacing']`, `['epics']`
- Realtime subscriptions push changes instantly across devices

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/EpicCheckInDrawer.tsx` | Add imports, state, refs, handler, replace checkbox UI |

---

## Summary

The ritual toggles on the Campaigns tab will have **identical iOS touch handling** to the Quests tab:
- Same 44x44px touch target
- Same scroll vs tap detection (5px threshold)
- Same `onTouchEnd` with `preventDefault`
- Same haptic feedback and sound effects
- Same spring animations
- **Perfect sync** via shared mutations and realtime subscriptions

