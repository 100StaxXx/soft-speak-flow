
# Move Campaigns and Add Journey Path Viewer

## Overview

Move the campaign strip to the bottom of the Quests page and add a way for users to tap and view their full journey path progress image.

## Changes

### 1. Move CampaignStrip to Bottom

Currently the `CampaignStrip` renders at line 623, right after the header and before the date selector. We'll move it to after the `TodaysAgenda` component (around line 687).

**File:** `src/pages/Journeys.tsx`

```text
BEFORE (Current Order):
┌─────────────────────────────┐
│  QUESTS Header              │
│  CampaignStrip ← HERE       │
│  Date Selector              │
│  TodaysAgenda               │
└─────────────────────────────┘

AFTER (New Order):
┌─────────────────────────────┐
│  QUESTS Header              │
│  Date Selector              │
│  TodaysAgenda               │
│  CampaignStrip ← MOVED      │
└─────────────────────────────┘
```

### 2. Add Journey Path Viewer to Campaign Cards

When users tap a campaign in the strip, instead of opening the `JourneyDetailDrawer` (which shows milestones), we'll create a new drawer that shows the beautiful `ConstellationTrail` with the AI-generated journey path image.

**New Component:** `src/components/JourneyPathDrawer.tsx`

Features:
- Opens as a drawer when tapping a campaign in CampaignStrip
- Displays the `ConstellationTrail` component with the AI-generated path image
- Shows companion walking along the path with current progress
- Quick stats (days left, rituals today, % complete)
- Button to "View Milestones" that opens the existing JourneyDetailDrawer

### 3. Update CampaignCard to Use New Drawer

**File:** `src/components/CampaignStrip.tsx`

Change the `CampaignCard` component to:
- Wrap with new `JourneyPathDrawer` instead of `JourneyDetailDrawer`
- Pass epic data including milestones for the ConstellationTrail

## File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Journeys.tsx` | Move `<CampaignStrip>` from line 623 to after `TodaysAgenda` (~line 687) |
| `src/components/JourneyPathDrawer.tsx` | New component - drawer showing ConstellationTrail with path image |
| `src/components/CampaignStrip.tsx` | Update `CampaignCard` to use `JourneyPathDrawer` |

## New Component: JourneyPathDrawer

```text
┌─────────────────────────────────────────┐
│ ─────── (drawer handle)                 │
│                                         │
│  📍 Run a Marathon                      │
│  ━━━━━━━━━━━━━○ 45%  ·  87d left        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │    [AI-Generated Journey Path]      │ │
│ │    [ConstellationTrail with         │ │
│ │     companion walking along         │ │
│ │     the cosmic path]                │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│  🔥 5 rituals today  ·  ⭐ 12 milestones │
│                                         │
│  [ View Milestones ]  [ Check-In ]      │
│                                         │
└─────────────────────────────────────────┘
```

## Technical Details

**JourneyPathDrawer props:**
```tsx
interface JourneyPathDrawerProps {
  epic: {
    id: string;
    title: string;
    description?: string;
    progress_percentage: number;
    target_days: number;
    start_date: string;
    end_date: string;
    epic_habits?: Array<{...}>;
  };
  children?: React.ReactNode;
}
```

**Integration with existing hooks:**
- Uses `useJourneyPathImage(epicId)` for the path image
- Uses `useMilestones(epicId)` for milestone count and trail data
- Uses `useCompanion()` for companion display on trail

**Reuses existing components:**
- `ConstellationTrail` - the main star path visualization
- `JourneyDetailDrawer` - linked via "View Milestones" button
- `EpicCheckInDrawer` - linked via "Check-In" button

## Result

Users will:
1. See campaigns at the bottom of their daily quests (less intrusive)
2. Tap a campaign to see a beautiful full-width view of their AI-generated journey path with their companion walking along it
3. Have quick access to "View Milestones" and "Check-In" from this view
