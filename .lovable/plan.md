
# Fix Astral Encounter Game Layout - Content Bunched at Top

## Problem

The Astral Encounter mini-games (EnergyBeamGame, GalacticMatchGame, etc.) show all content bunched at the top of the screen, leaving a huge empty space below. The game's enemies/cards/elements don't render where expected.

## Root Cause

Layout hierarchy issue in `AstralEncounterModal.tsx`:

```text
DialogContent (overflow-hidden)
└── motion.div (min-h-[500px], max-h-[90dvh], overflow-y-auto)
    └── div.relative.z-10  ← NO HEIGHT DEFINED
        └── BattleOverlay  ← Takes its natural height
        └── EnergyBeamGame (h-full) ← h-full = 0 because parent has no height!
```

The game component uses `h-full` to fill its parent, but the parent `div.relative.z-10` has no explicit height. This causes the game area to collapse.

---

## Solution

1. Make the `relative z-10` container use flexbox column with `h-full`
2. Make the battle phase wrapper use `flex-1` to expand
3. Ensure the game component's parent has defined height to inherit

---

## Changes

**File: `src/components/astral-encounters/AstralEncounterModal.tsx`**

### Change 1: Fix the main content container (line 402)

Current:
```tsx
<div className="relative z-10">
```

Change to:
```tsx
<div className="relative z-10 flex flex-col h-full min-h-[500px]">
```

### Change 2: Fix the battle phase wrapper (lines 470-502)

Current:
```tsx
{phase === 'battle' && !needsFullscreen && (
  <motion.div
    key={`battle-${currentPhaseIndex}`}
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -50 }}
  >
    {/* Battle HP Overlay */}
    <BattleOverlay ... />
    ...
    {renderMiniGame()}
  </motion.div>
)}
```

Change to use flex column layout with game expanding:
```tsx
{phase === 'battle' && !needsFullscreen && (
  <motion.div
    key={`battle-${currentPhaseIndex}`}
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -50 }}
    className="flex flex-col flex-1 min-h-0"
  >
    {/* Battle HP Overlay - fixed height */}
    <BattleOverlay ... />
    
    {/* Phase indicators */}
    ...
    
    {/* Game container - flex-1 to fill remaining space */}
    <div className="flex-1 min-h-0">
      {renderMiniGame()}
    </div>
  </motion.div>
)}
```

### Change 3: Ensure parent motion.div passes height (lines 389-394)

Current:
```tsx
<motion.div 
  className="relative min-h-[500px] max-h-[90dvh] overflow-y-auto"
  ...
>
```

Change to:
```tsx
<motion.div 
  className="relative min-h-[500px] max-h-[90dvh] overflow-hidden flex flex-col"
  ...
>
```

Note: Changed `overflow-y-auto` to `overflow-hidden` to prevent scroll conflicts with games that need fixed viewport.

---

## Visual Result

```text
Before (broken):               After (fixed):
┌─────────────────────┐       ┌─────────────────────┐
│ [Boss Portrait]     │       │ [Boss Portrait]     │
│ DRIFT SPECTER       │       │ DRIFT SPECTER       │
│ ████████░░░░ 55/80  │       │ ████████░░░░ 55/80  │
│ WAVE 2 | ❤️❤️🤍     │       │ WAVE 2 | ❤️❤️🤍     │
│                     │       │                     │
│                     │       │    ▲ (enemies)      │
│   (empty space)     │       │  ▲   ▲   ▲         │
│                     │       │                     │
│                     │       │      ⚡ (projectiles)│
│                     │       │                     │
│                     │       │    🚀 (player ship)  │
│                     │       │  [◀]         [▶]   │
└─────────────────────┘       └─────────────────────┘
```

---

## Files Modified

1. `src/components/astral-encounters/AstralEncounterModal.tsx`
   - Lines 389-394: Add flex column, change overflow
   - Line 402: Add flex column and height classes
   - Lines 470-502: Wrap game in flex-1 container
