

# Randomize Mini-Games for Resist Mode

## Overview

Change the resist mode so that any habit can spawn any of the 4 active mini-games, rather than being locked to a specific game based on the habit's theme.

## Current Behavior

When you resist a habit, the game is determined by the habit's theme:
- Doomscrolling (distraction) → always Tap Sequence
- Sugar Cravings (laziness) → always Energy Beam
- Stress Eating (anxiety) → always Orb Match

## New Behavior

Any resist action will randomly select from all 4 active games:
- Energy Beam (Star Defender)
- Tap Sequence (Cosmic Reflex)
- Orb Match
- Galactic Match

This adds variety and prevents encounters from feeling repetitive when resisting the same habit repeatedly.

## Technical Changes

### File: `src/utils/adversaryGenerator.ts`

**Modify `generateResistAdversary` function (lines 149-173):**

Replace the themed game selection:
```typescript
miniGameType: THEME_MINIGAME_MAP[habitTheme],
```

With random selection from active games:
```typescript
const ACTIVE_RESIST_GAMES: MiniGameType[] = [
  'energy_beam',
  'tap_sequence', 
  'orb_match',
  'galactic_match'
];

miniGameType: randomFrom(ACTIVE_RESIST_GAMES),
```

The theme is still preserved for:
- Adversary name generation (naming reflects the habit being resisted)
- Essence rewards (thematically relevant to the habit)
- Stat boosts (mind/body/soul still mapped to habit type)

### Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| Game selection | Based on habit theme | Random from 4 active games |
| Adversary name | Theme-based | Theme-based (unchanged) |
| Essence rewards | Theme-based | Theme-based (unchanged) |
| Stat boosts | Theme-based | Theme-based (unchanged) |

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/adversaryGenerator.ts` | Add ACTIVE_RESIST_GAMES array, modify generateResistAdversary to use random selection |

## Result

Every time you hit "Resist" on any habit, you'll get one of the 4 games at random, keeping the experience fresh while still maintaining the thematic adversary and rewards tied to the specific habit you're fighting.

