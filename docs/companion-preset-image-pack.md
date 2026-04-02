# Companion Preset Image Pack

## Scope
- Active roster: `dragon`, `wolf`, `kitsune`, `owl`, `lion`, `phoenix`, `pegasus`, `griffin`, `sphinx`, `leviathan`, `mechanicaldragon`, `tanuki`, `buttercat`
- Storage slug compatibility: `kitsune` continues using the preset/storage slug `fox`
- Legacy compatibility: `raven` remains in the preset table for existing companions, but is no longer part of the active selection roster
- Elements: `fire`, `ice`, `storm`, `nature`, `void`, `light`
- States: `normal`, `neglected`, `dormant`
- Stages: `0..14`
- Shared Stage 0 eggs:
  - `t0_egg` -> stage `0`
  - shared across the roster, keyed only by element
  - bundled locally in `public/companion-eggs`
- Preset art tiers:
  - `t1_youth` -> stages `1..3`
  - `t2_guardian` -> stages `4..6`
  - `t3_champion` -> stages `7..9`
  - `t4_mythic` -> stages `10..12`
  - `t5_apex` -> stages `13..14`

## File spec
- Transparent background
- Square master: `2048x2048`
- PNG or lossless WebP
- Same framing for every preset across all tiers, states, and elements
- Element changes palette and ambient effects only
- Neglected changes posture and expression only
- Dormant changes posture and eyes only

## Filename convention
Preset examples:
```text
dragon__t3_champion__normal__fire.png
wolf__t1_youth__neglected__void.png
buttercat__t5_apex__dormant__light.png
```

Shared egg examples:
```text
egg__t0_egg__normal__fire.png
egg__t0_egg__normal__void.png
```

## Storage layout
```text
companion-eggs/
  egg__t0_egg__normal__{element}.png

companion-presets/
  {preset_slug}/
    {tier}/
      {state}/
        {preset_slug}__{tier}__{state}__{element}.png
```

## Asset count
- Shared egg library: `6 elements = 6`
- Per preset pack: `5 tiers * 3 states * 6 elements = 90`
- Active roster preset total: `13 presets * 90 = 1170`
- Combined shipped total: `1170 + 6 shared eggs = 1176`

## Preset anchors
- `dragon`: western dragon silhouette, swept horns, luminous chest core, long tail
- `wolf`: thick neck ruff, alert ears, confident forward stance
- `kitsune` (`fox` slug): fox spirit silhouette, oversized ears, luminous cheek markings, flowing tail fan
- `owl`: round facial disk, ear tufts, bright moon-eyes
- `lion`: solar mane, broad paws, tufted tail
- `phoenix`: flame crest, ember tail streamers, radiant wing edges
- `pegasus`: feathered wings, windswept mane, athletic horse build
- `griffin`: eagle beak, feathered forequarters, leonine hindquarters, proud hybrid silhouette
- `sphinx`: lion body, feathered wings, poised regal posture, knowing gaze
- `leviathan`: serpentine body, fin-frill silhouette, luminous gill lines
- `mechanicaldragon`: plated alloy scales, articulated wing struts, engineered core glow
- `tanuki`: dark eye mask, plush striped tail, round canine body, playful trickster posture
- `buttercat`: cat face, butterfly wings, soft antennae optional, plush tail

## Generation order
1. Maintain the shared Stage 0 egg sheet as the universal onboarding/reset entry point.
2. Create one identity reference sheet per preset.
3. Generate `normal` art for `t1_youth` through `t5_apex`.
4. Derive the six element variants for each preset tier.
5. Derive `neglected` and `dormant` from the matching preset tier+element render.
6. QA for silhouette drift, framing drift, and anatomy violations before upload.
