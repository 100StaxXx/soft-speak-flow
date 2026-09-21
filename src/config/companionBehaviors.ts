import { getProgressionTier, type ProgressionTier } from "./progression";

export type CompanionGesture = "tap" | "pet" | "hold" | "keyboard";

export type CompanionBehaviorId =
  | "ambient_breathe"
  | "ambient_glance"
  | "ambient_stretch"
  | "ambient_doze"
  | "touch_eye_contact"
  | "touch_boop"
  | "touch_nuzzle"
  | "touch_tickle"
  | "touch_surprise"
  | "egg_wobble"
  | "hatchling_hop"
  | "initiate_pounce"
  | "awakened_flare"
  | "guardian_guard"
  | "champion_victory"
  | "mythic_levitate"
  | "ascended_phase";

export interface CompanionBehaviorDefinition {
  id: CompanionBehaviorId;
  durationMs: number;
  className: string;
}

export interface CompanionInteractionMoment {
  behaviorId: CompanionBehaviorId;
  message: string;
}

export interface CompanionInteractionPromptOption {
  key: string;
  label: string;
  response: string;
  behaviorId: CompanionBehaviorId;
}

export interface CompanionInteractionPrompt {
  key: string;
  question: string;
  options: readonly CompanionInteractionPromptOption[];
}

export const COMPANION_BEHAVIORS: Record<CompanionBehaviorId, CompanionBehaviorDefinition> = {
  ambient_breathe: { id: "ambient_breathe", durationMs: 4_800, className: "companion-behavior-breathe" },
  ambient_glance: { id: "ambient_glance", durationMs: 2_600, className: "companion-behavior-glance" },
  ambient_stretch: { id: "ambient_stretch", durationMs: 2_900, className: "companion-behavior-stretch" },
  ambient_doze: { id: "ambient_doze", durationMs: 5_400, className: "companion-behavior-doze" },
  touch_eye_contact: { id: "touch_eye_contact", durationMs: 1_500, className: "companion-behavior-eye-contact" },
  touch_boop: { id: "touch_boop", durationMs: 1_100, className: "companion-behavior-boop" },
  touch_nuzzle: { id: "touch_nuzzle", durationMs: 1_900, className: "companion-behavior-nuzzle" },
  touch_tickle: { id: "touch_tickle", durationMs: 1_250, className: "companion-behavior-tickle" },
  touch_surprise: { id: "touch_surprise", durationMs: 1_300, className: "companion-behavior-surprise" },
  egg_wobble: { id: "egg_wobble", durationMs: 2_300, className: "companion-behavior-egg-wobble" },
  hatchling_hop: { id: "hatchling_hop", durationMs: 1_650, className: "companion-behavior-hatchling-hop" },
  initiate_pounce: { id: "initiate_pounce", durationMs: 1_650, className: "companion-behavior-initiate-pounce" },
  awakened_flare: { id: "awakened_flare", durationMs: 2_100, className: "companion-behavior-awakened-flare" },
  guardian_guard: { id: "guardian_guard", durationMs: 2_250, className: "companion-behavior-guardian-guard" },
  champion_victory: { id: "champion_victory", durationMs: 2_350, className: "companion-behavior-champion-victory" },
  mythic_levitate: { id: "mythic_levitate", durationMs: 3_400, className: "companion-behavior-mythic-levitate" },
  ascended_phase: { id: "ascended_phase", durationMs: 3_000, className: "companion-behavior-ascended-phase" },
};

const STAGE_SIGNATURES: Record<ProgressionTier, CompanionBehaviorId> = {
  egg: "egg_wobble",
  hatchling: "hatchling_hop",
  initiate: "initiate_pounce",
  awakened: "awakened_flare",
  guardian: "guardian_guard",
  champion: "champion_victory",
  mythic: "mythic_levitate",
  ascended: "ascended_phase",
};

const STAGE_TAP_LINES: Record<ProgressionTier, readonly string[]> = {
  egg: ["Something inside answers with a tiny pulse.", "The shell feels warm beneath your touch."],
  hatchling: ["There you are! What are we doing next?", "I was hoping you would stop by."],
  initiate: ["Want to practice something together?", "I can feel us getting stronger."],
  awakened: ["Our energy feels different today—in a good way.", "I think we are ready for something new."],
  guardian: ["I am here. What should we protect today?", "You keep moving; I will hold the line."],
  champion: ["Point me toward the next challenge.", "That momentum looks good on us."],
  mythic: ["The stars are listening. What shall we tell them?", "Our story has real gravity now."],
  ascended: ["Even at the edge of the cosmos, I recognize your touch.", "We have come far. I still choose the next step with you."],
};

const PET_LINES: Record<ProgressionTier, readonly string[]> = {
  egg: ["A pleased hum resonates through the shell."],
  hatchling: ["That is exactly the spot.", "Again! I mean—whenever you want."],
  initiate: ["I can focus better when you do that."],
  awakened: ["The energy settles into a gentle glow."],
  guardian: ["For a moment, the guard comes down."],
  champion: ["Even champions appreciate that."],
  mythic: ["The whole aura softens around your hand."],
  ascended: ["The constellations lean closer."],
};

const HOLD_LINES: Record<ProgressionTier, readonly string[]> = {
  egg: ["A steady heartbeat answers yours."],
  hatchling: ["I am right here."],
  initiate: ["We can pause here for a second."],
  awakened: ["No rush. Let the energy settle."],
  guardian: ["You do not have to carry everything alone."],
  champion: ["Rest is part of becoming stronger."],
  mythic: ["The universe can wait a moment."],
  ascended: ["Stillness is part of the journey too."],
};

const PROMPTS: Record<ProgressionTier, CompanionInteractionPrompt> = {
  egg: {
    key: "egg-dream-v1",
    question: "What should I dream about today?",
    options: [
      { key: "courage", label: "Courage", response: "Then I will dream of brave beginnings.", behaviorId: "egg_wobble" },
      { key: "wonder", label: "Wonder", response: "I can already feel something curious stirring.", behaviorId: "ambient_glance" },
      { key: "peace", label: "Peace", response: "A quiet dream sounds perfect.", behaviorId: "ambient_breathe" },
    ],
  },
  hatchling: {
    key: "hatchling-day-v1",
    question: "What kind of day should we have?",
    options: [
      { key: "focused", label: "Focused", response: "One target. I will stay close.", behaviorId: "touch_eye_contact" },
      { key: "playful", label: "Playful", response: "Good. I have energy to spare!", behaviorId: "hatchling_hop" },
      { key: "gentle", label: "Gentle", response: "Gentle still counts. Let us take it softly.", behaviorId: "touch_nuzzle" },
    ],
  },
  initiate: {
    key: "initiate-practice-v1",
    question: "What should we practice today?",
    options: [
      { key: "courage", label: "Courage", response: "We can start before we feel completely ready.", behaviorId: "initiate_pounce" },
      { key: "patience", label: "Patience", response: "Slow and steady. I can do that with you.", behaviorId: "ambient_breathe" },
      { key: "follow-through", label: "Follow-through", response: "Then we finish one thing that matters.", behaviorId: "touch_eye_contact" },
    ],
  },
  awakened: {
    key: "awakened-energy-v1",
    question: "Where should our energy go?",
    options: [
      { key: "one-goal", label: "One goal", response: "I will help keep the signal clear.", behaviorId: "awakened_flare" },
      { key: "explore", label: "Explore", response: "Then let us follow the interesting path.", behaviorId: "ambient_glance" },
      { key: "recover", label: "Recover", response: "Rest can be an intentional choice.", behaviorId: "touch_nuzzle" },
    ],
  },
  guardian: {
    key: "guardian-protect-v1",
    question: "What should I help protect today?",
    options: [
      { key: "focus", label: "Focus", response: "I will stand watch over the next step.", behaviorId: "guardian_guard" },
      { key: "time", label: "Time", response: "Then not everything gets access to you today.", behaviorId: "touch_eye_contact" },
      { key: "rest", label: "Rest", response: "Consider it protected.", behaviorId: "touch_nuzzle" },
    ],
  },
  champion: {
    key: "champion-challenge-v1",
    question: "How should we meet the next challenge?",
    options: [
      { key: "bold", label: "Boldly", response: "Then we step forward with our whole heart.", behaviorId: "champion_victory" },
      { key: "steady", label: "Steadily", response: "No spectacle needed. Just the next true step.", behaviorId: "ambient_breathe" },
      { key: "creative", label: "Creatively", response: "Good. The obvious route is not the only one.", behaviorId: "ambient_glance" },
    ],
  },
  mythic: {
    key: "mythic-legend-v1",
    question: "What should our legend stand for?",
    options: [
      { key: "courage", label: "Courage", response: "Then courage becomes part of our constellation.", behaviorId: "mythic_levitate" },
      { key: "kindness", label: "Kindness", response: "Power that stays kind is rare. I like that.", behaviorId: "touch_nuzzle" },
      { key: "wonder", label: "Wonder", response: "There will always be another star to discover.", behaviorId: "ambient_glance" },
    ],
  },
  ascended: {
    key: "ascended-carry-v1",
    question: "What should we carry into tomorrow?",
    options: [
      { key: "clarity", label: "Clarity", response: "Then we leave the noise behind.", behaviorId: "ascended_phase" },
      { key: "connection", label: "Connection", response: "Whatever changes, the bond comes with us.", behaviorId: "touch_eye_contact" },
      { key: "rest", label: "Rest", response: "Tomorrow can begin after a real ending to today.", behaviorId: "touch_nuzzle" },
    ],
  },
};

const selectLine = (lines: readonly string[], seed: number): string =>
  lines[Math.abs(seed) % lines.length] ?? lines[0] ?? "I am glad you are here.";

export const getCompanionStageSignatureBehavior = (level: number): CompanionBehaviorId =>
  STAGE_SIGNATURES[getProgressionTier(level)];

export const getCompanionAmbientBehavior = ({
  level,
  hour,
  cycle,
}: {
  level: number;
  hour: number;
  cycle: number;
}): CompanionBehaviorId => {
  if (hour >= 22 || hour < 6) return cycle % 3 === 0 ? "ambient_doze" : "ambient_breathe";
  if (cycle > 0 && cycle % 4 === 0) return getCompanionStageSignatureBehavior(level);

  const ambient: readonly CompanionBehaviorId[] = [
    "ambient_breathe",
    "ambient_glance",
    "ambient_stretch",
  ];
  return ambient[Math.abs(cycle) % ambient.length];
};

export const getCompanionInteractionMoment = ({
  level,
  gesture,
  interactionCount,
}: {
  level: number;
  gesture: CompanionGesture;
  interactionCount: number;
}): CompanionInteractionMoment => {
  const tier = getProgressionTier(level);

  if (gesture === "pet") {
    return {
      behaviorId: interactionCount % 3 === 0 ? getCompanionStageSignatureBehavior(level) : "touch_nuzzle",
      message: selectLine(PET_LINES[tier], interactionCount),
    };
  }

  if (gesture === "hold") {
    return {
      behaviorId: "touch_eye_contact",
      message: selectLine(HOLD_LINES[tier], interactionCount),
    };
  }

  const tapBehaviors: readonly CompanionBehaviorId[] = [
    "touch_boop",
    "touch_surprise",
    "touch_tickle",
    getCompanionStageSignatureBehavior(level),
  ];
  return {
    behaviorId: tapBehaviors[Math.abs(interactionCount) % tapBehaviors.length],
    message: selectLine(STAGE_TAP_LINES[tier], interactionCount),
  };
};

export const getCompanionInteractionPrompt = (level: number): CompanionInteractionPrompt =>
  PROMPTS[getProgressionTier(level)];
