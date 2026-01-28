

# Plan: Improve Quest Toggle Clickability, Instant Strikethrough, and Fix Sound

## Summary

This plan addresses three issues:
1. **Quest toggle clickability** - Make the checkbox easier to tap on mobile
2. **Immediate strikethrough** - Show the line-through animation instantly before server response
3. **Strikethrough sound not playing** - Fix iOS audio context issue in the sound function

---

## Issue Analysis

### 1. Quest Toggle Clickability
**Current state:** The checkbox has a 44x44px touch target (w-11 h-11), which is good but could be more prominent.

**Improvements:**
- Increase the visual size of the checkbox circle slightly
- Add a more visible tap feedback
- Ensure the touch area is clearly tappable

### 2. Strikethrough Animation Delay
**Current state:** The `justCompletedTasks` state tracks just-completed tasks for the animation, but the actual `completed` state only updates after the server responds and React Query invalidates the cache.

**Problem:** The animation class is applied as `isComplete && (justCompletedTasks.has(task.id) ? "animate-strikethrough" : "line-through")` - but `isComplete` comes from server state, not local state.

**Fix:** Track local completion state immediately when checkbox is clicked, independent of server response.

### 3. Strikethrough Sound Not Playing on iOS
**Current state:** The `playStrikethrough()` function does NOT call `ensureAudioContext()` before creating oscillators, unlike some other sound methods. On iOS, if the AudioContext is suspended, the sound silently fails.

**Fix:** Add `ensureAudioContext()` call at the start of `playStrikethrough()`.

---

## Implementation Details

### File 1: `src/components/TodaysAgenda.tsx`

**Change A: Add local optimistic completion state** (around line 156)

Add a new state to track tasks that should appear completed immediately:
```tsx
const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
```

**Change B: Update checkbox click handler** (around line 414-460)

Modify `handleCheckboxClick` to:
1. Immediately add task to `optimisticCompleted` set when completing
2. Remove from set when uncompleting (undo)
3. This makes the strikethrough appear instantly

```tsx
const handleCheckboxClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (isDragging || isActivated || isPressed) {
    e.preventDefault();
    return;
  }
  
  if (isComplete && onUndoToggle) {
    // Undo: remove from optimistic set
    setOptimisticCompleted(prev => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    triggerHaptic(ImpactStyle.Light);
    onUndoToggle(task.id, task.xp_reward);
  } else {
    // Complete: add to optimistic set immediately
    setOptimisticCompleted(prev => new Set(prev).add(task.id));
    triggerHaptic(ImpactStyle.Medium);
    playStrikethrough();
    // Track for strikethrough animation
    setJustCompletedTasks(prev => new Set(prev).add(task.id));
    // ... rest of existing logic
    onToggle(task.id, !isComplete, task.xp_reward);
  }
};
```

**Change C: Use optimistic state for visual completion** (around line 405)

Update the `isComplete` check to use optimistic state:
```tsx
const isComplete = !!task.completed || optimisticCompleted.has(task.id);
```

**Change D: Clean up optimistic state when server confirms** (around line 165)

Add effect to clean up optimistic state when task data updates:
```tsx
useEffect(() => {
  // Clean up optimistic completed tasks when server confirms
  setOptimisticCompleted(prev => {
    const confirmedIds = tasks.filter(t => t.completed).map(t => t.id);
    const next = new Set(prev);
    confirmedIds.forEach(id => next.delete(id));
    return next.size !== prev.size ? next : prev;
  });
}, [tasks]);
```

**Change E: Increase checkbox visual size** (around line 512-520)

Increase the inner checkbox circle from `w-5 h-5` to `w-6 h-6`:
```tsx
<motion.div 
  className={cn(
    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
    isComplete 
      ? "bg-primary border-primary" 
      : isOnboarding
        ? "border-primary ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
        : "border-muted-foreground/40 hover:border-primary"
  )}
  whileTap={!isDragging && !isPressed ? { scale: 0.85 } : {}}
>
  {isComplete && (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
    >
      <Check className="w-4 h-4 text-primary-foreground" />
    </motion.div>
  )}
</motion.div>
```

---

### File 2: `src/utils/soundEffects.ts`

**Change: Fix playStrikethrough to ensure audio context is ready** (around line 400-425)

Add async wrapper and ensureAudioContext call:
```tsx
async playStrikethrough() {
  if (this.shouldMute()) return;
  
  // Ensure audio context is ready (especially for iOS)
  await this.ensureAudioContext();
  if (!this.audioContext) return;

  // Quick descending swoosh - like a pen striking through text
  const osc = this.audioContext.createOscillator();
  const gain = this.audioContext.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.15);
  
  gain.gain.setValueAtTime(this.masterVolume * 0.25, this.audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.18);
  
  osc.connect(gain);
  gain.connect(this.audioContext.destination);
  osc.start();
  osc.stop(this.audioContext.currentTime + 0.2);
  
  // Add a subtle "pop" at the end for satisfaction
  setTimeout(() => {
    this.createOscillator(800, 0.08, 'triangle');
  }, 100);
}
```

---

## Summary Table

| File | Change | Purpose |
|------|--------|---------|
| `TodaysAgenda.tsx` | Add `optimisticCompleted` state | Track completion before server responds |
| `TodaysAgenda.tsx` | Update `isComplete` calculation | Use optimistic state for immediate visual feedback |
| `TodaysAgenda.tsx` | Increase checkbox to `w-6 h-6` | Bigger, easier to tap |
| `TodaysAgenda.tsx` | Add cleanup effect | Remove from optimistic set when server confirms |
| `soundEffects.ts` | Add `ensureAudioContext()` to `playStrikethrough` | Fix iOS audio not playing |

---

## Expected Result

1. **Checkbox** - Larger (24px circle instead of 20px), more visible tap feedback
2. **Strikethrough** - Appears instantly when tapped, no wait for server
3. **Sound** - Plays reliably on iOS when completing a quest

