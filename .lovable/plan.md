
# Fix iOS Safe Area on Inbox Header

## Problem
The Inbox page header overlaps with the iOS status bar because it's missing the safe area padding that all other pages use.

## Change

In `src/pages/Inbox.tsx`, add `pt-safe` to the sticky header's top positioning so it respects the iOS notch/status bar area:

- Line 81: Change the sticky header div to include `pt-safe` padding, updating the `top` position so it sticks below the safe area
- Specifically, update the outer container (line 77) to include `pt-safe` like other pages (`Journeys.tsx`, `Campaigns.tsx`, etc.), and adjust the sticky header to sit below that safe area padding

**Concrete change:**
- Line 77: `"min-h-screen bg-background pb-24"` becomes `"min-h-screen bg-background pb-24 pt-safe"`
- Line 81: The sticky header gets `style={{ top: 'env(safe-area-inset-top, 0px)' }}` so it sticks correctly below the status bar, or alternatively the header itself gets the `pt-safe` class to pad its content down from the notch
