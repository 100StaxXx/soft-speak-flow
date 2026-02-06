

# Inline Chevron Dropdown for Rituals

## Overview

Replace the separate "Show rituals / Hide rituals" toggle with the chevron icon in the campaign header row. Clicking the chevron will expand/collapse the rituals, while clicking the rest of the header will still open the `JourneyPathDrawer`.

## Visual Change

**Before:**
```text
┌─────────────────────────────────────────────┐
│ 📍 Run a Marathon   0%  · 90d    0/5  ▶     │
└─────────────────────────────────────────────┘
    [ Show rituals  ▼ ]
    [ ] Morning stretches                 +10
```

**After:**
```text
┌─────────────────────────────────────────────────┐
│ 📍 Run a Marathon   0%  · 90d    0/5    ▼       │  ← chevron toggles rituals
└─────────────────────────────────────────────────┘
    [ ] Morning stretches                     +10
```

## Changes

| File | Change |
|------|--------|
| `src/components/TodaysAgenda.tsx` | (1) Replace `ChevronRight` with `ChevronDown` that rotates based on expansion state, (2) Add `onClick` + `stopPropagation` to chevron, (3) Remove "Show/Hide rituals" toggle row, (4) Move `CollapsibleContent` directly under header |

---

## Technical Details

### 1. Update the Header Row (lines 1027-1035)

Replace the current `ChevronRight` with a clickable `ChevronDown` that toggles expansion:

**Current:**
```tsx
<div className="flex items-center gap-2 shrink-0">
  <Badge variant="outline" className={...}>
    {group.completedCount}/{group.totalCount}
  </Badge>
  <ChevronRight className="w-4 h-4 text-muted-foreground" />
</div>
```

**New:**
```tsx
<div className="flex items-center gap-2 shrink-0">
  <Badge variant="outline" className={...}>
    {group.completedCount}/{group.totalCount}
  </Badge>
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      toggleCampaign(campaignId);
    }}
    className="p-1 -m-1 hover:bg-muted/50 rounded transition-colors"
    aria-label={isExpanded ? "Hide rituals" : "Show rituals"}
  >
    <ChevronDown className={cn(
      "w-4 h-4 text-muted-foreground transition-transform duration-200",
      !isExpanded && "-rotate-90"
    )} />
  </button>
</div>
```

### 2. Remove Separate Toggle Row (lines 1063-1073)

Delete the `<CollapsibleTrigger>` with "Show rituals / Hide rituals" text:

```tsx
// DELETE THIS BLOCK:
<CollapsibleTrigger className="w-full">
  <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
    <span>{isExpanded ? "Hide rituals" : "Show rituals"}</span>
    <ChevronDown className={cn(...)} />
  </div>
</CollapsibleTrigger>
```

### 3. Simplify Collapsible Structure (lines 1064-1079)

Keep only the `CollapsibleContent` (no trigger needed since we handle toggle manually):

**Current:**
```tsx
<Collapsible open={isExpanded} onOpenChange={() => toggleCampaign(campaignId)}>
  <CollapsibleTrigger className="w-full">
    ...
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="pl-4 border-l border-accent/20 ml-3 pb-2">
      {group.tasks.map((task) => renderTaskItem(task))}
    </div>
  </CollapsibleContent>
</Collapsible>
```

**New:**
```tsx
<Collapsible open={isExpanded}>
  <CollapsibleContent>
    <div className="pl-4 border-l border-accent/20 ml-3 pb-2 pt-2">
      {group.tasks.map((task) => renderTaskItem(task))}
    </div>
  </CollapsibleContent>
</Collapsible>
```

### 4. Handle Standalone Rituals (lines 1041-1060)

For standalone rituals (not part of a campaign), add the same chevron toggle pattern to the standalone header so they can also expand/collapse:

```tsx
<div className={cn(
  "flex items-center justify-between py-2 px-3 rounded-xl",
  "border border-border/30 bg-card/30",
  isComplete && "bg-green-500/10 border-green-500/20"
)}>
  <div className="flex items-center gap-2 min-w-0">
    {/* ... icon and title ... */}
  </div>
  <div className="flex items-center gap-2">
    <Badge variant="outline" className={...}>
      {group.completedCount}/{group.totalCount}
    </Badge>
    <button
      type="button"
      onClick={() => toggleCampaign(campaignId)}
      className="p-1 -m-1 hover:bg-muted/50 rounded transition-colors"
    >
      <ChevronDown className={cn(
        "w-4 h-4 text-muted-foreground transition-transform duration-200",
        !isExpanded && "-rotate-90"
      )} />
    </button>
  </div>
</div>
```

---

## User Experience

| Action | Result |
|--------|--------|
| Tap campaign title/stats | Opens `JourneyPathDrawer` with path image |
| Tap chevron (▼) | Expands/collapses ritual list |
| Chevron rotates | Points down when expanded, right when collapsed |

## Result

- Cleaner UI with one less row per campaign
- Intuitive chevron toggle behavior matching standard UI patterns
- No gesture conflicts between drawer and expand/collapse

