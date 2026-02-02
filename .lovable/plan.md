

# Minimal Fix: Reduce Accidental Task Clicks

## Problem

Tasks are getting clicked/toggled slightly too easily, likely during scrolling. You want an extremely minimal change that doesn't make clicking harder—just slightly more deliberate.

## Root Cause

The checkbox uses `onTouchEnd` which fires immediately when a finger lifts, even after a slight scroll movement. Unlike other components (CalendarDayView, QuestDragCard, DraggableTaskList) that use a touch movement threshold to distinguish scrolling from tapping, the checkbox has no such protection.

## Solution: Add a 5px Movement Threshold

Add a tiny scroll-detection check to the checkbox so that if your finger moves more than 5px from the initial touch position, the tap is ignored (user was scrolling, not tapping).

### File: `src/components/TodaysAgenda.tsx`

**Location:** Inside `renderTaskItem` callback (~line 416)

**What changes:**
1. Add a `touchStartRef` to track the initial touch position
2. Store position on `onTouchStart`
3. Only trigger the click in `onTouchEnd` if the finger moved less than 5px

**Code pattern:**
```typescript
// At the top of TodaysAgenda component (around line 175):
const touchStartRef = useRef<{ x: number; y: number } | null>(null);

// In the checkbox button (~line 514-522):
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
  // ... rest of button props
>
```

## Why 5px?

| Threshold | Effect |
|-----------|--------|
| 0px | No change (current behavior) |
| 5px | Filters out micro-scrolls, minimal impact on intentional taps |
| 10px | Standard threshold used elsewhere, but may feel sluggish |

5px is the absolute minimum that will still catch tiny scroll movements while keeping taps feeling instant.

## Impact

- Intentional taps: **No noticeable change**
- Accidental taps during scroll: **Prevented**
- Feel: **Identical to current**, just slightly smarter

