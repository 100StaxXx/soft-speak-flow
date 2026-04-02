# Rive Companion Motion v1 Spec

This is the drop-in asset contract for the hybrid companion motion system.

The app already ships with a code-authored fallback overlay in:
- [CompanionMotionLayer.tsx](/Users/macbookair/Developer/soft-speak-flow/src/components/companion/motion/CompanionMotionLayer.tsx)

When production `.riv` assets are ready, they should replace the fallback by populating the configured scene `src` values in:
- [companionMotion.ts](/Users/macbookair/Developer/soft-speak-flow/src/config/companionMotion.ts)

## File Locations

Place these files in `public/rive/companion/`:

1. `egg_idle_v1.riv`
2. `companion_aura_v1.riv`
3. `evolution_hero_v1.riv`

## Scene Contract

### `egg_idle_v1.riv`
- Artboard: `EggIdle`
- State machine: `EggIdleMachine`
- Purpose: egg pulse, inner light swirl, hatch-ready energy

### `companion_aura_v1.riv`
- Artboard: `CompanionAura`
- State machine: `CompanionAuraMachine`
- Purpose: reusable aura loop for the main companion surface across all non-egg stages

### `evolution_hero_v1.riv`
- Artboard: `EvolutionHero`
- State machine: `EvolutionHeroMachine`
- Purpose: modal-scale reveal layer for evolution start and reveal moments

## Expected State Machine Inputs

Each scene should expose these inputs with exactly these names:

1. `event_trigger`
   Type: Trigger
   Purpose: fires when a transient app event occurs

2. `event_code`
   Type: Number
   Purpose: identifies the active event type

3. `intensity`
   Type: Number
   Range: `0.0` to `1.0`
   Purpose: controls how dramatic the effect is

4. `stage_power`
   Type: Number
   Range: `0.22` to `1.0`
   Purpose: stage/tier prestige scaling

5. `is_idle`
   Type: Boolean
   Purpose: indicates when the scene should remain in ambient loop mode

## Event Code Mapping

Use these numeric values inside the state machine:

| Event | Code |
| --- | ---: |
| `idle` | 0 |
| `xp_gain` | 1 |
| `quest_complete` | 2 |
| `streak` | 3 |
| `wake` | 4 |
| `evolution_start` | 5 |
| `evolution_reveal` | 6 |

## Stage Power Mapping

The runtime sends these tier-weighted values:

| Stage Range | Power |
| --- | ---: |
| `0` | 0.22 |
| `1-4` | 0.34 |
| `5-12` | 0.46 |
| `13-20` | 0.58 |
| `21-35` | 0.70 |
| `36-55` | 0.82 |
| `56-80` | 0.92 |
| `81-100` | 1.00 |

## Art Direction

Keep the motion premium, restrained, and slow enough to feel expensive.

- Do not animate every surface. Only the main companion and evolution modal should use heavy scenes.
- Ambient loops should read as alive, not busy.
- Favor glow, layered opacity, orbital drift, halo geometry, and sparse particles.
- Avoid mascot-cartoon bounce, exaggerated squash/stretch, or high-frequency loops.
- Stage prestige should come from aura richness and geometry, not frantic movement.

### Element Language

- Fire: ember drift, heat shimmer, warm plume bloom
- Ice: crystalline shimmer, cool refraction, crisp sparkles
- Storm: charged arcs, fast linear accents, electric flicker
- Nature: leaf drift, organic spiral, living bloom
- Void: starfield hush, deep nebula gradients, distant glints
- Light: halo rings, noble bloom, celestial motes

## Performance Notes

- Scenes should be transparent-background overlays only.
- Keep artboards tight around the companion-safe framing area.
- Avoid unnecessarily large image assets inside the `.riv`.
- Target one active heavy Rive scene at a time on iOS webview.

## Integration Checklist

1. Export the three `.riv` files to `public/rive/companion/`.
2. Update `src` in [companionMotion.ts](/Users/macbookair/Developer/soft-speak-flow/src/config/companionMotion.ts).
3. Verify idle, XP, streak, wake, and evolution reactions on device.
4. Tune particle counts only if iOS performance remains smooth.
