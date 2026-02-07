

# Fix Double Image in Journey Path Drawer

## Problem Identified

The visual shows two stacked elements:
1. **Top layer**: AI-generated landscape image from `JourneyPathDrawer` (lines 152-160)
2. **Bottom layer**: `ConstellationTrail` SVG visualization with its own gradient background

When `epicId` was removed from `ConstellationTrail`, it stopped fetching its own path image. However, `ConstellationTrail` still renders a fallback gradient background (`bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950`) which creates the visual appearance of "double images".

---

## Solution

Add a `transparentBackground` prop to `ConstellationTrail` so that when the parent component handles the path image, the constellation can overlay it cleanly without adding its own background.

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/ConstellationTrail.tsx` | Add `transparentBackground?: boolean` prop to interface and conditionally skip background rendering |
| `src/components/JourneyPathDrawer.tsx` | Pass `transparentBackground={!!pathImageUrl}` when path image exists |

---

## Technical Details

### 1. Update ConstellationTrail interface (lines 24-33)

```tsx
interface ConstellationTrailProps {
  progress: number;
  targetDays: number;
  className?: string;
  companionImageUrl?: string;
  companionMood?: string;
  showCompanion?: boolean;
  milestones?: TrailMilestone[];
  epicId?: string;
  transparentBackground?: boolean; // NEW: Skip background when parent handles it
}
```

### 2. Update ConstellationTrail component (line 837+)

```tsx
export const ConstellationTrail = memo(function ConstellationTrail({ 
  progress, 
  targetDays,
  className,
  companionImageUrl,
  companionMood,
  showCompanion = true,
  milestones: propMilestones,
  epicId,
  transparentBackground = false // NEW
}: ConstellationTrailProps) {
```

### 3. Update background rendering logic (lines 909-911)

```tsx
<div 
  className={cn(
    "relative w-full h-56 rounded-xl overflow-hidden",
    // Only add background gradient if not transparent mode and no path image
    !transparentBackground && !pathImageUrl && "bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950",
    className
  )}
```

### 4. Skip nebula glow when transparent (lines 951-957)

```tsx
{/* Nebula glow effect - show when no path image AND not transparent */}
{!pathImageUrl && !transparentBackground && (
  <div className="absolute inset-0 opacity-40">
    ...
  </div>
)}
```

### 5. Update JourneyPathDrawer call (lines 168-176)

```tsx
<ConstellationTrail
  progress={epic.progress_percentage}
  targetDays={epic.target_days}
  companionImageUrl={companion?.current_image_url}
  companionMood={companion?.current_mood}
  showCompanion={true}
  milestones={trailMilestones}
  transparentBackground={!!pathImageUrl}  // NEW: Transparent when path image exists
  className="h-40"
/>
```

---

## Visual Result

```text
Before (double layer):           After (clean overlay):
┌──────────────────────┐        ┌──────────────────────┐
│ [AI Path Image]      │        │                      │
│                      │        │   [AI Path Image]    │
├──────────────────────┤   →    │   with transparent   │
│ [Gradient Background]│        │   constellation      │
│ [Constellation SVG]  │        │   overlay            │
└──────────────────────┘        └──────────────────────┘
```

The constellation path (stars, milestones, companion) will cleanly overlay on the AI-generated image without its own background creating visual separation.

