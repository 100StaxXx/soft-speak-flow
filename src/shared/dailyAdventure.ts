import type { CompanionBehaviorId } from "@/config/companionBehaviors";
import type { DailyMissionIntention, DailyMissionRecommendation, MissionThreadTask } from "@/shared/dailyMissionThread";

export type DailyAdventurePhase = "opening" | "underway" | "crossroads" | "evening" | "return" | "resolved";
export type DailyAdventureOutcome = "quest_completed" | "carried_forward" | "released";

export interface DailyAdventureChoice {
  key: string;
  label: string;
  description: string;
  reply: string;
  behaviorId: CompanionBehaviorId;
  intention?: DailyMissionIntention;
  reflectionKey?: "moved_forward" | "cleared_space" | "enough_today";
  closesChapter?: boolean;
}

export interface DailyAdventureDecision {
  key: string;
  label: string;
  reply: string;
  chosenAt: string;
}

export interface DailyAdventureState {
  version: 1;
  storyKey: string;
  chapterTitle: string;
  openingScene: string;
  morningChoice: DailyAdventureDecision;
  crossroadsChoice: DailyAdventureDecision | null;
  eveningChoice: DailyAdventureDecision | null;
  outcome: DailyAdventureOutcome | null;
}

const OPENING_SCENES = [
  "A new signal flickers at the edge of the map. {name} looks to you before choosing a course.",
  "Three paths emerge from the morning haze. {name} waits beside you, alert and ready.",
  "The ship is quiet, but today’s star-map is already shifting. {name} has found three possible routes.",
  "A small constellation brightens above your shared path. {name} nudges the map toward you.",
  "The day arrives like an unexplored world. {name} studies the horizon, then turns to you.",
  "A distant beacon breaks the silence. Whatever it means, {name} wants to answer it with you.",
] as const;

const CHAPTER_TITLES = [
  "The Signal Beyond the Map",
  "Three Paths at First Light",
  "The Uncharted Day",
  "A Beacon in the Quiet",
  "The Orbit We Choose",
  "The Next True Step",
] as const;

const MORNING_VARIANTS: Record<DailyMissionIntention, readonly Omit<DailyAdventureChoice, "intention">[]> = {
  finish: [
    {
      key: "seal-the-rift",
      label: "Seal the open rift",
      description: "Find one loose end and close it for good.",
      reply: "There—the unfinished signal. We close that loop, and the whole map gets quieter.",
      behaviorId: "touch_eye_contact",
    },
    {
      key: "recover-the-signal",
      label: "Recover the lost signal",
      description: "Bring one nearly-finished quest safely home.",
      reply: "I found the clearest trail. Let’s bring this one all the way home.",
      behaviorId: "initiate_pounce",
    },
    {
      key: "clear-the-debris",
      label: "Clear the orbital debris",
      description: "Remove one task that keeps circling your mind.",
      reply: "One piece of debris, one clean sweep. I’ll stay on its trail with you.",
      behaviorId: "guardian_guard",
    },
  ],
  progress: [
    {
      key: "follow-the-beacon",
      label: "Follow the brightest beacon",
      description: "Move the quest that matters most one real step forward.",
      reply: "The beacon is steady. We don’t need the whole route—only the next true coordinate.",
      behaviorId: "awakened_flare",
    },
    {
      key: "chart-new-ground",
      label: "Chart new ground",
      description: "Explore a meaningful next step in a larger mission.",
      reply: "Uncharted doesn’t mean unreachable. Let’s mark one new piece of the map.",
      behaviorId: "ambient_glance",
    },
    {
      key: "power-the-engine",
      label: "Power the main engine",
      description: "Put today’s energy behind your larger quest.",
      reply: "Main engine it is. A focused burst will change our trajectory more than scattered sparks.",
      behaviorId: "champion_victory",
    },
  ],
  recover: [
    {
      key: "quiet-orbit",
      label: "Take the quiet orbit",
      description: "Protect enough energy to keep the journey sustainable.",
      reply: "Quiet orbit confirmed. We protect the ship so tomorrow still has somewhere to begin.",
      behaviorId: "touch_nuzzle",
    },
    {
      key: "find-shelter",
      label: "Find shelter in the storm",
      description: "Choose one restorative action and let it count.",
      reply: "I found a calm pocket in the storm. Reaching it is a real mission.",
      behaviorId: "ambient_breathe",
    },
    {
      key: "restore-the-shields",
      label: "Restore the shields",
      description: "Make recovery part of the plan, not an afterthought.",
      reply: "Shields first. Strength returns faster when we stop pretending it never runs low.",
      behaviorId: "guardian_guard",
    },
  ],
};

const hashText = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pick = <T>(items: readonly T[], seed: number, offset = 0): T =>
  items[(seed + offset) % items.length] ?? items[0];

const rotate = <T>(items: readonly T[], amount: number): T[] => {
  if (!items.length) return [];
  const offset = amount % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
};

export const getDailyAdventureStory = ({
  missionDate,
  companionName,
  currentStage,
}: {
  missionDate: string;
  companionName: string;
  currentStage: number;
}) => {
  const seed = hashText(`${missionDate}:${currentStage}:${companionName}`);
  return {
    storyKey: `${missionDate}:${seed.toString(36)}`,
    chapterTitle: pick(CHAPTER_TITLES, seed),
    openingScene: pick(OPENING_SCENES, seed, 3).replace("{name}", companionName),
  };
};

export const buildMorningAdventureChoices = ({
  missionDate,
  currentStage,
}: {
  missionDate: string;
  currentStage: number;
}): DailyAdventureChoice[] => {
  const seed = hashText(`${missionDate}:${currentStage}:morning`);
  const dayIndex = Math.floor(new Date(`${missionDate}T12:00:00Z`).getTime() / 86_400_000);
  const intentions: DailyMissionIntention[] = ["finish", "progress", "recover"];
  const choices = intentions.map((intention, index) => ({
    ...pick(MORNING_VARIANTS[intention], dayIndex, index),
    intention,
  }));
  return rotate(choices, seed % choices.length);
};

export const createDailyAdventureState = ({
  story,
  choice,
  chosenAt = new Date().toISOString(),
}: {
  story: ReturnType<typeof getDailyAdventureStory>;
  choice: DailyAdventureChoice;
  chosenAt?: string;
}): DailyAdventureState => ({
  version: 1,
  ...story,
  morningChoice: {
    key: choice.key,
    label: choice.label,
    reply: choice.reply,
    chosenAt,
  },
  crossroadsChoice: null,
  eveningChoice: null,
  outcome: null,
});

const readDecision = (value: unknown): DailyAdventureDecision | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.key !== "string"
    || typeof candidate.label !== "string"
    || typeof candidate.reply !== "string"
    || typeof candidate.chosenAt !== "string"
  ) return null;
  return {
    key: candidate.key,
    label: candidate.label,
    reply: candidate.reply,
    chosenAt: candidate.chosenAt,
  };
};

export const parseDailyAdventureState = (value: unknown): DailyAdventureState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const morningChoice = readDecision(candidate.morningChoice);
  if (
    candidate.version !== 1
    || typeof candidate.storyKey !== "string"
    || typeof candidate.chapterTitle !== "string"
    || typeof candidate.openingScene !== "string"
    || !morningChoice
  ) return null;
  const validOutcome = candidate.outcome === null
    || candidate.outcome === "quest_completed"
    || candidate.outcome === "carried_forward"
    || candidate.outcome === "released";
  if (!validOutcome) return null;
  return {
    version: 1,
    storyKey: candidate.storyKey,
    chapterTitle: candidate.chapterTitle,
    openingScene: candidate.openingScene,
    morningChoice,
    crossroadsChoice: readDecision(candidate.crossroadsChoice),
    eveningChoice: readDecision(candidate.eveningChoice),
    outcome: candidate.outcome as DailyAdventureOutcome | null,
  };
};

export const addAdventureDecision = ({
  state,
  phase,
  choice,
  outcome = state.outcome,
  chosenAt = new Date().toISOString(),
}: {
  state: DailyAdventureState;
  phase: "crossroads" | "evening";
  choice: DailyAdventureChoice;
  outcome?: DailyAdventureOutcome | null;
  chosenAt?: string;
}): DailyAdventureState => ({
  ...state,
  [phase === "crossroads" ? "crossroadsChoice" : "eveningChoice"]: {
    key: choice.key,
    label: choice.label,
    reply: choice.reply,
    chosenAt,
  },
  outcome,
});

export const deriveDailyAdventurePhase = ({
  status,
  state,
  hour,
  primaryTaskCompleted,
  completedTaskCount,
}: {
  status: string | null | undefined;
  state: DailyAdventureState | null;
  hour: number;
  primaryTaskCompleted: boolean;
  completedTaskCount: number;
}): DailyAdventurePhase => {
  if (!status) return "opening";
  if (status === "reflected") return "resolved";
  if (status === "completed" || primaryTaskCompleted) return "return";
  if (hour >= 18 && state?.eveningChoice?.key !== "one-last-opening") return "evening";
  if (!state?.crossroadsChoice && (hour >= 13 || completedTaskCount > 0)) return "crossroads";
  return "underway";
};

export const buildCrossroadsChoices = ({
  primaryTitle,
  optionalTaskTitles,
  hour,
}: {
  primaryTitle: string;
  optionalTaskTitles: string[];
  hour: number;
}): DailyAdventureChoice[] => {
  const sideQuest = optionalTaskTitles[0]?.trim();
  return [
    {
      key: "hold-course",
      label: hour < 16 ? "Hold our course" : "Make the next move",
      description: `Keep “${primaryTitle}” as the mission and move before the signal fades.`,
      reply: "Course held. I’ll keep the signal clear while you make the next move.",
      behaviorId: "touch_eye_contact",
    },
    {
      key: "take-side-route",
      label: sideQuest ? "Take the side route" : "Scout a smaller opening",
      description: sideQuest
        ? `Reroute today’s chapter through “${sideQuest}.”`
        : "Approach the same mission through its smallest useful step.",
      reply: sideQuest
        ? `The side route is live. “${sideQuest}” becomes our new way through.`
        : "I found a smaller opening. Ten focused minutes can still change the terrain.",
      behaviorId: "ambient_glance",
    },
    {
      key: "regroup-together",
      label: "Regroup with me",
      description: "Pause, reset the approach, and protect enough energy to continue.",
      reply: "We regroup here—no lost ground, no guilt. Then we choose the next honest step.",
      behaviorId: "touch_nuzzle",
    },
  ];
};

export const buildReturnChoices = ({
  primaryTitle,
}: {
  primaryTitle: string;
}): DailyAdventureChoice[] => [
  {
    key: "moved_forward",
    label: "We changed the trajectory",
    description: `“${primaryTitle}” moved something important forward.`,
    reply: "I felt it too. I’ll remember that forward motion changed our course today.",
    behaviorId: "champion_victory",
    reflectionKey: "moved_forward",
    closesChapter: true,
  },
  {
    key: "cleared_space",
    label: "We cleared the static",
    description: "Finishing it made the rest of the map easier to read.",
    reply: "The signal is clearer now. I’ll remember what making space did for us.",
    behaviorId: "awakened_flare",
    reflectionKey: "cleared_space",
    closesChapter: true,
  },
  {
    key: "enough_today",
    label: "That was enough for today",
    description: "Let this completed step be a full ending.",
    reply: "Then we end here—proud, present, and with nothing left to prove tonight.",
    behaviorId: "touch_nuzzle",
    reflectionKey: "enough_today",
    closesChapter: true,
  },
];

export const buildEveningChoices = ({
  primaryTitle,
}: {
  primaryTitle: string;
}): DailyAdventureChoice[] => [
  {
    key: "one-last-opening",
    label: "Find one last opening",
    description: `Stay with “${primaryTitle}” and make one honest attempt.`,
    reply: "I see an opening. It doesn’t need to be dramatic—just real. I’m with you.",
    behaviorId: "touch_eye_contact",
    closesChapter: false,
  },
  {
    key: "carry-forward",
    label: "Carry the quest forward",
    description: "Move the mission into tomorrow without turning it into a debt.",
    reply: "I’ll carry the marker with us. Tomorrow gets a clear starting point, not a burden.",
    behaviorId: "guardian_guard",
    reflectionKey: "enough_today",
    closesChapter: true,
  },
  {
    key: "release-the-day",
    label: "Let today end here",
    description: "Close the chapter honestly and leave the unfinished path untouched.",
    reply: "The day can end without a verdict. I’ll remember that we chose an honest return.",
    behaviorId: "ambient_breathe",
    reflectionKey: "enough_today",
    closesChapter: true,
  },
];

export const getCrossroadsTaskUpdate = ({
  choiceKey,
  recommendation,
  tasks,
}: {
  choiceKey: string;
  recommendation: Pick<DailyMissionRecommendation, "primaryTaskId" | "primaryTaskTitle" | "primaryTaskDurationMinutes" | "optionalTaskIds" | "optionalTaskTitles">;
  tasks: MissionThreadTask[];
}) => {
  if (choiceKey === "take-side-route" && recommendation.optionalTaskIds[0]) {
    const nextTaskId = recommendation.optionalTaskIds[0];
    const nextTask = tasks.find((task) => task.id === nextTaskId);
    if (nextTask) {
      return {
        primaryTaskId: nextTask.id,
        primaryTaskTitle: nextTask.task_text,
        primaryTaskDurationMinutes: Math.min(480, Math.max(5, nextTask.estimated_duration ?? 20)),
        optionalTaskIds: [
          ...(recommendation.primaryTaskId ? [recommendation.primaryTaskId] : []),
          ...recommendation.optionalTaskIds.slice(1),
        ].slice(0, 2),
        optionalTaskTitles: [
          recommendation.primaryTaskTitle,
          ...recommendation.optionalTaskTitles.slice(1),
        ].slice(0, 2),
      };
    }
  }

  return {};
};
