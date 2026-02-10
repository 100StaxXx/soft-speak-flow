

# Fix Inbox Header Spacing on iOS

## Problem
The "INBOX" header text overlaps with the iOS status bar, creating garbled/doubled text at the top of the screen. The sticky header positions at `top: env(safe-area-inset-top)` but its background doesn't extend upward to cover the safe area gap.

## Fix in `src/pages/Inbox.tsx`

**Line 81** -- Update the sticky header div:

- Change `top` from `env(safe-area-inset-top)` to `0`
- Add `padding-top: env(safe-area-inset-top)` to the header itself so its background fills the notch area and the content sits below it

This matches the proven pattern used in other pages (e.g., `GuildDetailHeader`, `BattleOverlay`) where the header's padding absorbs the safe area rather than offsetting via `top`.

### Before
```
top: env(safe-area-inset-top, 0px)  // header floats below safe area, gap shows through
```

### After
```
top: 0
padding-top: env(safe-area-inset-top, 0px)  // header extends into safe area, content pushed down
```

One small change, one file.
