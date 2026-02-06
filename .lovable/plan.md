

# Merge Rituals with Campaign Headers (Option 4)

## Overview

Remove the standalone "RITUALS" header badge and integrate campaign-level stats directly into each campaign group header in the daily agenda. Users will still access the full journey path image and stats by tapping the campaign header, which opens the `JourneyPathDrawer`.

## What You'll Get

**Campaign-level stats preserved:**
- Days left until deadline
- Progress percentage  
- Today's ritual completion count (3/5 today)
- Access to the full journey path image (by tapping campaign header)

**New visual layout:**
```text
┌────────────────────────────────────────────────┐
│  QUESTS                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  [ ] Walk 10,000 steps                    +15  │
│  [ ] Review weekly goals                  +20  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 📍 Run a Marathon    45%  · 87d   3/5 ▶ │  │
│  └──────────────────────────────────────────┘  │
│      [ Show rituals / Hide rituals ]           │
│      [ ] Morning stretches                +10  │
│      [✓] Hydration tracking               +10  │
│      [ ] Evening run                      +15  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 📍 Read 12 Books     20%  · 120d  2/2 ▶ │  │
│  └──────────────────────────────────────────┘  │
│      [✓] Read 20 pages                    +10  │
│      [✓] Book notes                       +10  │
│                                                │
└────────────────────────────────────────────────┘
```

## Changes Summary

| File | Change |
|------|--------|
| `src/components/TodaysAgenda.tsx` | (1) Expand `activeEpics` prop type to include full epic metadata, (2) Remove "RITUALS" badge header (lines 986-1008), (3) Enhance campaign group headers with stats + wrap with `JourneyPathDrawer`, (4) Separate expand/collapse to a toggle below header |
| `src/pages/Journeys.tsx` | (1) Remove `<CampaignStrip />` (line 687), (2) Pass full epic objects to `TodaysAgenda` |
| `src/components/CampaignStrip.tsx` | No changes needed - will be unused after CampaignStrip removal |

---

## Technical Details

### 1. Update `TodaysAgenda.tsx` Props (line 105)

**Current:**
```tsx
activeEpics?: Array<{ id: string; title: string; progress_percentage?: number | null }>;
```

**New:**
```tsx
activeEpics?: Array<{
  id: string;
  title: string;
  description?: string | null;
  progress_percentage?: number | null;
  target_days: number;
  start_date: string;
  end_date: string;
  epic_habits?: Array<{
    habit_id: string;
    habits: {
      id: string;
      title: string;
      difficulty: string;
      description?: string | null;
      frequency?: string;
      estimated_minutes?: number | null;
      custom_days?: number[] | null;
    };
  }>;
}>;
```

### 2. Add Helper Functions (near top of file)

```tsx
import { differenceInDays } from "date-fns";

const getDaysLeft = (endDate?: string) => {
  if (!endDate) return null;
  return Math.max(0, differenceInDays(new Date(endDate), new Date()));
};
```

### 3. Remove RITUALS Badge Header (lines 986-1008)

Delete the entire `<TooltipProvider>` block that renders:
- The "Rituals" label
- The badge showing ritual count
- The "New!" tooltip

### 4. Enhance Campaign Group Headers (lines 1011-1058)

Transform the current collapsible trigger from a simple expand/collapse to:

**A) Tappable header that opens `JourneyPathDrawer`:**
```tsx
import { JourneyPathDrawer } from "@/components/JourneyPathDrawer";

// Inside the map over ritualsByCampaign:
const epicData = activeEpics?.find(e => e.id === campaignId);
const progress = Math.round(epicData?.progress_percentage ?? 0);
const daysLeft = getDaysLeft(epicData?.end_date);

return (
  <div key={campaignId}>
    {/* Tappable header opens journey path drawer */}
    {epicData && campaignId !== 'standalone' ? (
      <JourneyPathDrawer epic={epicData}>
        <button className="w-full text-left">
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg 
            hover:bg-muted/30 border border-border/20 bg-card/30">
            <div className="flex items-center gap-2 min-w-0">
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Target className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="text-xs font-medium truncate">
                {group.title}
              </span>
              <span className="text-primary font-bold text-xs">
                {progress}%
              </span>
              {daysLeft !== null && (
                <span className="text-muted-foreground text-xs">
                  · {daysLeft}d
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-4 px-1.5 text-xs">
                {group.completedCount}/{group.totalCount}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </button>
      </JourneyPathDrawer>
    ) : (
      // Standalone rituals - no drawer, just show header
      <div className="flex items-center justify-between py-1.5 px-2">
        <span className="text-xs font-medium">{group.title}</span>
        <Badge variant="outline">{group.totalCount}</Badge>
      </div>
    )}
    
    {/* Separate expand/collapse toggle */}
    <Collapsible open={isExpanded} onOpenChange={() => toggleCampaign(campaignId)}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
          <span>{isExpanded ? "Hide rituals" : "Show rituals"}</span>
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            isExpanded ? "" : "-rotate-90"
          )} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-4 border-l border-accent/20 ml-2 pb-2">
          {group.tasks.map((task) => renderTaskItem(task))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
);
```

### 5. Update `Journeys.tsx`

**A) Remove CampaignStrip import and usage (lines 48 and 687):**
```tsx
// Remove this import:
import { CampaignStrip } from "@/components/CampaignStrip";

// Remove this component (line 687):
<CampaignStrip onAddCampaign={() => setShowPathfinder(true)} />
```

**B) Update activeEpics passed to TodaysAgenda (line 680):**

Currently passes minimal data. The `useEpics` hook already fetches full epic data with habits, so we just pass the full objects:

```tsx
// The activeEpics already has the full data from useEpics query
// Current (line 110-112):
const activeEpics = useMemo(() =>
  epics?.filter(e => e.status === 'active').slice(0, 5) || [],
  [epics]
);

// Already passes to TodaysAgenda at line 680:
activeEpics={activeEpics}
```

This already works - `useEpics` fetches `target_days`, `start_date`, `end_date`, `progress_percentage`, and `epic_habits` with full habit data.

### 6. Add Campaign Action Button

Since we're removing `CampaignStrip`, we need an alternate way to add campaigns. Options:
- Add a "+" button in the header area
- Add "Start a Campaign" as the first item when no campaigns exist
- Keep a minimal floating action

I'll add a subtle "Add Campaign" row when the user has fewer than 2 active campaigns, appearing after the last campaign group.

---

## User Experience Flow

1. User sees daily quests at top (unchanged)
2. Below quests, campaign groups appear with enhanced headers showing:
   - Campaign name + progress % + days left + completion count
   - Tap header → Opens `JourneyPathDrawer` with full journey path image
   - Below header: "Show/Hide rituals" toggle
3. When less than 2 campaigns, show "Start a Campaign" option
4. Clean, unified view - no more competing sections

## Result

- Rituals now grouped under campaign headers with stats
- One tap on campaign header shows beautiful journey path visualization
- Expand/collapse rituals is a separate action (no gesture conflict)
- Removed redundant Campaign Strip at bottom
- Cleaner, more integrated daily view

