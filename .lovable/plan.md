
# Fix Double Journey Path Image

## Problem

The `JourneyPathDrawer` shows the journey path image twice because:

1. **Parent shows image** (lines 152-161): `JourneyPathDrawer` fetches `pathImageUrl` via `useJourneyPathImage(epic.id)` and renders it
2. **Child shows same image** (lines 168-177): `ConstellationTrail` receives `epicId={epic.id}` and independently fetches + renders the exact same image

Both components display the same AI-generated path image, creating the stacked appearance visible in the screenshot.

## Solution

Stop passing `epicId` to `ConstellationTrail` within `JourneyPathDrawer`. The parent already displays the background image, so the child doesn't need to fetch and display it again.

## Changes

| File | Change |
|------|--------|
| `src/components/JourneyPathDrawer.tsx` | Remove `epicId={epic.id}` prop from `ConstellationTrail` (line 175) |

---

## Technical Details

### Update ConstellationTrail Call (line 168-177)

**Current:**
```tsx
<ConstellationTrail
  progress={epic.progress_percentage}
  targetDays={epic.target_days}
  companionImageUrl={companion?.current_image_url}
  companionMood={companion?.current_mood}
  showCompanion={true}
  milestones={trailMilestones}
  epicId={epic.id}           // <-- REMOVE THIS
  className="h-40"
/>
```

**New:**
```tsx
<ConstellationTrail
  progress={epic.progress_percentage}
  targetDays={epic.target_days}
  companionImageUrl={companion?.current_image_url}
  companionMood={companion?.current_mood}
  showCompanion={true}
  milestones={trailMilestones}
  className="h-40"
/>
```

Without `epicId`, `ConstellationTrail` will:
- Not call `useJourneyPathImage`
- Not render its own background image
- Use a subtle fallback gradient instead
- Still render the constellation path, milestones, and companion avatar as an overlay

## Result

- Single journey path image displayed by the parent
- Constellation trail overlays on top with transparent background
- No duplicate images
