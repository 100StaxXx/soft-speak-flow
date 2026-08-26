import type { LivingCompanionBodyLanguage } from "@/config/livingCompanion";
import type { CompanionLifeAction } from "@/config/companionLife";
import type { DailyFormationCategory } from "@/data/dailyFormationPractices";
import { productScopedStorageKey } from "@/config/productRuntime";

export const DAILY_ADVENTURE_UPDATED_EVENT = productScopedStorageKey("daily-adventure-updated");
export const DAILY_ADVENTURE_PATH_CHOSEN_EVENT = productScopedStorageKey("daily-adventure-path-chosen");
export const DAILY_ADVENTURE_STORAGE_PREFIX = productScopedStorageKey("daily-adventure:v1");

export type DailyAdventureDecisionKind = "path" | "midday" | "evening" | "bridge";
export type DailyAdventureOptionIntent =
  | "choose-path"
  | "record-beat"
  | "open-quest"
  | "open-guide"
  | "companion-action";

export interface DailyAdventureOption {
  id: string;
  label: string;
  response: string;
  bodyLanguage: LivingCompanionBodyLanguage;
  lifeAction: CompanionLifeAction;
  intent: DailyAdventureOptionIntent;
  category?: DailyFormationCategory;
  pathTitle?: string;
  storyBeat?: string;
}

export interface DailyAdventureDecision {
  id: string;
  kind: DailyAdventureDecisionKind;
  eyebrow: string;
  prompt: string;
  options: readonly DailyAdventureOption[];
}

export interface DailyAdventureChoiceRecord {
  decisionId: string;
  decisionKind: Exclude<DailyAdventureDecisionKind, "bridge">;
  optionId: string;
  optionLabel: string;
  response: string;
  storyBeat: string;
  chosenAt: string;
}

export interface DailyAdventurePath {
  id: string;
  title: string;
  choiceLabel: string;
  category: DailyFormationCategory;
  companionName: string;
  chosenAt: string;
}

export interface DailyAdventureQuest {
  practiceId: string;
  title: string;
  action: string;
  category: DailyFormationCategory;
  attachedAt: string;
  completedAt: string | null;
}

export interface DailyAdventureState {
  version: 1;
  ownerId: string;
  dateKey: string;
  path: DailyAdventurePath | null;
  middayChoice: DailyAdventureChoiceRecord | null;
  eveningChoice: DailyAdventureChoiceRecord | null;
  quest: DailyAdventureQuest | null;
  storyBeats: DailyAdventureChoiceRecord[];
  updatedAt: string;
}

const PATH_OPTIONS: readonly Omit<DailyAdventureOption, "intent">[] = [
  {
    id: "courage",
    label: "We face what I’ve been avoiding.",
    response: "Then we take the Path of Courage. We only need the next faithful move.",
    bodyLanguage: "excited",
    lifeAction: "greet",
    category: "Soul",
    pathTitle: "Path of Courage",
    storyBeat: "You chose to meet the day with courage.",
  },
  {
    id: "clarity",
    label: "We clear the noise and choose what matters.",
    response: "The Path of Clarity is open. I’ll help you keep the true thing in view.",
    bodyLanguage: "curious",
    lifeAction: "listen",
    category: "Mind",
    pathTitle: "Path of Clarity",
    storyBeat: "You chose clarity over noise.",
  },
  {
    id: "strength",
    label: "We restore my strength before we spend it.",
    response: "Then we take the Path of Strength. Caring for the vessel is part of the calling.",
    bodyLanguage: "calm",
    lifeAction: "stretch",
    category: "Body",
    pathTitle: "Path of Strength",
    storyBeat: "You chose to restore your strength with purpose.",
  },
  {
    id: "connection",
    label: "We move toward someone instead of pulling away.",
    response: "The Path of Connection, then. We’ll look for one honest way to draw near.",
    bodyLanguage: "happy",
    lifeAction: "nuzzle",
    category: "Soul",
    pathTitle: "Path of Connection",
    storyBeat: "You chose connection over distance.",
  },
  {
    id: "stewardship",
    label: "We put one important thing back in order.",
    response: "We’ll walk the Path of Stewardship—one responsibility, carried well.",
    bodyLanguage: "curious",
    lifeAction: "look-around",
    category: "Mind",
    pathTitle: "Path of Stewardship",
    storyBeat: "You chose to bring order to what has been entrusted to you.",
  },
  {
    id: "service",
    label: "We look for someone I can strengthen.",
    response: "The Path of Service is before us. Let’s make care concrete today.",
    bodyLanguage: "happy",
    lifeAction: "greet",
    category: "Soul",
    pathTitle: "Path of Service",
    storyBeat: "You chose to turn outward in service.",
  },
  {
    id: "renewal",
    label: "We make room to be renewed by God.",
    response: "Then we enter the Path of Renewal. Rest can prepare us for what comes next.",
    bodyLanguage: "calm",
    lifeAction: "settle",
    category: "Body",
    pathTitle: "Path of Renewal",
    storyBeat: "You chose renewal instead of running on empty.",
  },
];

const MIDDAY_OPTIONS: readonly DailyAdventureOption[] = [
  {
    id: "stay-course",
    label: "Stay the course—one honest step.",
    response: "We stay with it. Not the whole road—just the next marker.",
    bodyLanguage: "curious",
    lifeAction: "listen",
    intent: "record-beat",
    storyBeat: "At the crossroads, you stayed the course.",
  },
  {
    id: "side-path",
    label: "Take a side path and help someone.",
    response: "A good adventure leaves room for another person. Let’s notice who is near.",
    bodyLanguage: "happy",
    lifeAction: "greet",
    intent: "record-beat",
    storyBeat: "You made room for someone else along the way.",
  },
  {
    id: "regroup",
    label: "Regroup before I continue.",
    response: "We pause with purpose, then. Regrouping is part of the journey.",
    bodyLanguage: "calm",
    lifeAction: "settle",
    intent: "record-beat",
    storyBeat: "You paused to regain your footing.",
  },
];

const EVENING_OPTIONS: readonly DailyAdventureOption[] = [
  {
    id: "celebrate",
    label: "Name the win and celebrate it.",
    response: "Yes. Before the day closes, we let the good thing count.",
    bodyLanguage: "excited",
    lifeAction: "celebrate",
    intent: "record-beat",
    storyBeat: "You ended the chapter by naming what was good.",
  },
  {
    id: "learn",
    label: "Keep the lesson; release the weight.",
    response: "We’ll carry the wisdom forward and leave the weight here.",
    bodyLanguage: "curious",
    lifeAction: "listen",
    intent: "record-beat",
    storyBeat: "You kept the lesson and released the weight.",
  },
  {
    id: "entrust",
    label: "Entrust the unfinished to God.",
    response: "What remains can rest in hands larger than ours tonight.",
    bodyLanguage: "calm",
    lifeAction: "settle",
    intent: "record-beat",
    storyBeat: "You entrusted the unfinished to God.",
  },
];

const BRIDGE_OPTIONS: readonly DailyAdventureOption[] = [
  {
    id: "open-quest",
    label: "Show me the quest we chose.",
    response: "I’ll meet you there. Our next marker is waiting on Today.",
    bodyLanguage: "curious",
    lifeAction: "look-around",
    intent: "open-quest",
  },
  {
    id: "bond-moment",
    label: "Give me a sign you’re still with me.",
    response: "Always. The story moves in moments like this too.",
    bodyLanguage: "happy",
    lifeAction: "signature",
    intent: "companion-action",
  },
  {
    id: "open-guide",
    label: "Let’s bring my Guide into this.",
    response: "Good. Your Guide already knows the path we chose.",
    bodyLanguage: "curious",
    lifeAction: "listen",
    intent: "open-guide",
  },
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const rotate = <T,>(items: readonly T[], offset: number): T[] =>
  items.map((_, index) => items[(index + offset) % items.length]);

export const getDailyAdventureStorageKey = (ownerId: string, dateKey: string) =>
  `${DAILY_ADVENTURE_STORAGE_PREFIX}:${ownerId}:${dateKey}`;

export const createEmptyDailyAdventure = (
  ownerId: string,
  dateKey: string,
  now = new Date(),
): DailyAdventureState => ({
  version: 1,
  ownerId,
  dateKey,
  path: null,
  middayChoice: null,
  eveningChoice: null,
  quest: null,
  storyBeats: [],
  updatedAt: now.toISOString(),
});

export const isDailyAdventureState = (value: unknown): value is DailyAdventureState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<DailyAdventureState>;
  return state.version === 1 && typeof state.ownerId === "string" && typeof state.dateKey === "string";
};

export const selectDailyAdventureDecision = ({
  state,
  companionId,
  hour,
}: {
  state: DailyAdventureState;
  companionId: string;
  hour: number;
}): DailyAdventureDecision => {
  if (!state.path) {
    const offset = hashString(`${state.ownerId}:${companionId}:${state.dateKey}`) % PATH_OPTIONS.length;
    const options = rotate(PATH_OPTIONS, offset).slice(0, 3).map((option) => ({
      ...option,
      intent: "choose-path" as const,
    }));
    return {
      id: `path:${state.dateKey}`,
      kind: "path",
      eyebrow: "Morning crossroads",
      prompt: "The day is opening before us. Which path should we take?",
      options,
    };
  }

  if (!state.eveningChoice && (hour >= 17 || Boolean(state.quest?.completedAt))) {
    return {
      id: `evening:${state.dateKey}`,
      kind: "evening",
      eyebrow: "Chapter’s end",
      prompt: state.quest?.completedAt
        ? "We reached today’s marker. How should this chapter end?"
        : "The light is changing. What should we carry out of this chapter?",
      options: EVENING_OPTIONS,
    };
  }

  if (!state.middayChoice && hour >= 11) {
    return {
      id: `midday:${state.dateKey}`,
      kind: "midday",
      eyebrow: "The road turns",
      prompt: `We’re on the ${state.path.title}. What is our next move?`,
      options: MIDDAY_OPTIONS,
    };
  }

  const pathIsClosed = Boolean(state.eveningChoice);
  return {
    id: `bridge:${state.dateKey}:${pathIsClosed ? "closed" : "open"}`,
    kind: "bridge",
    eyebrow: pathIsClosed ? "Chapter complete" : state.path.title,
    prompt: pathIsClosed
      ? "Today’s choices are part of our story now. Where should we go from here?"
      : "Our path is set. What do you want to do next?",
    options: BRIDGE_OPTIONS,
  };
};

export const applyDailyAdventureChoice = ({
  state,
  decision,
  option,
  companionName,
  now = new Date(),
}: {
  state: DailyAdventureState;
  decision: DailyAdventureDecision;
  option: DailyAdventureOption;
  companionName: string;
  now?: Date;
}): DailyAdventureState => {
  if (decision.kind === "bridge") return state;

  const chosenAt = now.toISOString();
  const choice: DailyAdventureChoiceRecord = {
    decisionId: decision.id,
    decisionKind: decision.kind,
    optionId: option.id,
    optionLabel: option.label,
    response: option.response,
    storyBeat: option.storyBeat ?? option.label,
    chosenAt,
  };
  const next: DailyAdventureState = {
    ...state,
    storyBeats: [...state.storyBeats, choice],
    updatedAt: chosenAt,
  };

  if (decision.kind === "path" && option.category && option.pathTitle) {
    next.path = {
      id: option.id,
      title: option.pathTitle,
      choiceLabel: option.label,
      category: option.category,
      companionName,
      chosenAt,
    };
  } else if (decision.kind === "midday") {
    next.middayChoice = choice;
  } else if (decision.kind === "evening") {
    next.eveningChoice = choice;
  }

  return next;
};
