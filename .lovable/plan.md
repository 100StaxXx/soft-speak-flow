

# Consolidate Campaigns into Quests Tab

## Overview

Remove the **Campaigns** bottom nav tab and integrate campaign management into the **Quests** page. This eliminates navigation redundancy since campaign rituals already surface in the Quests tab daily.

## Current Architecture

```text
Bottom Nav (5 tabs):
┌──────────┬───────────┬──────────┬───────────┬─────────┐
│  Mentor  │ Companion │  Quests  │ Campaigns │ Command │
└──────────┴───────────┴──────────┴───────────┴─────────┘
```

**The overlap**: Campaign rituals already appear in Quests, grouped by campaign name. Users toggle completion there. Visiting Campaigns separately is only needed for:
1. Viewing the constellation trail progress
2. Creating/managing campaigns
3. Seeing milestones and story chapters

## Proposed Design

### 1. Add Campaigns Header Section in Quests

Above the date pills, show a compact "active campaigns" strip that expands to full campaign cards:

```text
┌─────────────────────────────────────────────────────┐
│                      QUESTS                          │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐ │
│  │ ★ Active Campaigns (1/2)                    [+] │ │  ← Tappable header
│  │ ┌─────────────────────────────────────────────┐ │ │
│  │ │ 🌟 Morning Routine Master  ━━━━━━━━○  67%  │ │ │  ← Collapsed card
│  │ │    3 rituals today • 12 days left          │ │ │
│  │ └─────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  [MON] [TUE] [WED] [THU] [FRI] [SAT] [SUN]          │  ← Date pills
├─────────────────────────────────────────────────────┤
│  Today's Tasks...                                    │
└─────────────────────────────────────────────────────┘
```

### 2. Expand to Full Campaign View

Tapping a campaign card expands it inline or opens the `JourneyDetailDrawer`:

- Show constellation trail with companion
- Milestones/chapters progress  
- Rituals list with today's completion status
- "Adjust Plan" and "Complete Journey" actions

### 3. Campaign Creation from Quests

The `[+]` button in the campaigns header opens the existing `Pathfinder` wizard.

### 4. Updated Bottom Nav (4 tabs)

```text
┌──────────┬───────────┬──────────┬─────────┐
│  Mentor  │ Companion │  Quests  │ Command │
└──────────┴───────────┴──────────┴─────────┘
```

More breathing room, cleaner navigation, touch targets slightly larger.

## File Changes

| File | Change |
|------|--------|
| `src/components/BottomNav.tsx` | Remove Campaigns NavLink (lines 140-156) |
| `src/pages/Journeys.tsx` | Add campaigns section header, import `EpicsTab` logic, add Pathfinder wizard state |
| `src/components/TodaysAgenda.tsx` | Add compact campaign cards above content |
| `src/App.tsx` | Keep `/campaigns` route but redirect to `/journeys` for backwards compatibility |
| New: `src/components/CampaignStrip.tsx` | Compact collapsible campaign overview component |

## Component: CampaignStrip

A new component that shows:
- Active campaign count badge (e.g., "1/2")
- Collapsed view: horizontal cards with title, progress bar, rituals count
- Add button to create new campaign (opens Pathfinder)
- Tap to expand inline or open JourneyDetailDrawer

## Implementation Steps

1. **Create CampaignStrip component**
   - Use existing `useEpics` hook for data
   - Reuse `ConstellationTrail` for inline progress visualization
   - Show ritual count for today using existing grouping logic

2. **Integrate into Journeys page**
   - Add CampaignStrip above DatePillsScroller
   - Wire up Pathfinder wizard for creating new campaigns
   - Connect campaign card taps to JourneyDetailDrawer

3. **Update BottomNav**
   - Remove Campaigns tab
   - Adjust spacing for 4 tabs

4. **Route redirect**
   - Change `/campaigns` to redirect to `/journeys`
   - Update any deep links or internal navigation

5. **Clean up**
   - Keep `src/pages/Campaigns.tsx` temporarily for redirect
   - Update any tour/tutorial references

## Benefits

- **Reduces cognitive load**: One place for all daily activity
- **Eliminates redundancy**: Campaign rituals already live in Quests
- **Cleaner nav**: 4 tabs instead of 5
- **Better flow**: See campaign progress *while* completing rituals
- **Faster access**: No tab switching to check campaign status

## Considerations

- Users with completed campaigns history can still see them in the expanded view
- The "2 active campaigns max" rule continues to apply
- First-time campaign tutorial (`EpicsTutorialModal`) moves to Quests context

