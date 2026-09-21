# Companion Preset Image Pack

## Scope

- Active roster: `dragon`, `wolf`, `kitsune`, `owl`, `lion`, `phoenix`, `pegasus`, `griffin`, `sphinx`, `leviathan`, `mechanicaldragon`, `tanuki`, `buttercat`
- Storage slug compatibility: `kitsune` continues using the preset/storage slug `fox`
- Legacy compatibility: `raven` remains in the preset table for existing companions, but is no longer part of the active selection roster
- Elements: `fire`, `ice`, `storm`, `nature`, `void`, `light`
- Base state: `normal`
- Expressive moods: `excited`, `happy`, `calm`, `concerned`, `sleepy`
- Product forms: Egg (`0`), Hatchling (`1..4`), Initiate (`5..12`), Awakened (`13..20`), Guardian (`21..35`), Champion (`36..55`), Mythic (`56..80`), Ascended (`81..100`)
- Storage tiers remain `t0_egg`, `t1_youth`, `t2_guardian`, `t3_champion`, `t4_mythic`, and `t5_apex` for asset compatibility.

Time away never changes, damages, or replaces companion art. Absence-based variants are not generated.

## File spec

- Transparent background
- Square master: `2048x2048`
- PNG or lossless WebP
- Identical identity, framing, silhouette, and anatomy across every form, mood, variant, and element
- Element changes palette and ambient effects only
- Expression changes body language and face without changing the character design

## Filename and storage conventions

Base portrait:

```text
companion-presets/{preset_slug}/{tier}/normal/{preset_slug}__{tier}__normal__{element}.png
```

Expressive portrait:

```text
companion-presets/{preset_slug}/{tier}/{expression}/{preset_slug}__{tier}__{expression}__v{1-5}__{element}.png
```

Shared egg:

```text
companion-eggs/egg__t0_egg__normal__{element}.png
```

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

## Generation and review

1. Maintain the six shared elemental eggs as the universal entry point.
2. Lock one identity reference sheet per preset.
3. Generate the normal portrait for each storage tier and element.
4. Derive the five expressive moods from the matching normal portrait.
5. Produce `v1..v5` per mood while preserving the identity and crop family.
6. Reject silhouette drift, framing drift, anatomy violations, or unexplained costume changes before upload.

- Manifest + prompt pack: `npm run companions:expressive:manifest`
- 5x5 review sheets: `npm run companions:expressive:sheets`
- Review sheet layout: rows = moods, columns = variants, one sheet per preset+tier+element
