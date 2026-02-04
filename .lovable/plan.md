
# Fix iOS Widget Spacing and Add Quest/Ritual Distinction

## Issues Identified

### Issue 1: "Quests" Label Too Close to Top
The current small widget layout has the header text cramped against the top edge. Looking at the screenshot, the "Quests" label appears to be clipping at the boundary.

**Root Cause**: iOS 17+ `.containerBackground` has its own internal safe area handling, but the content uses a uniform `.padding()` that doesn't provide enough top margin for the header.

### Issue 2: No Quest/Ritual Distinction
The small widget shows "0/0 Complete" as a combined total but doesn't distinguish between quests and rituals. Users want to see their progress breakdown.

---

## Solution

### Part 1: Fix Header Spacing

Update `SmallWidgetView` to add more top padding and adjust the layout:

```swift
var body: some View {
    VStack(spacing: 6) {
        // Header with increased top margin
        HStack {
            Text("⚔️")
                .font(.caption)
            Text("Today")
                .font(.caption.bold())
                .foregroundColor(.cosmicText)
            Spacer()
        }
        .padding(.top, 4)  // Extra breathing room
        
        Spacer()
        
        // Central progress circle
        CosmicProgressCircle(...)
        
        // Combined count with quest/ritual breakdown
        ...
        
        Spacer()
    }
    .padding(.horizontal)
    .padding(.vertical, 8)  // Asymmetric padding
}
```

### Part 2: Add Quest/Ritual Breakdown to All Widget Sizes

**Small Widget** - Show breakdown below the counter:
```swift
// Current: "0/0" + "Complete"
// New:     "0/0" + "0Q • 0R" (or just "0 quests" if no rituals)

VStack(spacing: 2) {
    Text("\(completedCount)/\(totalCount)")
        .font(.subheadline.bold())
        .foregroundColor(.cosmicGold)
    
    if ritualCount > 0 {
        Text("\(questCount)Q • \(ritualCount)R")
            .font(.system(size: 9))
            .foregroundColor(.cosmicSecondary)
    } else if questCount > 0 {
        Text("\(questCount) quests")
            .font(.caption2)
            .foregroundColor(.cosmicSecondary)
    } else {
        Text("No tasks")
            .font(.caption2)
            .foregroundColor(.cosmicSecondary)
    }
}
```

**Medium Widget** - Already has breakdown, enhance visibility
**Large Widget** - Add breakdown to the header area

---

## Files to Modify

| File | Change |
|------|--------|
| `ios/CosmiqWidget/WidgetViews.swift` | Fix padding in SmallWidgetView, add quest/ritual breakdown display to all sizes |

---

## Detailed Changes to WidgetViews.swift

### SmallWidgetView Updates

1. Add `questCount` and `ritualCount` computed properties
2. Change padding from `.padding()` to `.padding(.horizontal).padding(.vertical, 8)` for better control
3. Add `.padding(.top, 4)` to the header HStack
4. Replace "Complete" text with quest/ritual breakdown

### MediumWidgetView Updates

1. Already has the breakdown - no changes needed

### LargeWidgetView Updates

1. Add quest/ritual breakdown text near the progress circle in the header

---

## Visual Layout After Fix

**Small Widget:**
```
┌────────────────────────┐
│  ⚔️ Today              │  <- More top padding
│                        │
│       ┌────┐           │
│       │ 0% │           │
│       └────┘           │
│         0/0            │
│       0Q • 0R          │  <- New breakdown
│                        │
└────────────────────────┘
```

**When no rituals:**
```
│         0/0            │
│       0 quests         │
```

**When complete:**
```
│         5/5            │
│      3Q • 2R ✓         │
```
