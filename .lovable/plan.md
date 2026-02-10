

# Fix Mini-Game Fitting and Duration (45-120 seconds)

## Two Problems

### 1. Layout Fitting Issue
The screenshot shows OrbMatch (Starburst) has too much vertical content crammed into the modal, with the adversary portrait, HP bar, game title, stats, level indicator, move timer, "Show Shapes" button, the grid, and legend all stacked. The game grid is pushed down, and content overflows or feels squished.

**Root cause**: The game renders inside a `flex-1 min-h-0` container (line 503 of AstralEncounterModal), but the games themselves don't constrain their layout to fit the available space. The BattleOverlay (adversary portrait + HP bar) takes significant vertical space, and each game adds its own HUD/header/footer on top of that.

**Fix approach for all 4 active games**:
- **OrbMatchGame**: The grid uses `max-w-xs` (280px) with a fixed `cellSize = 280/6 = 46px`. The grid's aspect ratio is `6/5`, so it's 280x233px. The issue is the surrounding chrome -- GameHUD title, level indicator, move timer bar, "Show Shapes" button, and bottom legend all add ~180px of extra height. Fix: Make the game layout use `flex-1` and `overflow-hidden`, shrink non-essential UI (remove "Show Shapes" button, integrate level indicator into GameHUD, reduce bottom legend to a single line), and ensure the grid fills available space.
- **EnergyBeamGame**: Uses `min-h-[500px]` which forces the container larger than needed. Change to use `flex-1` and `h-full` to fill the modal container naturally.
- **TapSequenceGame**: Game area uses `max-w-[280px] aspect-square` which is fine, but surrounding chrome (lives display, difficulty badge, instructions text) adds unnecessary height. Consolidate into compact layout.
- **GalacticMatchGame**: Uses `max-w-sm` with `aspectRatio` based on grid dimensions. Generally fits well but has extra spacing from combo indicator and progress bar that can be tightened.

**Shared fix**: Pass a new `inBattle` prop (or reuse the existing `compact` prop) from the modal. When games are rendered inside the battle modal with the BattleOverlay already showing the adversary portrait + HP, the games should hide their own title bars and use tighter spacing. The `compact` prop already exists but isn't being passed -- the modal should pass `compact={true}` when rendering in battle mode.

### 2. Duration Target: 45-120 seconds
Currently the games are "endless" mode -- they loop until HP is depleted via the battle system. The actual game duration depends on how quickly the player deals/takes damage. But several games have per-level timers that don't enforce an overall cap, meaning battles can drag on much longer than 2 minutes.

**Current timing per game**:
- **OrbMatch**: 60s per level (level 1), can loop through multiple levels endlessly. A full battle at medium difficulty could easily take 3-5 minutes.
- **EnergyBeamGame**: No timer at all (endless waves). Duration purely depends on HP depletion.
- **TapSequenceGame**: No timer (lives-based). Duration depends on player skill.
- **GalacticMatchGame**: No timer (lives-based). Duration depends on memory accuracy.

**Fix approach**: Add a global battle timer (45-120 seconds based on adversary tier) to the AstralEncounterModal itself. When the timer expires, auto-resolve the battle based on remaining HP percentages. This gives a hard cap on duration without changing individual game mechanics.

| Adversary Tier | Battle Time Limit |
|---|---|
| Common | 45s |
| Uncommon | 60s |
| Rare | 75s |
| Epic | 90s |
| Legendary | 120s |

When time expires: compare player HP% vs adversary HP%. If adversary has taken more % damage, it's a win. Otherwise, it's a loss.

## Technical Details

### Files to Change

| File | Change |
|---|---|
| `src/components/astral-encounters/AstralEncounterModal.tsx` | 1. Pass `compact={true}` to all games in battle mode. 2. Add a battle timer (45-120s by tier) that auto-resolves when expired. 3. Show a visible countdown timer in the BattleOverlay area. |
| `src/components/astral-encounters/OrbMatchGame.tsx` | 1. Remove "Show Shapes" button (accessibility toggle) from default view -- move to settings or remove. 2. Remove bottom legend row when `compact=true`. 3. Reduce the LevelIndicator + ScoreProgressRing + move timer section height. 4. Change outer container to `flex flex-col flex-1 min-h-0` to fit parent. |
| `src/components/astral-encounters/EnergyBeamGame.tsx` | 1. Change `min-h-[500px]` to `flex-1 min-h-0 h-full`. 2. When `compact=true`, hide power-up text labels and use icon-only display. |
| `src/components/astral-encounters/TapSequenceGame.tsx` | 1. When `compact=true`, collapse the lives + level + difficulty rows into a single compact header line. 2. Remove bottom instruction/info text. |
| `src/components/astral-encounters/GalacticMatchGame.tsx` | 1. When `compact=true`, tighten gap and padding. 2. Remove the practice indicator text at the bottom. |
| `src/components/astral-encounters/battle/BattleOverlay.tsx` | Add a battle timer display (countdown) below the HP bar. |
| `src/types/battleSystem.ts` | Add `TIER_BATTLE_DURATION` config mapping tier to seconds. |

### Battle Timer Implementation

In `AstralEncounterModal.tsx`:
- Start a countdown timer when phase changes to `'battle'`
- Pause when game is paused
- When timer hits 0, call a new `handleTimeExpired()` function that:
  - Compares `battleState.adversaryHPPercent` damage dealt vs `battleState.playerHPPercent` damage taken
  - If adversary took more % damage (lower HP%), player wins
  - Otherwise, player loses
  - Calls `handleBattleEnd()` with the appropriate outcome

### Layout Fix Summary

The key insight is that games already support a `compact` prop but the modal never passes it. Simply passing `compact={true}` from the battle modal will immediately reduce most of the chrome. The remaining fixes are:
- OrbMatch: remove the bottom legend and "Show Shapes" in compact mode, make game container fill available height
- EnergyBeam: replace `min-h-[500px]` with flex-based sizing
- All games: ensure outer container uses `flex-1 min-h-0` to respect parent constraints

