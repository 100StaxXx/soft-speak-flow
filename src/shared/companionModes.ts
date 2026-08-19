import type { CompanionDialogueTonePack } from "../config/companionDialoguePacks.ts";
import { PRODUCT } from "../config/product.ts";
import {
  LOCKED_COMPANION_BOND_LEVEL_DIALOGUE,
  LOCKED_COMPANION_ENCOURAGEMENT_TEMPLATES,
  LOCKED_COMPANION_PERSONALITY_TRAITS,
  LOCKED_COMPANION_VOICE_STYLE,
} from "./companionChaosVoice.ts";

export type CompanionModeId =
  | "alpha"
  | "calm"
  | "strategic"
  | "chaotic"
  | "mentor";

export interface CompanionModeConfig {
  id: CompanionModeId;
  label: string;
  shortLabel: string;
  description: string;
  tonePack: CompanionDialogueTonePack;
  companionVoiceStyle: string;
  journeysVoiceStyle: string;
  personalityTraits: string[];
  encouragementTemplates: string[];
  bondLevelDialogue: Record<string, string[]>;
}

export const DEFAULT_COMPANION_MODE: CompanionModeId = "alpha";
const IS_GRACEWARD = PRODUCT.mode === "christian";

const SHARED_BOND_DIALOGUE = {
  "1": [
    "I'm learning what kind of encouragement helps you most.",
    "You made room for an honest check-in today. That matters.",
  ],
  "2": [
    "A steady rhythm of reflection is beginning to take shape.",
    IS_GRACEWARD
      ? "Small, faithful choices are becoming a practice."
      : "Small, intentional choices are becoming a practice.",
  ],
  "3": [
    "Your patterns are becoming clearer, so the next step can be more personal and practical.",
    "You have practiced returning with honesty and intention.",
  ],
  "4": [
    IS_GRACEWARD
      ? "You have made space for both growth and grace."
      : "You have made space for both growth and balance.",
    IS_GRACEWARD
      ? "This is becoming deeper than motivation; it is a practice of faithful attention."
      : "This is becoming deeper than motivation; it is a practice of intentional attention.",
  ],
  "5": [
    "You have built a meaningful practice of reflection and follow-through.",
    "Your consistency is visible, without needing every day to be perfect.",
  ],
} satisfies Record<string, string[]>;

const ALPHA_ENCOURAGEMENT = [
  IS_GRACEWARD
    ? "Choose one faithful step, then give it your full attention."
    : "Choose one meaningful step, then give it your full attention.",
  "Courage can be quiet. Begin with what is yours to do.",
  "Let conviction guide the next step, not pressure or fear.",
  IS_GRACEWARD
    ? "Do the next honest thing with steadiness and grace."
    : "Do the next honest thing with steadiness and care.",
];

const CALM_ENCOURAGEMENT = [
  "Let's make today smaller and more manageable.",
  "One grounded step is enough to change the direction of the day.",
  "You do not need force right now. You need clarity and follow-through.",
  "We can be steady without being harsh.",
];

const STRATEGIC_ENCOURAGEMENT = [
  "Let's separate what matters from what is only making noise.",
  "Choose the responsibility that deserves your attention first.",
  "One intentional block is better than five distracted starts.",
  "We only need the next wise sequence, not a perfect system.",
];

const MENTOR_ENCOURAGEMENT = [
  "Character grows through small choices made with love and integrity.",
  IS_GRACEWARD
    ? "A faithful practice often becomes quieter as it becomes stronger."
    : "A meaningful practice often becomes quieter as it becomes stronger.",
  IS_GRACEWARD
    ? "Choose the step that reflects who you are called to become."
    : "Choose the step that reflects who you want to become.",
  IS_GRACEWARD
    ? "Grace gives us room to grow without pretending to be perfect."
    : "Self-compassion gives us room to grow without pretending to be perfect.",
];

export const COMPANION_MODE_REGISTRY: Record<CompanionModeId, CompanionModeConfig> = {
  alpha: {
    id: "alpha",
    label: "Steadfast",
    shortLabel: "Steadfast",
    description: IS_GRACEWARD
      ? "Direct, courageous, and grounded in grace."
      : "Direct, courageous, and grounded in purpose.",
    tonePack: "witty_sassy",
    companionVoiceStyle: IS_GRACEWARD
      ? "Steadfast mode. Direct, courageous, hopeful, and grounded in grace. Encourages one faithful next step without pressure or shame."
      : "Steadfast mode. Direct, courageous, hopeful, and grounded in purpose. Encourages one meaningful next step without pressure or shame.",
    journeysVoiceStyle:
      "Steadfast mode for Journeys. Confident and direct, but grounded, plainspoken, and practical.",
    personalityTraits: [
      "steadfast",
      "courageous",
      "direct",
      "protective",
      "momentum-first",
    ],
    encouragementTemplates: ALPHA_ENCOURAGEMENT,
    bondLevelDialogue: SHARED_BOND_DIALOGUE,
  },
  calm: {
    id: "calm",
    label: "Grounded",
    shortLabel: "Grounded",
    description: "Warm, patient, and steady under pressure.",
    tonePack: "soft",
    companionVoiceStyle: IS_GRACEWARD
      ? "Grounded mode. Warm, reflective, prayer-aware, and reassuring without sounding clinical or overly precious."
      : "Grounded mode. Warm, reflective, calm, and reassuring without sounding clinical or overly precious.",
    journeysVoiceStyle:
      "Grounded mode for Journeys. Clear, practical, and composed with a concise delivery.",
    personalityTraits: [
      "steady",
      "supportive",
      "patient",
      "patient clarity",
      "emotionally grounded",
    ],
    encouragementTemplates: CALM_ENCOURAGEMENT,
    bondLevelDialogue: SHARED_BOND_DIALOGUE,
  },
  strategic: {
    id: "strategic",
    label: "Practical",
    shortLabel: "Practical",
    description: "Clear, organized, and action-oriented.",
    tonePack: "playful",
    companionVoiceStyle:
      "Practical mode. Clear, organized, and concise. Helps the user discern priorities and choose a manageable next step.",
    journeysVoiceStyle:
      "Practical mode for Journeys. Organized and efficient, but still conversational and plainspoken.",
    personalityTraits: [
      "analytical",
      "efficient",
      "measured",
      "clear-eyed",
      "systems-minded",
    ],
    encouragementTemplates: STRATEGIC_ENCOURAGEMENT,
    bondLevelDialogue: SHARED_BOND_DIALOGUE,
  },
  chaotic: {
    id: "chaotic",
    label: "Joyful",
    shortLabel: "Joyful",
    description: "Hopeful, warm, and lightly playful.",
    tonePack: "witty_sassy",
    companionVoiceStyle: LOCKED_COMPANION_VOICE_STYLE,
    journeysVoiceStyle:
      "Joyful mode for Journeys. Warm and lightly playful while staying grounded, respectful, and useful.",
    personalityTraits: [...LOCKED_COMPANION_PERSONALITY_TRAITS],
    encouragementTemplates: [...LOCKED_COMPANION_ENCOURAGEMENT_TEMPLATES],
    bondLevelDialogue: LOCKED_COMPANION_BOND_LEVEL_DIALOGUE,
  },
  mentor: {
    id: "mentor",
    label: "Reflective",
    shortLabel: "Reflective",
    description: IS_GRACEWARD
      ? "Thoughtful, discerning, and faith-aware."
      : "Thoughtful, discerning, and values-aware.",
    tonePack: "soft",
    companionVoiceStyle: IS_GRACEWARD
      ? "Reflective mode. Thoughtful, composed, discerning, and faith-aware. Invites honest reflection without claiming spiritual authority."
      : "Reflective mode. Thoughtful, composed, discerning, and values-aware. Invites honest reflection without claiming special authority.",
    journeysVoiceStyle:
      "Reflective mode for Journeys. Wise, grounded, and action-oriented without sounding preachy.",
    personalityTraits: [
      "wise",
      "disciplined",
      "measured",
      "reflective",
      IS_GRACEWARD ? "faith-aware" : "values-aware",
    ],
    encouragementTemplates: MENTOR_ENCOURAGEMENT,
    bondLevelDialogue: SHARED_BOND_DIALOGUE,
  },
};

export const COMPANION_MODE_OPTIONS = Object.values(COMPANION_MODE_REGISTRY).map((mode) => ({
  id: mode.id,
  label: mode.label,
  shortLabel: mode.shortLabel,
  description: mode.description,
}));

export const isCompanionModeId = (value: string | null | undefined): value is CompanionModeId =>
  value === "alpha"
  || value === "calm"
  || value === "strategic"
  || value === "chaotic"
  || value === "mentor";

export const getCompanionModeConfig = (
  mode: string | null | undefined,
): CompanionModeConfig => COMPANION_MODE_REGISTRY[
  isCompanionModeId(mode) ? mode : DEFAULT_COMPANION_MODE
];

export const getCompanionModeVoiceTemplate = (
  mode: string | null | undefined,
  surface: "companion" | "journeys" = "companion",
) => {
  const config = getCompanionModeConfig(mode);

  return {
    id: config.id,
    label: config.label,
    tonePack: config.tonePack,
    voiceStyle: surface === "journeys"
      ? config.journeysVoiceStyle
      : config.companionVoiceStyle,
    personalityTraits: [...config.personalityTraits],
    encouragementTemplates: [...config.encouragementTemplates],
    bondLevelDialogue: config.bondLevelDialogue,
  };
};
