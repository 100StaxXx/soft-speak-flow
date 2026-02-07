
# Add Back Button to Journey Path Drawer

## Summary

Add a visible close button to the `JourneyPathDrawer` component header so users can easily dismiss the drawer and return to the main Quests view.

---

## Current Behavior

The drawer can only be closed by:
- Swiping down on the handle
- Tapping the darkened overlay area

This is not intuitive for many users, especially on mobile.

---

## Proposed Solution

Add an X (close) button in the top-right corner of the `JourneyPathDrawer` header that closes the drawer when tapped.

---

## File to Change

| File | Change |
|------|--------|
| `src/components/JourneyPathDrawer.tsx` | Add DrawerClose button to the header |

---

## Implementation Details

### Add DrawerClose import

```tsx
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,  // Add this
} from "@/components/ui/drawer";
```

### Add X icon import

```tsx
import { Target, Flame, Star, Map, Sparkles, Calendar, X } from "lucide-react";
```

### Update DrawerHeader (lines 118-137)

Add a close button in the header with absolute positioning:

```tsx
<DrawerHeader className="pb-2 relative">
  {/* Close button */}
  <DrawerClose asChild>
    <Button 
      variant="ghost" 
      size="icon" 
      className="absolute right-2 top-2 h-8 w-8 rounded-full"
    >
      <X className="w-4 h-4" />
      <span className="sr-only">Close</span>
    </Button>
  </DrawerClose>
  
  <DrawerTitle className="flex items-center gap-2 pr-10">
    <Target className="w-5 h-5 text-primary" />
    {epic.title}
  </DrawerTitle>
  
  {/* Progress bar with stats */}
  <div className="mt-3 space-y-2">
    ...
  </div>
</DrawerHeader>
```

---

## Visual Result

```text
┌────────────────────────────────────────┐
│  🎯 RUN A MARATHON                 [X] │  ← X button in top right
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│  0% Complete           🔥 86d left     │
│                                        │
│  [Journey Path Image]                  │
│                                        │
│  🔥 5 rituals  ⭐ 7 milestones         │
│                                        │
│  [VIEW MILESTONES]  [CHECK-IN]         │
└────────────────────────────────────────┘
```

Tapping the X button will close the drawer and return the user to the main Quests page.

