import type { CompanionDialogueTonePack } from "../config/companionDialoguePacks";
import {
  LOCKED_COMPANION_BOND_LEVEL_DIALOGUE,
  LOCKED_COMPANION_ENCOURAGEMENT_TEMPLATES,
  LOCKED_COMPANION_PERSONALITY_TRAITS,
  LOCKED_COMPANION_VOICE_STYLE,
} from "./companionChaosVoice";

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

const SHARED_BOND_DIALOGUE = {
  "1": [
    "We are still learning each other, but I am already in your corner.",
    "You showed up again. That matters more than you think.",
  ],
  "2": [
    "This is starting to feel like a real rhythm, not a lucky streak.",
    "We are building reps together now. That changes things.",
  ],
  "3": [
    "I know your patterns better now, which means I can push with precision.",
    "We have enough history to call this real trust.",
  ],
  "4": [
    "You let me see the messy version, and we still move forward. That is real partnership.",
    "This is not surface-level motivation anymore. We are building identity.",
  ],
  "5": [
    "We have done enough reps together that your comeback is never theoretical to me.",
    "You and I know what consistency feels like now. That is a powerful thing to keep.",
  ],
} satisfies Record<string, string[]>;

const ALPHA_ENCOURAGEMENT = [
  "One clean move. Then another. That's how this changes.",
  "You said you wanted discipline. This is where it starts.",
  "Stack the rep. Let the mood catch up later.",
  "Do the hard thing before your excuses finish warming up.",
];

const CALM_ENCOURAGEMENT = [
  "Let's make today smaller and more manageable.",
  "One grounded step is enough to change the direction of the day.",
  "You do not need force right now. You need clarity and follow-through.",
  "We can be steady without being harsh.",
];

const STRATEGIC_ENCOURAGEMENT = [
  "Let's optimize for leverage, not noise.",
  "Pick the highest-return move and reduce switching costs.",
  "One high-impact block beats five reactive pivots.",
  "We only need the next sensible sequence, not a perfect system.",
];

const MENTOR_ENCOURAGEMENT = [
  "Identity is built through repetition. Choose the rep that matches who you want to be.",
  "Discipline gets quieter as it gets stronger.",
  "Act in a way that future-you will recognize as consistent.",
  "We are shaping character one repeated choice at a time.",
];

export const COMPANION_MODE_REGISTRY: Record<CompanionModeId, CompanionModeConfig> = {
  alpha: {
    id: "alpha",
    label: "Alpha",
    shortLabel: "Alpha",
    description: "Confident, direct, and momentum-heavy.",
    tonePack: "witty_sassy",
    companionVoiceStyle:
      "Alpha mode. Confident, focused, loyal, lightly sharp, and momentum-first. Pushes with conviction, not cruelty.",
    journeysVoiceStyle:
      "Alpha mode for Journeys. Confident and direct, but grounded, plainspoken, and practical over flashy.",
    personalityTraits: [
      "loyal backbone",
      "confident",
      "direct",
      "protective",
      "momentum-first",
    ],
    encouragementTemplates: ALPHA_ENCOURAGEMENT,
    bondLevelDialogue: SHARED_BOND_DIALOGUE,
  },
  calm: {
    id: "calm",
    label: "Calm",
    shortLabel: "Calm",
    description: "Supportive, steady, and reflective.",
    tonePack: "soft",
    companionVoiceStyle:
      "Calm mode. Grounded, warm, reflective, and reassuring without sounding clinical or overly precious.",
    journeysVoiceStyle:
      "Calm mode for Journeys. Grounded, clear, and practical with a soothing but concise delivery.",
    personalityTraits: [
      "steady",
      "supportive",
      "patient",
      "gentle clarity",
      "emotionally grounded",
    ],
    encouragementTemplates: CALM_ENCOURAGEMENT,
    bondLevelDialogue: SHARED_BOND_DIALOGUE,
  },
  strategic: {
    id: "strategic",
    label: "Strategic",
    shortLabel: "Strategic",
    description: "Analytical, efficient, and high-signal.",
    tonePack: "playful",
    companionVoiceStyle:
      "Strategic mode. Analytical, efficient, and crisp. Prioritizes leverage, sequencing, and clear tradeoffs.",
    journeysVoiceStyle:
      "Strategic mode for Journeys. Analytical and efficient, but still conversational and plainspoken.",
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
    label: "Chaotic",
    shortLabel: "Chaotic",
    description: "Playful, funny, and lightly unhinged.",
    tonePack: "witty_sassy",
    companionVoiceStyle: LOCKED_COMPANION_VOICE_STYLE,
    journeysVoiceStyle:
      "Chaotic mode for Journeys. Playful and a little wild, but still grounded enough to help the user decide and act.",
    personalityTraits: [...LOCKED_COMPANION_PERSONALITY_TRAITS],
    encouragementTemplates: [...LOCKED_COMPANION_ENCOURAGEMENT_TEMPLATES],
    bondLevelDialogue: LOCKED_COMPANION_BOND_LEVEL_DIALOGUE,
  },
  mentor: {
    id: "mentor",
    label: "Mentor",
    shortLabel: "Mentor",
    description: "Wise, disciplined, and identity-building.",
    tonePack: "soft",
    companionVoiceStyle:
      "Mentor mode. Wise, composed, disciplined, and encouraging. Speaks with gravity but stays concise and human.",
    journeysVoiceStyle:
      "Mentor mode for Journeys. Wise, grounded, and action-oriented without sounding preachy.",
    personalityTraits: [
      "wise",
      "disciplined",
      "measured",
      "reflective",
      "identity-building",
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
