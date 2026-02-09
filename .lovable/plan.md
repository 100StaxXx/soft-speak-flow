

# Add Short Difficulty Labels to Quest Creation

## Overview

The difficulty selector currently shows only icons (Zap, Flame, Mountain) with no text. Add a very short label under each icon so users instantly understand what each means.

## Changes

### File: `src/components/AddQuestSheet.tsx` (lines 319-334)

Replace the icon-only circle buttons with slightly wider pill buttons that include a tiny label beneath the icon:

- **Easy** -- label: "Chill"
- **Medium** -- label: "Steady"  
- **Hard** -- label: "Beast"

Each button becomes a small vertical stack (icon + label) instead of just an icon circle. The buttons widen slightly from `w-9 h-9` to roughly `w-14 h-12` rounded pills, keeping the compact feel.

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` | Add short text labels ("Chill", "Steady", "Beast") below each difficulty icon |

