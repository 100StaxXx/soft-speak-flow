

# Fix MarqueeText: Add Initial Pause Before Scrolling

## Problem

The ritual titles start scrolling immediately when they appear. Users need a moment to read the beginning of the title before it starts moving.

## Solution

Add a 3-second initial pause before the scroll animation begins, while also fixing the overall animation timing.

## Changes to `src/components/ui/marquee-text.tsx`

### Current Animation Flow:
```
0% → 40%: Scroll left (no initial pause!)
40% → 50%: Pause at end
50% → 90%: Scroll back
90% → 100%: Pause at start
```

### New Animation Flow:
```
0% → 20%: INITIAL PAUSE (new!)
20% → 50%: Scroll left  
50% → 60%: Pause at end
60% → 90%: Scroll back
90% → 100%: Pause at start (before next loop)
```

### Updated Code:

```typescript
export function MarqueeText({ 
  text, 
  className,
  speed = 30,
  pauseDuration = 2000,
  initialDelay = 3000  // NEW: 3 second initial pause
}: MarqueeTextProps) {
  // ... existing refs and state ...

  // Calculate total duration including initial delay
  const scrollDuration = scrollDistance / speed;
  const totalDuration = initialDelay / 1000 + scrollDuration + (pauseDuration * 2 / 1000);
  
  // Calculate time proportions
  const initialPauseProportion = (initialDelay / 1000) / totalDuration;
  const scrollProportion = (scrollDuration / 2) / totalDuration;
  const endPauseProportion = (pauseDuration / 1000) / totalDuration;

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <motion.span
        ref={textRef}
        className="whitespace-nowrap inline-block"
        animate={{
          x: [0, 0, -scrollDistance, -scrollDistance, 0, 0],
        }}
        transition={{
          duration: totalDuration,
          times: [
            0,                                           // Start at 0
            initialPauseProportion,                      // End initial pause
            initialPauseProportion + scrollProportion,   // End scroll left
            initialPauseProportion + scrollProportion + endPauseProportion, // End pause at left
            initialPauseProportion + scrollProportion * 2 + endPauseProportion, // End scroll back
            1                                            // End pause at right
          ],
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {text}
      </motion.span>
    </div>
  );
}
```

### Also Fix: Overflow Detection Timing

Add ResizeObserver and initial delay to reliably detect overflow:

```typescript
useEffect(() => {
  const checkOverflow = () => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;
      const overflow = textWidth > containerWidth;
      setIsOverflowing(overflow);
      if (overflow) {
        setScrollDistance(textWidth - containerWidth + 20);
      }
    }
  };
  
  // Delay initial check to allow layout to settle
  const timeoutId = setTimeout(checkOverflow, 100);
  
  // Use ResizeObserver for container size changes
  const resizeObserver = new ResizeObserver(checkOverflow);
  if (containerRef.current) {
    resizeObserver.observe(containerRef.current);
  }
  
  return () => {
    clearTimeout(timeoutId);
    resizeObserver.disconnect();
  };
}, [text]);
```

### Unify JSX Structure

Keep refs consistent by always rendering same structure:

```typescript
return (
  <div ref={containerRef} className={cn("overflow-hidden", className)}>
    <motion.span
      ref={textRef}
      className="whitespace-nowrap inline-block"
      animate={isOverflowing ? { x: [...] } : { x: 0 }}
      transition={isOverflowing ? { ... } : { duration: 0 }}
    >
      {text}
    </motion.span>
  </div>
);
```

## File Changes

| File | Change |
|------|--------|
| `src/components/ui/marquee-text.tsx` | Add `initialDelay` prop (default 3s), fix timing, improve overflow detection |

## Result

- Text stays still for 3 seconds so users can read the beginning
- Then smoothly scrolls to reveal the rest
- Pauses at the end before scrolling back
- Reliably detects overflow even with delayed layouts

