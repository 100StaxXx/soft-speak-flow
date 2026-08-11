import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  selectCompanionDialogueEvent,
  type DialogueMood as SelectorDialogueMood,
  type DialogueOutcomeTag,
  type DialogueTriggerSource,
} from "@/lib/companionDialogueSelector";
import type {
  CompanionDialogueBucketKey,
  CompanionDialogueTonePack,
  CompanionShimmerType,
} from "@/config/companionDialoguePacks";
import {
  DEFAULT_COMPANION_MODE,
  getCompanionModeVoiceTemplate,
} from "@/shared/companionModes";
import { useAuth } from "./useAuth";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useCompanionModeSettings } from "./useCompanionModeSettings";

const MIN_DIALOGUE_REFRESH_INTERVAL_MS = 90 * 1000;
const PASSIVE_DIALOGUE_REFRESH_MS = 35 * 60 * 1000;
const DEFAULT_GREETING = "Hot take from the voice in your ear: one focused move fixes half this mess, you beautiful little disaster.";

type DialogueEventState = {
  greeting: string;
  shimmerType: CompanionShimmerType;
  microTitle: string | null;
  outcomeTag: DialogueOutcomeTag;
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
  lineId: string;
};

const DEFAULT_VOICE_TEMPLATE = getCompanionModeVoiceTemplate(DEFAULT_COMPANION_MODE);
const DIALOGUE_FALLBACK_LINE_ID = `${DEFAULT_VOICE_TEMPLATE.tonePack}.base_greetings.01`;

const toDialogueEventState = (selected: {
  greeting: string;
  shimmerType: CompanionShimmerType;
  microTitle: string | null;
  outcomeTag: DialogueOutcomeTag;
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
  lineId: string;
}): DialogueEventState => ({
  greeting: selected.greeting,
  shimmerType: selected.shimmerType,
  microTitle: selected.microTitle,
  outcomeTag: selected.outcomeTag,
  tonePack: selected.tonePack,
  bucketKey: selected.bucketKey,
  lineId: selected.lineId,
});

const createBootstrapDialogueEvent = (): DialogueEventState => {
  try {
    const selected = selectCompanionDialogueEvent({
      userId: null,
      dialogueMood: "content",
      overallCare: 0.5,
      hasDormancyWarning: false,
      inactiveDays: 0,
      progressToNext: 0,
      xpToNext: Number.MAX_SAFE_INTEGER,
      voiceStyle: "",
      needsClarity: false,
      triggerSource: "idle",
      forceBaseFallback: true,
      now: new Date(),
      seedKey: `bootstrap-${Math.floor(Date.now() / MIN_DIALOGUE_REFRESH_INTERVAL_MS)}`,
    });
    return toDialogueEventState(selected);
  } catch {
      return {
        greeting: DEFAULT_GREETING,
        shimmerType: "none",
        microTitle: null,
        outcomeTag: "basic_checkin",
        tonePack: DEFAULT_VOICE_TEMPLATE.tonePack,
        bucketKey: "base_greetings",
        lineId: DIALOGUE_FALLBACK_LINE_ID,
      };
  }
};

export type DialogueMood = SelectorDialogueMood;

const getStableRandom = (seed: string): number => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
};

const EVENT_TO_TRIGGER: Array<[string, DialogueTriggerSource]> = [
  ["task-completed", "task-completed"],
  ["focus-sprint-completed", "focus-sprint-completed"],
  ["quest-completed", "quest-completed"],
  ["mission-completed", "mission-completed"],
  ["morning-checkin-completed", "morning-checkin-completed"],
  ["companion-evolved", "companion-evolved"],
];

export function useCompanionDialogue() {
  const { user } = useAuth();
  const { companion, progressToNext, nextEvolutionXP } = useCompanion();
  const { care, isLoading: careLoading } = useCompanionCareSignals();
  const {
    mode,
    adaptationEnabled,
  } = useCompanionModeSettings();
  const voiceTemplate = useMemo(
    () => getCompanionModeVoiceTemplate(mode),
    [mode],
  );

  const dialogueMood = useMemo((): DialogueMood => {
    if (!care) return "content";

    const overallCare = care.overallCare;
    if (overallCare >= 0.8) return "thriving";
    return "content";
  }, [care]);

  const spiritAnimal = companion?.spirit_animal || "companion";
  const pickRandom = useCallback(
    (arr: string[], contextKey: string): string => {
      if (!arr || arr.length === 0) return "";
      const seed = `${new Date().toDateString()}-${contextKey}-${spiritAnimal}`;
      const index = Math.floor(getStableRandom(seed) * arr.length);
      return arr[index];
    },
    [spiritAnimal],
  );

  const [dialogueEvent, setDialogueEvent] = useState<DialogueEventState>(() => createBootstrapDialogueEvent());
  const lastRefreshAtRef = useRef(0);
  const queuedTriggerRef = useRef<DialogueTriggerSource>("idle");
  const pendingTimerRef = useRef<number | null>(null);
  const hadRequiredContextRef = useRef(false);
  const didRunContextRefreshEffectRef = useRef(false);

  const hasRequiredContext = Boolean(care && companion && typeof nextEvolutionXP === "number");

  const selectionContextBase = useMemo(
    () => ({
      userId: user?.id ?? null,
      dialogueMood,
      overallCare: care?.overallCare ?? 0.5,
      hasDormancyWarning: care?.hasDormancyWarning ?? false,
      inactiveDays: 0,
      progressToNext: typeof progressToNext === "number" ? progressToNext : 0,
      xpToNext:
        companion && typeof nextEvolutionXP === "number"
          ? Math.max(0, nextEvolutionXP - companion.current_xp)
          : Number.MAX_SAFE_INTEGER,
      voiceStyle: voiceTemplate.voiceStyle,
      needsClarity:
        adaptationEnabled
        && !care?.hasDormancyWarning
        && (dialogueMood === "content" || dialogueMood === "thriving")
        && (care?.overallCare ?? 0) >= 0.55
        && (typeof progressToNext === "number" ? progressToNext : 0) < 65,
      forceBaseFallback: !hasRequiredContext,
    }),
    [
      user?.id,
      dialogueMood,
      care?.overallCare,
      care?.hasDormancyWarning,
      companion,
      progressToNext,
      nextEvolutionXP,
      hasRequiredContext,
      adaptationEnabled,
      voiceTemplate.voiceStyle,
    ],
  );

  const runRefreshNow = useCallback(
    (triggerSource: DialogueTriggerSource) => {
      try {
        const selected = selectCompanionDialogueEvent({
          ...selectionContextBase,
          triggerSource,
          now: new Date(),
        });
        setDialogueEvent(toDialogueEventState(selected));
      } catch (error) {
        console.error("Failed to refresh companion dialogue event:", error);
        setDialogueEvent(createBootstrapDialogueEvent());
      }

      lastRefreshAtRef.current = Date.now();
    },
    [selectionContextBase],
  );

  const requestRefresh = useCallback(
    (triggerSource: DialogueTriggerSource, force = false) => {
      queuedTriggerRef.current = triggerSource;

      const now = Date.now();
      const elapsed = now - lastRefreshAtRef.current;
      const canRunNow = force || lastRefreshAtRef.current === 0 || elapsed >= MIN_DIALOGUE_REFRESH_INTERVAL_MS;

      if (canRunNow) {
        if (pendingTimerRef.current !== null) {
          window.clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        runRefreshNow(queuedTriggerRef.current);
        queuedTriggerRef.current = "idle";
        return;
      }

      if (pendingTimerRef.current !== null) return;

      pendingTimerRef.current = window.setTimeout(() => {
        pendingTimerRef.current = null;
        runRefreshNow(queuedTriggerRef.current);
        queuedTriggerRef.current = "idle";
      }, Math.max(0, MIN_DIALOGUE_REFRESH_INTERVAL_MS - elapsed));
    },
    [runRefreshNow],
  );

  useEffect(() => {
    requestRefresh("idle", true);
  }, [requestRefresh]);

  useEffect(() => {
    if (!didRunContextRefreshEffectRef.current) {
      didRunContextRefreshEffectRef.current = true;
      return;
    }
    requestRefresh("idle");
  }, [requestRefresh, selectionContextBase]);

  useEffect(() => {
    if (!hadRequiredContextRef.current && hasRequiredContext) {
      requestRefresh("idle", true);
    }
    hadRequiredContextRef.current = hasRequiredContext;
  }, [hasRequiredContext, requestRefresh]);

  useEffect(() => {
    const listeners = EVENT_TO_TRIGGER.map(([eventName, trigger]) => {
      const handler = () => requestRefresh(trigger);
      window.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      listeners.forEach(({ eventName, handler }) => {
        window.removeEventListener(eventName, handler);
      });
    };
  }, [requestRefresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        requestRefresh("idle");
      }
    };

    const passiveInterval = window.setInterval(refreshWhenVisible, PASSIVE_DIALOGUE_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(passiveInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [requestRefresh]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const bondDialogue = useMemo(() => {
    if (!care?.bond) return null;

    const bondLevel = Math.min(5, Math.max(1, care.bond.level));
    const bondLines = voiceTemplate.bondLevelDialogue?.[String(bondLevel)];
    if (!bondLines || bondLines.length === 0) return null;

    return pickRandom(bondLines, `bond-${bondLevel}`);
  }, [voiceTemplate, care?.bond, pickRandom]);

  const encouragement = useMemo(() => {
    return pickRandom(voiceTemplate.encouragementTemplates, "encouragement");
  }, [voiceTemplate, pickRandom]);

  const refreshDialogue = useCallback((triggerSource: DialogueTriggerSource = "idle", force = false) => {
    requestRefresh(triggerSource, force);
  }, [requestRefresh]);

  return {
    greeting: dialogueEvent.greeting || DEFAULT_GREETING,
    bondDialogue,
    encouragement,
    dialogueMood,
    voiceStyle: voiceTemplate?.voiceStyle || "",
    personalityTraits: voiceTemplate?.personalityTraits || [],
    shimmerType: dialogueEvent.shimmerType,
    microTitle: dialogueEvent.microTitle,
    outcomeTag: dialogueEvent.outcomeTag,
    tonePack: dialogueEvent.tonePack,
    bucketKey: dialogueEvent.bucketKey,
    lineId: dialogueEvent.lineId,
    mode,
    adaptationEnabled,
    refreshDialogue,
    isLoading: careLoading,
  };
}
