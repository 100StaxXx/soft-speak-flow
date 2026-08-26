export type CompanionMotionSceneId =
  | "egg_idle"
  | "companion_aura"
  | "evolution_hero";

export type CompanionMotionEventType =
  | "idle"
  | "task_start"
  | "xp_gain"
  | "quest_complete"
  | "streak"
  | "wake"
  | "evolution_start"
  | "evolution_reveal";

export type CompanionMotionIntensity = "subtle" | "medium" | "heroic";

export interface CompanionMotionEvent {
  id: string;
  type: CompanionMotionEventType;
  intensity: CompanionMotionIntensity;
  durationMs: number;
  createdAt: number;
  element?: string | null;
  stage?: number | null;
  reason?: string | null;
}

export interface CompanionMotionSceneConfig {
  id: CompanionMotionSceneId;
  src: string | null;
  expectedSrc?: string;
  artboard?: string;
  stateMachines?: string[];
  inputBindings?: {
    eventTrigger?: string;
    eventCode?: string;
    intensity?: string;
    stagePower?: string;
    isIdle?: string;
  };
}

export const COMPANION_MOTION_SCENES: Record<CompanionMotionSceneId, CompanionMotionSceneConfig> = {
  // Drop-in points for production Rive assets. The runtime path is implemented now and
  // falls back to native overlays until authored .riv files are available.
  egg_idle: {
    id: "egg_idle",
    src: null,
    expectedSrc: "/rive/companion/egg_idle_v1.riv",
    artboard: "EggIdle",
    stateMachines: ["EggIdleMachine"],
    inputBindings: {
      eventTrigger: "event_trigger",
      eventCode: "event_code",
      intensity: "intensity",
      stagePower: "stage_power",
      isIdle: "is_idle",
    },
  },
  companion_aura: {
    id: "companion_aura",
    src: null,
    expectedSrc: "/rive/companion/companion_aura_v1.riv",
    artboard: "CompanionAura",
    stateMachines: ["CompanionAuraMachine"],
    inputBindings: {
      eventTrigger: "event_trigger",
      eventCode: "event_code",
      intensity: "intensity",
      stagePower: "stage_power",
      isIdle: "is_idle",
    },
  },
  evolution_hero: {
    id: "evolution_hero",
    src: null,
    expectedSrc: "/rive/companion/evolution_hero_v1.riv",
    artboard: "EvolutionHero",
    stateMachines: ["EvolutionHeroMachine"],
    inputBindings: {
      eventTrigger: "event_trigger",
      eventCode: "event_code",
      intensity: "intensity",
      stagePower: "stage_power",
      isIdle: "is_idle",
    },
  },
};

export const COMPANION_MOTION_EVENT_DURATIONS: Record<CompanionMotionEventType, number> = {
  idle: 0,
  task_start: 1200,
  xp_gain: 900,
  quest_complete: 1200,
  streak: 1500,
  wake: 2200,
  evolution_start: 2200,
  evolution_reveal: 2800,
};

export const getCompanionMotionSceneForStage = (stage: number): CompanionMotionSceneId =>
  stage <= 0 ? "egg_idle" : "companion_aura";

export const getCompanionMotionSceneConfig = (
  sceneId: CompanionMotionSceneId,
): CompanionMotionSceneConfig => COMPANION_MOTION_SCENES[sceneId];

export const shouldAttemptRiveScene = (sceneId: CompanionMotionSceneId): boolean =>
  Boolean(getCompanionMotionSceneConfig(sceneId).src);

export const getCompanionMotionEventCode = (eventType: CompanionMotionEventType): number =>
  ({
    idle: 0,
    task_start: 7,
    xp_gain: 1,
    quest_complete: 2,
    streak: 3,
    wake: 4,
    evolution_start: 5,
    evolution_reveal: 6,
  })[eventType];

export const getCompanionMotionStagePower = (stage: number): number => {
  if (stage >= 81) return 1;
  if (stage >= 56) return 0.92;
  if (stage >= 36) return 0.82;
  if (stage >= 21) return 0.7;
  if (stage >= 13) return 0.58;
  if (stage >= 5) return 0.46;
  if (stage >= 1) return 0.34;
  return 0.22;
};

export const getCompanionMotionIntensityFromXp = (xp: number): CompanionMotionIntensity => {
  if (xp >= 40) return "heroic";
  if (xp >= 20) return "medium";
  return "subtle";
};

export const getCompanionMotionEventTypeFromReason = (
  reason: string | null | undefined,
): CompanionMotionEventType => {
  const normalizedReason = reason?.trim().toLowerCase() ?? "";

  if (
    normalizedReason.includes("streak")
    || normalizedReason.includes("phase complete")
    || normalizedReason.includes("epic complete")
    || normalizedReason.includes("perfect day")
  ) {
    return "streak";
  }

  if (
    normalizedReason.includes("quest")
    || normalizedReason.includes("challenge")
    || normalizedReason.includes("ritual")
    || normalizedReason.includes("practice complete")
    || normalizedReason.includes("action complete")
    || normalizedReason.includes("step complete")
    || normalizedReason.includes("mission complete")
  ) {
    return "quest_complete";
  }

  return "xp_gain";
};

export const createCompanionMotionEventId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `motion-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
