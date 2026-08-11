import { useEffect, useMemo, useState } from "react";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";
import {
  COMPANION_EXPRESSION_VARIANT_COUNT,
  resolveCompanionArtTier,
  type CompanionExpressionMood,
} from "@/config/companionCatalog";
import { isNearEvolution } from "@/lib/companionEvolutionSignals";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useCompanionMoodSignal } from "./useCompanionMoodSignal";

const REWARD_EVENT_NAMES = [
  "task-completed",
  "focus-sprint-completed",
  "morning-checkin-completed",
  "companion-evolved",
] as const;

const ACTIVE_MOTION_EVENT_TYPES = new Set([
  "xp_gain",
  "quest_complete",
  "streak",
  "wake",
  "touch",
  "pet",
  "comfort",
  "play",
  "evolution_reveal",
]);

const POSITIVE_MOOD_SIGNAL_IDS = new Set([
  "content",
  "disciplined",
  "focused",
  "inspired",
]);

const NEGATIVE_MOOD_SIGNAL_IDS = new Set([
  "unmotivated",
  "stressed",
  "low_energy",
]);

export const COMPANION_EXPRESSION_EVENT_WINDOW_MS = 90_000;

export interface CompanionExpressionState {
  mood: CompanionExpressionMood;
  variant: number;
  reason: string;
  isEventDriven: boolean;
}

export interface DeriveCompanionExpressionStateArgs {
  companionId?: string | null;
  currentStage?: number | null;
  progressToNext?: number;
  canEvolve?: boolean;
  overallCare?: number;
  inactiveDays?: number;
  hasDormancyWarning?: boolean;
  moodSignal?: string | null;
  currentHour?: number;
  hasRecentRewardEvent?: boolean;
  hasActiveMotionEvent?: boolean;
  now?: Date;
}

const normalizeMoodSignal = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const formatLocalBucketDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const bucket = Math.floor(date.getHours() / 6);
  return `${year}-${month}-${day}:${bucket}`;
};

const getNextExpressionBucketDelay = (now: Date): number => {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(Math.floor(now.getHours() / 6) * 6 + 6, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 6, 0, 0, 0);
  }
  return Math.max(1_000, next.getTime() - now.getTime());
};

export const getCompanionExpressionVariant = ({
  companionId,
  currentStage,
  mood,
  now = new Date(),
}: {
  companionId?: string | null;
  currentStage?: number | null;
  mood: CompanionExpressionMood;
  now?: Date;
}): number => {
  const tier = resolveCompanionArtTier(currentStage ?? 0);
  const bucketKey = formatLocalBucketDate(now);
  const seed = `${companionId ?? "companion"}:${tier}:${mood}:${bucketKey}`;
  return (hashString(seed) % COMPANION_EXPRESSION_VARIANT_COUNT) + 1;
};

export const deriveCompanionExpressionState = ({
  companionId,
  currentStage,
  progressToNext = 0,
  canEvolve = false,
  overallCare = 0.5,
  inactiveDays = 0,
  hasDormancyWarning = false,
  moodSignal,
  currentHour = new Date().getHours(),
  hasRecentRewardEvent = false,
  hasActiveMotionEvent = false,
  now = new Date(),
}: DeriveCompanionExpressionStateArgs): CompanionExpressionState => {
  const normalizedMoodSignal = normalizeMoodSignal(moodSignal);
  const hasEventDrivenExcitement = hasRecentRewardEvent || hasActiveMotionEvent;
  const nearEvolution = canEvolve || isNearEvolution({ progressToNext, canEvolve });

  let mood: CompanionExpressionMood = "calm";
  let reason = "default-calm";
  let isEventDriven = false;

  if (hasEventDrivenExcitement) {
    mood = "excited";
    reason = "recent-reward-event";
    isEventDriven = true;
  } else if (nearEvolution) {
    mood = "excited";
    reason = "near-evolution";
  } else if (normalizedMoodSignal && NEGATIVE_MOOD_SIGNAL_IDS.has(normalizedMoodSignal)) {
    mood = "concerned";
    reason = "negative-mood";
  } else if (currentHour >= 22 || currentHour < 6) {
    mood = "sleepy";
    reason = "late-night";
  } else if (normalizedMoodSignal && POSITIVE_MOOD_SIGNAL_IDS.has(normalizedMoodSignal)) {
    mood = "happy";
    reason = "positive-mood";
  } else if (overallCare >= 0.65) {
    mood = "happy";
    reason = "strong-care";
  }

  return {
    mood,
    variant: getCompanionExpressionVariant({
      companionId,
      currentStage,
      mood,
      now,
    }),
    reason,
    isEventDriven,
  };
};

export const useCompanionExpressionState = (): CompanionExpressionState => {
  const { companion, progressToNext, canEvolve } = useCompanion();
  const { care } = useCompanionCareSignals();
  const { activeEvent } = useCompanionMotionSafe();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [recentRewardEventAt, setRecentRewardEventAt] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNowTick(Date.now());
    }, getNextExpressionBucketDelay(new Date(nowTick)));

    return () => {
      window.clearTimeout(timer);
    };
  }, [nowTick]);

  useEffect(() => {
    const markRecentRewardEvent = () => setRecentRewardEventAt(Date.now());

    REWARD_EVENT_NAMES.forEach((eventName) => {
      window.addEventListener(eventName, markRecentRewardEvent);
    });

    return () => {
      REWARD_EVENT_NAMES.forEach((eventName) => {
        window.removeEventListener(eventName, markRecentRewardEvent);
      });
    };
  }, []);

  useEffect(() => {
    if (recentRewardEventAt === null) return;

    const elapsed = Date.now() - recentRewardEventAt;
    if (elapsed >= COMPANION_EXPRESSION_EVENT_WINDOW_MS) {
      setRecentRewardEventAt(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setRecentRewardEventAt(null);
    }, COMPANION_EXPRESSION_EVENT_WINDOW_MS - elapsed);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentRewardEventAt]);

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const moodSignal = useCompanionMoodSignal(now);
  const hasActiveMotionEvent = Boolean(
    activeEvent && ACTIVE_MOTION_EVENT_TYPES.has(activeEvent.type),
  );

  return useMemo(
    () =>
      deriveCompanionExpressionState({
        companionId: companion?.id,
        currentStage: companion?.current_stage ?? 0,
        progressToNext,
        canEvolve,
        overallCare: care.overallCare,
        inactiveDays: care.dormancy.inactiveDays,
        hasDormancyWarning: care.hasDormancyWarning,
        moodSignal: moodSignal.moodSignal,
        currentHour: now.getHours(),
        hasRecentRewardEvent: recentRewardEventAt !== null,
        hasActiveMotionEvent,
        now,
      }),
    [
      companion?.id,
      companion?.current_stage,
      progressToNext,
      canEvolve,
      care.overallCare,
      care.dormancy.inactiveDays,
      care.hasDormancyWarning,
      moodSignal.moodSignal,
      now,
      recentRewardEventAt,
      hasActiveMotionEvent,
    ],
  );
};
