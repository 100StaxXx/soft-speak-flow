
# Fix Double Image Rendering in Journey Path

## Problem

The journey path image is appearing **twice** (stacked) because both `JourneyPathDrawer` AND `ConstellationTrail` are fetching and rendering the same AI-generated path image.

**Current flow:**
1. `JourneyPathDrawer` fetches `pathImageUrl` via `useJourneyPathImage(epic.id)`
2. `JourneyPathDrawer` renders the image in a `h-48` container
3. `JourneyPathDrawer` passes `epicId={epic.id}` to `ConstellationTrail`
4. `ConstellationTrail` also fetches `pathImageUrl` via `useJourneyPathImage(epicId)`
5. `ConstellationTrail` also renders the same image as its background

**Result:** Two identical images stacked on top of each other, as visible in the screenshot.

---

## Solution

Remove the `epicId` prop when calling `ConstellationTrail` from `JourneyPathDrawer`. This prevents `ConstellationTrail` from fetching/rendering the image since the parent component already handles that.

| File | Change |
|------|--------|
| `src/components/JourneyPathDrawer.tsx` | Remove `epicId={epic.id}` from line 175 |

---

## Code Change

**Before (line 168-177):**
```tsx
<ConstellationTrail
  progress={epic.progress_percentage}
  targetDays={epic.target_days}
  companionImageUrl={companion?.current_image_url}
  companionMood={companion?.current_mood}
  showCompanion={true}
  milestones={trailMilestones}
  epicId={epic.id}           // ← REMOVE THIS
  className="h-40"
/>
```

**After:**
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

---

## Why This Works

When `epicId` is undefined/not passed:
- `useJourneyPathImage(undefined)` returns `pathImageUrl: undefined`
- `ConstellationTrail` skips rendering the path image (line 924 condition fails)
- `ConstellationTrail` shows its fallback gradient background instead

The parent `JourneyPathDrawer` already renders the path image above the trail, so there's no visual loss.

---

## Result

```text
Before:                          After:
┌──────────────────────┐        ┌──────────────────────┐
│    [Path Image 1]    │        │    [Path Image]      │
├──────────────────────┤        │        ↓             │
│    [Path Image 2]    │   →    │ [Constellation Trail]│
│  Constellation Trail │        │   (no bg image)      │
└──────────────────────┘        └──────────────────────┘
```

This aligns with the architecture note: *"Removing the 'epicId' prop from 'ConstellationTrail' within 'JourneyPathDrawer' prevents stacked/double-rendering of the path background."*
