
# Fix iOS Widget Display Issues & Add Ritual Count

## Issues Identified

### Issue 1: Yellow Background with Red X
The yellow placeholder with the red "prohibited" symbol is iOS's default widget placeholder image. This appears because:
- The CosmiqWidget extension is missing its own `Assets.xcassets` folder
- Widgets need a `WidgetBackground` and `AccentColor` defined in their assets
- Without these, iOS falls back to the placeholder image in the empty state area

### Issue 2: "0/0" Count Missing Rituals
Currently the widget filters out rituals entirely but also excludes them from the count. You want to show quests-only in the list, but include ritual counts in the totals.

---

## Solution

### Part 1: Add Widget Assets Catalog

Create an `Assets.xcassets` folder for the widget extension with:
- `AccentColor.colorset` - Required by widget system
- `WidgetBackground.colorset` - Required for widget backgrounds

```text
ios/CosmiqWidget/Assets.xcassets/
├── Contents.json
├── AccentColor.colorset/
│   └── Contents.json (cosmic purple color)
└── WidgetBackground.colorset/
    └── Contents.json (cosmic dark background)
```

**AccentColor (Cosmic Purple):**
```json
{
  "colors": [{
    "color": {
      "color-space": "srgb",
      "components": {
        "red": "0.55",
        "green": "0.36",
        "blue": "0.95",
        "alpha": "1.0"
      }
    },
    "idiom": "universal"
  }],
  "info": { "author": "xcode", "version": 1 }
}
```

**WidgetBackground (Cosmic Dark):**
```json
{
  "colors": [{
    "color": {
      "color-space": "srgb",
      "components": {
        "red": "0.05",
        "green": "0.02",
        "blue": "0.15",
        "alpha": "1.0"
      }
    },
    "idiom": "universal"
  }],
  "info": { "author": "xcode", "version": 1 }
}
```

### Part 2: Add Ritual Count to Widget Data

**Modify `useWidgetSync.ts`** to track both:
- `questCount` / `questCompleted` - for the task list (quests only)
- `totalCount` / `totalCompleted` - for the counter (includes rituals)

**Modify `WidgetDataPlugin.ts`** to include:
```typescript
interface WidgetDataPlugin {
  updateWidgetData(options: {
    tasks: WidgetTask[];           // Quests only (for list)
    completedCount: number;        // Quests completed
    totalCount: number;            // Quests total
    ritualCount: number;           // NEW: Rituals total
    ritualCompleted: number;       // NEW: Rituals completed
    date: string;
  }): Promise<void>;
}
```

**Modify `WidgetData.swift`** to display combined count:
```swift
// In the view, show combined count
let questsComplete = data?.completedCount ?? 0
let questsTotal = data?.totalCount ?? 0
let ritualsComplete = data?.ritualCompleted ?? 0
let ritualsTotal = data?.ritualCount ?? 0

let totalComplete = questsComplete + ritualsComplete
let totalAll = questsTotal + ritualsTotal

// Display: "3/7" (combines quests + rituals)
Text("\(totalComplete)/\(totalAll)")
```

**Optional label** to distinguish:
- Progress ring shows overall progress
- Subtitle could show "2 quests • 5 rituals" for clarity

---

## Files to Modify

| File | Change |
|------|--------|
| `ios/CosmiqWidget/Assets.xcassets/` | **NEW** - Create asset catalog with AccentColor and WidgetBackground |
| `src/hooks/useWidgetSync.ts` | Add ritual count to sync data |
| `src/plugins/WidgetDataPlugin.ts` | Add ritualCount, ritualCompleted to interface |
| `ios/App/App/Plugins/WidgetData/WidgetDataPlugin.swift` | Parse new ritual fields |
| `ios/CosmiqWidget/WidgetData.swift` | Add ritualCount, ritualCompleted to WidgetTaskData struct |
| `ios/CosmiqWidget/WidgetViews.swift` | Display combined count (quests + rituals) |

---

## Technical Details

### Updated useWidgetSync.ts Logic

```typescript
// Separate quests and rituals
const quests = tasks.filter(task => !task.habit_source_id);
const rituals = tasks.filter(task => !!task.habit_source_id);

await WidgetData.updateWidgetData({
  tasks: questsOnly.slice(0, 10),  // Quests only for list
  completedCount: quests.filter(t => t.completed).length,
  totalCount: quests.length,
  ritualCount: rituals.length,
  ritualCompleted: rituals.filter(t => t.completed).length,
  date: taskDate,
});
```

### Updated Widget Display

The widget would show:
- **List**: Only quest tasks (current behavior)
- **Counter**: Combined total (e.g., "2/7" where 2 of 7 total tasks are done)
- **Optional subtitle**: "2 quests • 5 rituals" for breakdown

---

## Rebuild Required

After these changes, you'll need to:
1. Clean build in Xcode (Cmd + Shift + K)
2. Delete the widget from Home Screen
3. Re-add the widget

This ensures the new Assets.xcassets are properly bundled with the widget extension.
