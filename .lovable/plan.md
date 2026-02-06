

# Fix Duplicate Journey Path Image Generation

## Problem

Two images are being generated because the path generation is triggered from **two different places**:

1. **On Epic Creation** (`src/hooks/useEpics.ts` line 414): Immediately calls the edge function when the epic is created
2. **On Component Mount** (`src/components/ConstellationTrail.tsx` line 858): A `useEffect` calls `generateInitialPath()` when it detects no image exists

This causes a race condition where both fire before either knows the other has started.

## Solution

Remove the auto-generation from `ConstellationTrail.tsx` since epic creation already handles it. The component should only **display** the path, not trigger generation.

## Changes

| File | Change |
|------|--------|
| `src/components/ConstellationTrail.tsx` | Remove the `useEffect` that auto-generates the path (lines 856-860) |
| `src/components/ConstellationTrail.tsx` | Keep using the hook to fetch and display the image, just don't trigger generation |

## Code Change

**Before** (ConstellationTrail.tsx lines 855-860):
```tsx
// Auto-generate initial path when no image exists for this epic
useEffect(() => {
  if (epicId && !pathImageUrl && !isPathLoading && !isGenerating) {
    generateInitialPath();
  }
}, [epicId, pathImageUrl, isPathLoading, isGenerating, generateInitialPath]);
```

**After:**
```tsx
// Path generation is handled by useEpics when epic is created
// This component only displays the generated path
```

The hook will still be used to fetch the `pathImageUrl` - we just remove the auto-generation trigger.

## Why This Works

- Epic creation in `useEpics.ts` already handles initial generation (milestone 0)
- Milestone completion in `JourneyDetailDrawer.tsx` handles regeneration for subsequent milestones
- `ConstellationTrail` should be a display-only component, not a trigger

## Result

Only **one** image generated per epic creation, eliminating the duplicate generation and saving API calls.

