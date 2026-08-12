import type { CompanionExpressionMood } from "@/config/companionCatalog";
import type {
  CompanionInteractionZone,
  CompanionLifeAction,
} from "@/config/companionLife";

export type LivingCompanionBodyLanguage =
  | "calm"
  | "happy"
  | "excited"
  | "concerned"
  | "sleepy"
  | "curious";

export interface LivingCompanionQuestionOption {
  id: string;
  label: string;
  response: string;
  bodyLanguage: LivingCompanionBodyLanguage;
}

export interface LivingCompanionQuestion {
  id: string;
  prompt: string;
  options: readonly LivingCompanionQuestionOption[];
}

export interface LivingCompanionQuestionContext {
  companionId?: string | null;
  bodyLanguage: LivingCompanionBodyLanguage;
  inactiveDays?: number;
  nearEvolution?: boolean;
  now?: Date;
}

export interface LivingCompanionDailyStateContext {
  baseBodyLanguage: LivingCompanionBodyLanguage;
  hour: number;
  encouragementCompleted?: boolean;
  focusAnswered?: boolean;
  practiceCompleted?: boolean;
  eveningReflected?: boolean;
}

export interface LivingCompanionDailyState {
  bodyLanguage: LivingCompanionBodyLanguage;
  label: string;
}

const TAP_LINES: Record<LivingCompanionBodyLanguage, readonly string[]> = {
  calm: [
    "I'm here. We can take the next thing slowly.",
    "This feels like a good moment to breathe.",
    "No rush. What matters can still be done at a pace you can sustain.",
  ],
  happy: [
    "It's good to share this part of the day with you.",
    "You have a little more light around you today.",
    "I like the rhythm we're finding.",
  ],
  excited: [
    "I felt that win. You earned it.",
    "Something is moving—keep the next step honest.",
    "That mattered more than the progress bar can say.",
  ],
  concerned: [
    "We don't have to force today. We can make it smaller.",
    "You seem stretched. One kind step is enough for now.",
    "Nothing is ruined. Where would a little support help?",
  ],
  sleepy: [
    "We can let the day soften now.",
    "Rest can be part of the plan.",
    "You don't have to solve everything tonight.",
  ],
  curious: [
    "What are you noticing right now?",
    "There is something on your mind, isn't there?",
    "Want to tell me what kind of moment this is?",
  ],
};

const TOUCH_LINES: Record<CompanionInteractionZone, readonly string[]> = {
  head: [
    "There you are. I know that familiar touch.",
    "I was hoping you would stop here for a moment.",
    "Hello, you. I’m listening.",
  ],
  heart: [
    "I can feel the steadiness we’re building together.",
    "That feels like home to me.",
    "I’m with you—right here, not somewhere ahead.",
  ],
  side: [
    "You found my playful side.",
    "All right, I’m awake. What are we discovering?",
    "That got my attention—in a good way.",
  ],
};

const ACTION_LINES: Record<Extract<CompanionLifeAction, "greet" | "nuzzle" | "play" | "signature">, readonly string[]> = {
  greet: [
    "You came back. The next part of our story can begin from here.",
    "I’m glad it’s you. What kind of moment are we stepping into?",
    "There you are. I saved some curiosity for us.",
  ],
  nuzzle: [
    "Stay a second. We don’t always need words.",
    "I remember this kind of kindness.",
    "That’s good. Let the day pause here.",
  ],
  play: [
    "Let’s make one ordinary thing feel like an adventure.",
    "Choose our next move: brave, curious, or wonderfully small?",
    "A little play can put life back into the next step.",
  ],
  signature: [
    "You’ve seen something rare. Our bond is teaching me who I can become.",
    "That only happens when our shared story feels especially alive.",
    "I’ve been saving that one for you.",
  ],
};

export const LIVING_COMPANION_EVENT_COMMENTS = {
  "task-completed": {
    message: "You followed through. Let that count before you hurry onward.",
    bodyLanguage: "happy",
  },
  "focus-sprint-completed": {
    message: "You protected your attention. That was real work.",
    bodyLanguage: "excited",
  },
  "quest-completed": {
    message: "You carried that all the way through. I'm proud of the steadiness in it.",
    bodyLanguage: "excited",
  },
  "mission-completed": {
    message: "That was more than a checked box. You kept a promise to yourself.",
    bodyLanguage: "excited",
  },
  "morning-checkin-completed": {
    message: "The day has a shape now. We can meet it one piece at a time.",
    bodyLanguage: "happy",
  },
  "daily-encouragement-completed": {
    message: "I listened with you. Let’s carry one true thing from that encouragement into the day.",
    bodyLanguage: "calm",
  },
  "daily-practice-completed": {
    message: "You carried the reflection into action. That connection matters.",
    bodyLanguage: "happy",
  },
  "evening-reflection-completed": {
    message: "You made room to notice the day instead of only surviving it.",
    bodyLanguage: "calm",
  },
  "companion-evolved": {
    message: "We changed because you kept showing up—not perfectly, but faithfully.",
    bodyLanguage: "excited",
  },
} as const satisfies Record<string, {
  message: string;
  bodyLanguage: LivingCompanionBodyLanguage;
}>;

const RETURN_QUESTION: LivingCompanionQuestion = {
  id: "return-gently",
  prompt: "How would you like to begin again?",
  options: [
    { id: "gentle", label: "With care", response: "We'll begin where you are. Nothing to make up for.", bodyLanguage: "calm" },
    { id: "clear", label: "One clear step", response: "One clear step. We'll leave the rest quiet for now.", bodyLanguage: "curious" },
    { id: "ready", label: "I'm ready", response: "Then let's meet the next step with courage, not pressure.", bodyLanguage: "excited" },
  ],
};

const EVOLUTION_QUESTION: LivingCompanionQuestion = {
  id: "next-season",
  prompt: "What do you want to carry into your next season?",
  options: [
    { id: "courage", label: "Courage", response: "Courage can be quiet. We'll practice it one choice at a time.", bodyLanguage: "curious" },
    { id: "consistency", label: "Consistency", response: "Steady is powerful. We don't need dramatic to make it real.", bodyLanguage: "happy" },
    { id: "grace", label: "Grace", response: "Grace belongs in the next season—and in this one too.", bodyLanguage: "calm" },
  ],
};

const CONCERNED_QUESTION: LivingCompanionQuestion = {
  id: "support-today",
  prompt: "What kind of support would feel right today?",
  options: [
    { id: "smaller", label: "Make it smaller", response: "We'll choose one small, honest step.", bodyLanguage: "curious" },
    { id: "company", label: "Stay with me", response: "I'm here. You don't have to rush through this moment.", bodyLanguage: "calm" },
    { id: "rest", label: "Let me rest", response: "Then rest without apology. We can begin again later.", bodyLanguage: "sleepy" },
  ],
};

const SLEEPY_QUESTION: LivingCompanionQuestion = {
  id: "close-gently",
  prompt: "How should we close the day?",
  options: [
    { id: "reflect", label: "One reflection", response: "One reflection is enough. What mattered can stay simple.", bodyLanguage: "curious" },
    { id: "tomorrow", label: "Set tomorrow down", response: "Tomorrow can wait outside the room for tonight.", bodyLanguage: "calm" },
    { id: "sleep", label: "Just rest", response: "Then that's the whole plan: rest.", bodyLanguage: "sleepy" },
  ],
};

const MORNING_QUESTIONS: readonly LivingCompanionQuestion[] = [
  {
    id: "carry-today",
    prompt: "How should we carry today?",
    options: [
      { id: "gentle", label: "Patiently", response: "We'll protect your energy and keep the direction clear.", bodyLanguage: "calm" },
      { id: "steady", label: "Steadily", response: "Steady it is. One promise at a time.", bodyLanguage: "happy" },
      { id: "brave", label: "Bravely", response: "Bravely—not perfectly. I'll remember that with you.", bodyLanguage: "excited" },
    ],
  },
  {
    id: "morning-need",
    prompt: "What would help you meet this morning well?",
    options: [
      { id: "clarity", label: "Clarity", response: "Let's name the one thing that matters most.", bodyLanguage: "curious" },
      { id: "momentum", label: "Momentum", response: "We'll start with something small enough to begin now.", bodyLanguage: "excited" },
      { id: "space", label: "More space", response: "Then we leave room. A full day isn't the same as a good one.", bodyLanguage: "calm" },
    ],
  },
];

const DAY_QUESTIONS: readonly LivingCompanionQuestion[] = [
  {
    id: "help-now",
    prompt: "What would help most right now?",
    options: [
      { id: "smaller", label: "A smaller step", response: "Good. Small enough to start is the right size.", bodyLanguage: "curious" },
      { id: "priority", label: "A clear priority", response: "Let's choose what deserves your attention—and release the rest.", bodyLanguage: "happy" },
      { id: "pause", label: "A real pause", response: "Take the pause. You don't need to earn it first.", bodyLanguage: "calm" },
    ],
  },
  {
    id: "day-direction",
    prompt: "What kind of progress would feel honest today?",
    options: [
      { id: "finish", label: "Finish one thing", response: "One finished thing can change the whole shape of a day.", bodyLanguage: "excited" },
      { id: "begin", label: "Begin something", response: "Beginning counts. We can leave perfection outside it.", bodyLanguage: "curious" },
      { id: "recover", label: "Recover", response: "Recovery is progress when it's what you truly need.", bodyLanguage: "calm" },
    ],
  },
];

const EVENING_QUESTIONS: readonly LivingCompanionQuestion[] = [
  {
    id: "kindness-tonight",
    prompt: "What deserves kindness tonight?",
    options: [
      { id: "finished", label: "What I finished", response: "Let yourself receive the win before the day closes.", bodyLanguage: "happy" },
      { id: "hard", label: "What was hard", response: "Hard things deserve care, even when they stayed unfinished.", bodyLanguage: "calm" },
      { id: "waiting", label: "What can wait", response: "Let it wait. Not everything belongs to tonight.", bodyLanguage: "sleepy" },
    ],
  },
  {
    id: "notice-today",
    prompt: "What do you want to notice before today ends?",
    options: [
      { id: "effort", label: "My effort", response: "Your effort mattered, including the parts no one saw.", bodyLanguage: "happy" },
      { id: "lesson", label: "What I learned", response: "Keep the lesson. You can set the weight down.", bodyLanguage: "curious" },
      { id: "release", label: "What to release", response: "You don't have to carry it into tomorrow.", bodyLanguage: "calm" },
    ],
  },
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const formatLivingCompanionDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getLivingCompanionBodyLanguage = ({
  expressionMood,
  isDormant = false,
  hasDormancyWarning = false,
  hasQuestion = false,
}: {
  expressionMood: CompanionExpressionMood;
  isDormant?: boolean;
  hasDormancyWarning?: boolean;
  hasQuestion?: boolean;
}): LivingCompanionBodyLanguage => {
  if (isDormant) return "sleepy";
  if (hasQuestion) return "curious";
  if (hasDormancyWarning) return "concerned";
  return expressionMood;
};

export const deriveLivingCompanionDailyState = ({
  baseBodyLanguage,
  hour,
  encouragementCompleted = false,
  focusAnswered = false,
  practiceCompleted = false,
  eveningReflected = false,
}: LivingCompanionDailyStateContext): LivingCompanionDailyState => {
  if (baseBodyLanguage === "concerned") {
    return { bodyLanguage: "concerned", label: "Staying close without pressure" };
  }
  if (baseBodyLanguage === "sleepy") {
    return { bodyLanguage: "sleepy", label: "Resting, still with you" };
  }
  if (eveningReflected) {
    return { bodyLanguage: "calm", label: "Settled with today’s reflection" };
  }
  if (practiceCompleted) {
    return { bodyLanguage: "happy", label: "Noticing your faithful step" };
  }
  if (focusAnswered) {
    return { bodyLanguage: "curious", label: "Holding today’s focus with you" };
  }
  if (encouragementCompleted) {
    return { bodyLanguage: "calm", label: "Carrying your Guide’s encouragement" };
  }
  if (hour >= 21 || hour < 6) {
    return { bodyLanguage: "sleepy", label: "Moving at the day’s quieter pace" };
  }

  const defaultLabels: Record<LivingCompanionBodyLanguage, string> = {
    calm: "Present with you",
    happy: "Sharing your momentum",
    excited: "Bright with anticipation",
    concerned: "Staying close without pressure",
    sleepy: "Moving at a quieter pace",
    curious: "Wondering with you",
  };
  return { bodyLanguage: baseBodyLanguage, label: defaultLabels[baseBodyLanguage] };
};

export const buildPreviousThreadMemoryComment = ({
  focusLabel,
  companionAnswerLabel,
  practiceCompleted,
}: {
  focusLabel?: string | null;
  companionAnswerLabel?: string | null;
  practiceCompleted?: boolean;
}): string | null => {
  if (focusLabel) {
    return practiceCompleted
      ? `Yesterday you chose “${focusLabel},” and you carried it into action. I noticed.`
      : `Yesterday you chose “${focusLabel}.” It can still matter without becoming a debt today.`;
  }
  if (companionAnswerLabel) {
    return `Yesterday you named “${companionAnswerLabel}.” We can keep that in view today.`;
  }
  return null;
};

export const selectLivingCompanionTapLine = ({
  bodyLanguage,
  companionId,
  interactionCount,
}: {
  bodyLanguage: LivingCompanionBodyLanguage;
  companionId?: string | null;
  interactionCount: number;
}): string => {
  const lines = TAP_LINES[bodyLanguage];
  const index = hashString(`${companionId ?? "companion"}:${bodyLanguage}:${interactionCount}`) % lines.length;
  return lines[index];
};

export const selectLivingCompanionTouchLine = ({
  zone,
  companionId,
  interactionCount,
}: {
  zone: CompanionInteractionZone;
  companionId?: string | null;
  interactionCount: number;
}): string => {
  const lines = TOUCH_LINES[zone];
  const index = hashString(`${companionId ?? "companion"}:${zone}:${interactionCount}`) % lines.length;
  return lines[index];
};

export const selectLivingCompanionActionLine = ({
  action,
  companionId,
  interactionCount,
}: {
  action: Extract<CompanionLifeAction, "greet" | "nuzzle" | "play" | "signature">;
  companionId?: string | null;
  interactionCount: number;
}): string => {
  const lines = ACTION_LINES[action];
  const index = hashString(`${companionId ?? "companion"}:${action}:${interactionCount}`) % lines.length;
  return lines[index];
};

export const selectDailyLivingCompanionQuestion = ({
  companionId,
  bodyLanguage,
  inactiveDays = 0,
  nearEvolution = false,
  now = new Date(),
}: LivingCompanionQuestionContext): LivingCompanionQuestion => {
  if (inactiveDays >= 2) return RETURN_QUESTION;
  if (nearEvolution) return EVOLUTION_QUESTION;
  if (bodyLanguage === "concerned") return CONCERNED_QUESTION;
  if (bodyLanguage === "sleepy") return SLEEPY_QUESTION;

  const hour = now.getHours();
  const pool = hour < 12
    ? MORNING_QUESTIONS
    : hour < 17
      ? DAY_QUESTIONS
      : EVENING_QUESTIONS;
  const dayKey = formatLivingCompanionDayKey(now);
  return pool[hashString(`${companionId ?? "companion"}:${dayKey}`) % pool.length];
};
