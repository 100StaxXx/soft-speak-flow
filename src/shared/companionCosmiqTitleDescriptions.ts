import type { CompanionCosmiqTitle } from "./companionStatCosmiqTitles";
import { COMPANION_ATTRIBUTE_LABELS } from "./companionStatSignals";

export const COSMIQ_TITLE_FLAVOR_DESCRIPTIONS: Record<string, string> = {
  // Base titles — TITLE_POOLS
  "The Waking Flame": "An ember reawakening, breath by breath, into living warmth.",
  "The Life-Bound Strider": "A walker pulled forward by the steady pulse of their own heart.",
  "The Verdant Guardian": "A living shield rooted in renewal, recovery, and steady growth.",
  "The Radiant Vanguard": "A burning standard at the front, lighting the path for everyone behind.",
  "The Curious Seeker": "A quiet apprentice tracing patterns from the edges of every map.",
  "The Pattern Reader": "A mind that hears the music hidden in scattered signals.",
  "The Astral Scholar": "A star-lit reader turning patterns into insight and direction.",
  "The Celestial Sage": "A keeper of long-arc wisdom whose silence carries weight.",
  "The Promise Keeper": "A small flame of intention that refuses to be put out.",
  "The Iron Apprentice": "A learner shaping themselves on the anvil of daily practice.",
  "The Steady Sentinel": "A guardian whose discipline is felt before they speak.",
  "The Oathbound Champion": "A vow given form — every action a kept word.",
  "The Rising Survivor": "A figure standing again, dust on their shoulders, eyes ahead.",
  "The Ember-Warden": "A keeper of the inner flame when the wind tries to take it.",
  "The Ironheart": "A core of forged calm against any pressure that finds them.",
  "The Storm-Breaker": "A charged survivor stepping forward through thunder and fracture.",
  "The Spark Crafter": "A maker who turns small flickers into things that didn't exist before.",
  "The Dreamsmith": "A forge-worker of imagination, hammering shape into possibility.",
  "The Vision Forger": "A craftsperson who builds tomorrow from raw, uncut intent.",
  "The Mythmaker": "An author of legends drawn from their own unfolding life.",
  "The Inner Compass": "A first true heading, set by the quiet voice that won't lie.",
  "The Path Finder": "A traveler who reads the terrain of their own life.",
  "The Soulbound Guide": "A presence whose direction others feel before they understand.",
  "The Cosmic Harmonizer": "A balanced presence aligning scattered signals into one clear orbit.",

  // Rare variants
  "Sunforged Sentinel": "A guardian tempered in dawnlight, bright-edged and warm-hearted.",
  "The Blooming Titan": "A great force rooted in life, expanding gently in every direction.",
  "The Dawn-Walker": "A first-light figure carrying tomorrow on their shoulders.",
  "The Star-Eyed Oracle": "A seer whose gaze maps constellations onto everyday choices.",
  "The Mindbound Seer": "A reader of inner currents that shape the outer world.",
  "Keeper of the Inner Map": "A quiet cartographer of self, charting roads only they walk.",
  "The Unbroken Knight": "A vow-bearer who never set down the burden of their word.",
  "The Clockwork Guardian": "A precise protector whose every motion serves the next.",
  "The Iron-Willed Architect": "A builder of disciplined structure from sheer intention.",
  "The Scarred Champion": "A victor still carrying the marks of every fight that mattered.",
  "The Phoenix-Bound": "A spirit that returns brighter from each undoing.",
  "The Void-Walker": "A traveler at peace in the silences others cannot bear.",
  "The Starforged Creator": "A maker whose work gleams with materials gathered from the sky.",
  "The Painted Flame": "A vivid creator whose fire shows up first as color.",
  "The Reality Weaver": "A maker of impossible paths, shaping wisdom through imagination.",
  "The True North": "An unwavering bearing for everyone navigating uncertain ground.",
  "The Heartbound Voyager": "A traveler whose course is set by what they refuse to abandon.",
  "The Purpose-Bearer": "A carrier of meaning across long, ordinary days.",

  // Fusion titles
  "The Iron Vanguard": "A front-line force carrying discipline, vitality, and brave momentum.",
  "The Storm-Hardened Titan": "A weathered presence that grows steadier as the wind rises.",
  "The Clockwork Sage": "A wise keeper of small, exact movements that build whole worlds.",
  "The Unbroken Sentinel": "A patient defender who holds the line when pressure rises.",
  "The Soulforged Creator": "A luminous artisan turning purpose into beautiful, living form.",
  "The Inner Oracle": "A calm guide listening inward until the right path becomes clear.",
  "The Oathbound Pathfinder": "A vow-driven traveler whose discipline lights the route forward.",

  // Slipping titles
  "The Dimmed Flame": "A familiar light that asks for tending before it can rise again.",
  "The Wandering Seeker": "A quiet traveler following the next signal through unknown stars.",
  "The Restless Guardian": "A protector circling, looking for the post that's calling them home.",
  "The Sleeping Titan": "A great strength gathered in stillness, waiting to be called up.",
  "The Drifting Star": "A creator drifting between currents until the next spark reaches them.",
};

const buildFallbackDescription = (cosmiqTitle: CompanionCosmiqTitle): string => {
  const dominant = COMPANION_ATTRIBUTE_LABELS[cosmiqTitle.dominantStat];
  const secondary = COMPANION_ATTRIBUTE_LABELS[cosmiqTitle.secondaryStat];
  return `A figure shaped by ${dominant.toLowerCase()} and ${secondary.toLowerCase()}, charting their own constellation.`;
};

export const getCompanionCosmiqTitleFlavorDescription = (
  cosmiqTitle: CompanionCosmiqTitle,
): string =>
  COSMIQ_TITLE_FLAVOR_DESCRIPTIONS[cosmiqTitle.title] ?? buildFallbackDescription(cosmiqTitle);
