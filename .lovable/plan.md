

# Remove Check-In Button from Journey Path Drawer

## Summary

Remove the "Check-In" button from the `JourneyPathDrawer` and center the remaining "View Milestones" button.

---

## File to Change

| File | Change |
|------|--------|
| `src/components/JourneyPathDrawer.tsx` | Remove Check-In button and center View Milestones |

---

## Current Code (lines 187-199)

```tsx
{/* Action Buttons */}
<div className="flex gap-3">
  <JourneyDetailDrawer ...>
    <Button variant="outline" className="flex-1 gap-2">
      <Map className="w-4 h-4" />
      View Milestones
    </Button>
  </JourneyDetailDrawer>
  
  <EpicCheckInDrawer ...>
    ...Check-In button...
  </EpicCheckInDrawer>
</div>
```

---

## New Code

```tsx
{/* Action Button */}
<div className="flex justify-center">
  <JourneyDetailDrawer
    epicId={epic.id}
    epicTitle={epic.title}
    epicGoal={epic.description}
    currentDeadline={epic.end_date}
  >
    <Button variant="outline" className="gap-2">
      <Map className="w-4 h-4" />
      View Milestones
    </Button>
  </JourneyDetailDrawer>
</div>
```

---

## Additional Cleanup

Since the `EpicCheckInDrawer` import and related code will no longer be used:

1. Remove unused import: `EpicCheckInDrawer`
2. Remove unused `habits` memo (lines 68-80) - no longer needed
3. Remove unused `todayRitualCount` memo (lines 83-93) - no longer needed

---

## Visual Result

```text
┌────────────────────────────────────────┐
│  🎯 RUN A MARATHON                 [X] │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│  0% Complete           🔥 86d left     │
│                                        │
│  [Journey Path Image]                  │
│                                        │
│  ⭐ 7 milestones  📅 90d journey       │
│                                        │
│        [VIEW MILESTONES]               │  ← Centered button
│                                        │
└────────────────────────────────────────┘
```

