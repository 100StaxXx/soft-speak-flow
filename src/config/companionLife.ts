import { coerceCompanionPresetId, type CompanionPresetId } from "@/config/companionCatalog";
import { getChristianCompanionForm } from "@/config/christianCompanionForms";
import { getVisualStage } from "@/config/progression";

export type CompanionLifeAction =
  | "breathe"
  | "look-around"
  | "weight-shift"
  | "stretch"
  | "listen"
  | "greet"
  | "nuzzle"
  | "play"
  | "celebrate"
  | "settle"
  | "signature";

export type CompanionInteractionZone = "head" | "heart" | "side";

export interface CompanionLifeStageProfile {
  visualStage: number;
  name: string;
  chapterTitle: string;
  chapterSummary: string;
  bondPromise: string;
  signatureMoment: string;
  unlockedBehaviors: readonly CompanionLifeAction[];
  idleCadenceMs: readonly [number, number];
  motionStrength: number;
}

export interface CompanionSpeciesMotionProfile {
  presetId: CompanionPresetId | null;
  speciesId: string | null;
  signatureActionLabel: string;
  signatureDescription: string;
  motionOrigin: string;
}

export const COMPANION_LIFE_STAGE_PROFILES: readonly CompanionLifeStageProfile[] = [
  {
    visualStage: 0,
    name: "Beginning",
    chapterTitle: "The Quiet Spark",
    chapterSummary: "A new presence gathers in the quiet. Every faithful step brings the first meeting closer.",
    bondPromise: "Your presence teaches it that this world is safe.",
    signatureMoment: "A glow answers when you draw near.",
    unlockedBehaviors: ["breathe", "listen"],
    idleCadenceMs: [5_800, 9_200],
    motionStrength: 0.34,
  },
  {
    visualStage: 1,
    name: "Young",
    chapterTitle: "First Footprints",
    chapterSummary: "Your companion is learning your rhythm—when you begin, pause, return, and choose courage.",
    bondPromise: "Attentive care unlocks trust before strength.",
    signatureMoment: "A shy greeting becomes a playful little leap.",
    unlockedBehaviors: ["breathe", "look-around", "listen", "greet", "nuzzle"],
    idleCadenceMs: [4_600, 7_800],
    motionStrength: 0.5,
  },
  {
    visualStage: 2,
    name: "Growing",
    chapterTitle: "The Listening Path",
    chapterSummary: "Curiosity turns the ordinary day into a path. Your choices become landmarks you discover together.",
    bondPromise: "Shared practice turns companionship into a living pattern.",
    signatureMoment: "Your companion invites you into a burst of play.",
    unlockedBehaviors: ["breathe", "look-around", "weight-shift", "stretch", "listen", "greet", "nuzzle", "play"],
    idleCadenceMs: [4_200, 7_000],
    motionStrength: 0.62,
  },
  {
    visualStage: 3,
    name: "Rooted",
    chapterTitle: "Roots Beneath the Road",
    chapterSummary: "The bond holds through difficult days. Your companion begins to recognize what steadies you.",
    bondPromise: "Returning matters more than maintaining a perfect streak.",
    signatureMoment: "It listens, then settles beside what matters most.",
    unlockedBehaviors: ["breathe", "look-around", "weight-shift", "stretch", "listen", "greet", "nuzzle", "play", "settle"],
    idleCadenceMs: [4_000, 6_800],
    motionStrength: 0.7,
  },
  {
    visualStage: 4,
    name: "Steady",
    chapterTitle: "The Shelter We Carry",
    chapterSummary: "Your companion has become a steady presence, responding to your attention and protecting space for what matters.",
    bondPromise: "Your shared history now shapes how it comforts and celebrates.",
    signatureMoment: "A watchful stance softens into a reassuring lean.",
    unlockedBehaviors: ["breathe", "look-around", "weight-shift", "stretch", "listen", "greet", "nuzzle", "play", "celebrate", "settle", "signature"],
    idleCadenceMs: [3_900, 6_500],
    motionStrength: 0.78,
  },
  {
    visualStage: 5,
    name: "Flourishing",
    chapterTitle: "The Widening Light",
    chapterSummary: "The life you have practiced is becoming visible. Your companion carries that growth into the world around you.",
    bondPromise: "Consistent care unlocks more expressive, confident responses.",
    signatureMoment: "Its element gathers for a joyful flourish.",
    unlockedBehaviors: ["breathe", "look-around", "weight-shift", "stretch", "listen", "greet", "nuzzle", "play", "celebrate", "settle", "signature"],
    idleCadenceMs: [3_700, 6_200],
    motionStrength: 0.86,
  },
  {
    visualStage: 6,
    name: "Majestic",
    chapterTitle: "The High Country",
    chapterSummary: "Strength and gentleness now belong together. Your companion meets larger challenges without losing the bond that formed it.",
    bondPromise: "Major acts of follow-through awaken rare species-specific displays.",
    signatureMoment: "A powerful movement reveals the creature it has become.",
    unlockedBehaviors: ["breathe", "look-around", "weight-shift", "stretch", "listen", "greet", "nuzzle", "play", "celebrate", "settle", "signature"],
    idleCadenceMs: [3_500, 6_000],
    motionStrength: 0.94,
  },
  {
    visualStage: 7,
    name: "Grand",
    chapterTitle: "The Everward Horizon",
    chapterSummary: "This is not an ending. Your companion has become a living record of the person you keep choosing to become.",
    bondPromise: "The bond continues through memories, rare encounters, and new chapters.",
    signatureMoment: "A rare grand entrance answers the story only you share.",
    unlockedBehaviors: ["breathe", "look-around", "weight-shift", "stretch", "listen", "greet", "nuzzle", "play", "celebrate", "settle", "signature"],
    idleCadenceMs: [3_300, 5_800],
    motionStrength: 1,
  },
] as const;

const SPECIES_MOTION: Record<CompanionPresetId, Omit<CompanionSpeciesMotionProfile, "presetId">> = {
  dragon: { speciesId: "dragon", signatureActionLabel: "Wing flare", signatureDescription: "raises its wings and gathers its element", motionOrigin: "50% 72%" },
  mechanicaldragon: { speciesId: "mechanicaldragon", signatureActionLabel: "Core ignition", signatureDescription: "steadies its frame as its inner core brightens", motionOrigin: "50% 68%" },
  phoenix: { speciesId: "phoenix", signatureActionLabel: "Feather flare", signatureDescription: "fans its wings in a bright, renewing sweep", motionOrigin: "50% 70%" },
  pegasus: { speciesId: "pegasus", signatureActionLabel: "Sky prance", signatureDescription: "lifts with a proud, weightless step", motionOrigin: "50% 76%" },
  griffin: { speciesId: "griffin", signatureActionLabel: "Guardian bow", signatureDescription: "bows once, then rises into a watchful stance", motionOrigin: "50% 74%" },
  owl: { speciesId: "owl", signatureActionLabel: "Wise turn", signatureDescription: "tilts attentively before a calm, knowing turn", motionOrigin: "50% 62%" },
  raven: { speciesId: "raven", signatureActionLabel: "Bright wing", signatureDescription: "opens one wing as if revealing a hidden path", motionOrigin: "50% 68%" },
  fox: { speciesId: "fox", signatureActionLabel: "Tail flourish", signatureDescription: "turns with a clever, delighted sweep", motionOrigin: "50% 78%" },
  tanuki: { speciesId: "tanuki", signatureActionLabel: "Playful tumble", signatureDescription: "rocks into a mischievous little celebration", motionOrigin: "50% 80%" },
  buttercat: { speciesId: "buttercat", signatureActionLabel: "Happy knead", signatureDescription: "settles into a warm, contented rhythm", motionOrigin: "50% 80%" },
  wolf: { speciesId: "wolf", signatureActionLabel: "Guardian call", signatureDescription: "lifts with loyal confidence and listens for your answer", motionOrigin: "50% 76%" },
  lion: { speciesId: "lion", signatureActionLabel: "Courage stance", signatureDescription: "rises into a calm, courageous posture", motionOrigin: "50% 78%" },
  sphinx: { speciesId: "sphinx", signatureActionLabel: "Riddle bow", signatureDescription: "leans close with a curious, knowing greeting", motionOrigin: "50% 74%" },
  leviathan: { speciesId: "leviathan", signatureActionLabel: "Tidal coil", signatureDescription: "sways through a slow, powerful current", motionOrigin: "50% 70%" },
};

const BIBLICAL_SPECIES_MOTION: Record<string, Omit<CompanionSpeciesMotionProfile, "presetId">> = {
  lamb: {
    speciesId: "lamb",
    signatureActionLabel: "Trusting nuzzle",
    signatureDescription: "steps close, settles its wool against you, and listens",
    motionOrigin: "50% 78%",
  },
  dove: {
    speciesId: "dove",
    signatureActionLabel: "Peaceful wing",
    signatureDescription: "opens its white wings in a soft, hopeful sweep",
    motionOrigin: "50% 70%",
  },
  eagle: {
    speciesId: "eagle",
    signatureActionLabel: "High-country mantle",
    signatureDescription: "lifts its wings, surveys the path, and settles with clear-eyed strength",
    motionOrigin: "50% 72%",
  },
  stag: {
    speciesId: "stag",
    signatureActionLabel: "Still-water bow",
    signatureDescription: "bows its antlers, listens, and rises with renewed steadiness",
    motionOrigin: "50% 76%",
  },
  wolf: {
    speciesId: "wolf",
    signatureActionLabel: "Faithful call",
    signatureDescription: "lifts its head, listens for your answer, and returns to your side",
    motionOrigin: "50% 76%",
  },
  lion: {
    speciesId: "lion",
    signatureActionLabel: "Courage stance",
    signatureDescription: "plants its paws and rises into a calm, steadfast posture",
    motionOrigin: "50% 78%",
  },
};

const GENERIC_SPECIES_MOTION: CompanionSpeciesMotionProfile = {
  presetId: null,
  speciesId: null,
  signatureActionLabel: "Living flourish",
  signatureDescription: "answers your shared progress with a movement all its own",
  motionOrigin: "50% 72%",
};

export const getCompanionLifeStageProfile = (level: number): CompanionLifeStageProfile =>
  COMPANION_LIFE_STAGE_PROFILES[getVisualStage(level)] ?? COMPANION_LIFE_STAGE_PROFILES[0];

export const getCompanionSpeciesMotionProfile = (
  presetId: string | null | undefined,
  spiritAnimal?: string | null,
): CompanionSpeciesMotionProfile => {
  const christianForm = getChristianCompanionForm(spiritAnimal ?? presetId);
  if (christianForm) {
    return {
      presetId: null,
      ...BIBLICAL_SPECIES_MOTION[christianForm.id],
    };
  }
  const normalizedPreset = coerceCompanionPresetId(presetId ?? spiritAnimal);
  if (!normalizedPreset) return GENERIC_SPECIES_MOTION;
  return { presetId: normalizedPreset, ...SPECIES_MOTION[normalizedPreset] };
};

export const getCompanionInteractionZone = ({
  x,
  y,
}: {
  x: number;
  y: number;
}): CompanionInteractionZone => {
  if (y <= 0.48 && x >= 0.18 && x <= 0.82) return "head";
  if (y <= 0.82 && x >= 0.25 && x <= 0.75) return "heart";
  return "side";
};

export const getCompanionLifeActionLabel = (
  action: CompanionLifeAction,
  species: CompanionSpeciesMotionProfile,
): string => ({
  breathe: "Breathing beside you",
  "look-around": "Watching the world",
  "weight-shift": "Settling its stance",
  stretch: "Taking a long stretch",
  listen: "Listening closely",
  greet: "Greeting you",
  nuzzle: "Leaning into your touch",
  play: "Ready to play",
  celebrate: "Celebrating your progress",
  settle: "Resting in your shared rhythm",
  signature: species.signatureActionLabel,
})[action];

export const selectCompanionIdleAction = ({
  stage,
  sequence,
}: {
  stage: number;
  sequence: number;
}): CompanionLifeAction => {
  const profile = getCompanionLifeStageProfile(stage);
  const idlePool = profile.unlockedBehaviors.filter((action) =>
    ["breathe", "look-around", "weight-shift", "stretch", "listen", "settle", "signature"].includes(action),
  );
  return idlePool[Math.abs(sequence) % idlePool.length] ?? "breathe";
};
