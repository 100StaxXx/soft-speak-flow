
# Add "QUESTS" Divider Header

## Change
**File: `src/components/TodaysAgenda.tsx`** (lines 818-819)

Insert a "QUESTS" divider header right before the timeline content, using the exact same styling as the "CAMPAIGNS" divider (lines 961-967):

```
<div className="flex items-center gap-2 mb-3">
  <div className="w-9 flex-shrink-0" />
  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
    <Target className="h-3 w-3" />
    Quests
  </div>
  <div className="flex-1 border-t border-dashed border-border/40" />
</div>
```

This goes between the XP summary row and the timeline content (line 818-819), so it always shows -- whether there are quests or not. The empty state below it (lines 820-829) stays as-is and renders underneath the header when there are no quests.

One file, one insertion. Matches the campaigns header exactly.
