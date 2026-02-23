import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";

const MIN_DIALOGUE_REFRESH_INTERVAL_MS = 90 * 1000;
const PASSIVE_DIALOGUE_REFRESH_MS = 35 * 60 * 1000;
const DEFAULT_GREETING = "Could we spend a little focused time together?";

type DialogueEventState = {
  greeting: string;
  shimmerType: CompanionShimmerType;
  microTitle: string | null;
  outcomeTag: DialogueOutcomeTag;
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
  lineId: string;
};

const DEFAULT_DIALOGUE_EVENT: DialogueEventState = {
  greeting: DEFAULT_GREETING,
  shimmerType: "none",
  microTitle: null,
  outcomeTag: "basic_checkin",
  tonePack: "soft",
  bucketKey: "base_greetings",
  lineId: "soft.base_greetings.00",
};

interface VoiceTemplate {
  species: string;
  voice_style: string;
  personality_traits: string[];
  encouragement_templates: string[];
  bond_level_dialogue: Record<string, string[]>;
}

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

  const { data: voiceTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ["companion-voice-template"],
    queryFn: async (): Promise<VoiceTemplate | null> => {
      const { data, error } = await supabase
        .from("companion_voice_templates")
        .select("species, voice_style, personality_traits, encouragement_templates, bond_level_dialogue")
        .eq("species", "universal")
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch voice template:", error);
        return null;
      }

      if (!data) return null;

      return {
        species: data.species,
        voice_style: data.voice_style,
        personality_traits: data.personality_traits || [],
        encouragement_templates: data.encouragement_templates || [],
        bond_level_dialogue: (data.bond_level_dialogue as Record<string, string[]>) || {},
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const dialogueMood = useMemo((): DialogueMood => {
    if (!care) return "content";

    if (care.dormancy?.isDormant && care.dormancy.recoveryDays > 0) return "recovering";
    if (care.dormancy?.isDormant) return "desperate";

    const overallCare = care.overallCare;
    if (overallCare >= 0.8) return "thriving";
    if (overallCare >= 0.5) return "content";
    if (overallCare >= 0.25) return "concerned";
    return "desperate";
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

  const [dialogueEvent, setDialogueEvent] = useState<DialogueEventState>(DEFAULT_DIALOGUE_EVENT);
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
      inactiveDays: care?.dormancy?.inactiveDays ?? companion?.inactive_days ?? 0,
      progressToNext: typeof progressToNext === "number" ? progressToNext : 0,
      xpToNext:
        companion && typeof nextEvolutionXP === "number"
          ? Math.max(0, nextEvolutionXP - companion.current_xp)
          : Number.MAX_SAFE_INTEGER,
      voiceStyle: voiceTemplate?.voice_style ?? "",
      needsClarity:
        !care?.hasDormancyWarning
        && (dialogueMood === "content" || dialogueMood === "thriving")
        && (care?.overallCare ?? 0) >= 0.55
        && (typeof progressToNext === "number" ? progressToNext : 0) < 65
        && (care?.dormancy?.inactiveDays ?? 0) <= 1,
      forceBaseFallback: !hasRequiredContext,
    }),
    [
      user?.id,
      dialogueMood,
      care?.overallCare,
      care?.hasDormancyWarning,
      care?.dormancy?.inactiveDays,
      companion,
      progressToNext,
      nextEvolutionXP,
      voiceTemplate?.voice_style,
      hasRequiredContext,
    ],
  );

  const runRefreshNow = useCallback(
    (triggerSource: DialogueTriggerSource) => {
      const selected = selectCompanionDialogueEvent({
        ...selectionContextBase,
        triggerSource,
        now: new Date(),
      });

      setDialogueEvent({
        greeting: selected.greeting,
        shimmerType: selected.shimmerType,
        microTitle: selected.microTitle,
        outcomeTag: selected.outcomeTag,
        tonePack: selected.tonePack,
        bucketKey: selected.bucketKey,
        lineId: selected.lineId,
      });

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
    if (!voiceTemplate || !care?.bond) return null;

    const bondLevel = Math.min(5, Math.max(1, care.bond.level));
    const bondLines = voiceTemplate.bond_level_dialogue?.[String(bondLevel)];
    if (!bondLines || bondLines.length === 0) return null;

    return pickRandom(bondLines, `bond-${bondLevel}`);
  }, [voiceTemplate, care?.bond, pickRandom]);

  const encouragement = useMemo(() => {
    if (!voiceTemplate) return null;
    return pickRandom(voiceTemplate.encouragement_templates, "encouragement");
  }, [voiceTemplate, pickRandom]);

  return {
    greeting: dialogueEvent.greeting || DEFAULT_GREETING,
    bondDialogue,
    encouragement,
    dialogueMood,
    voiceStyle: voiceTemplate?.voice_style || "",
    personalityTraits: voiceTemplate?.personality_traits || [],
    shimmerType: dialogueEvent.shimmerType,
    microTitle: dialogueEvent.microTitle,
    outcomeTag: dialogueEvent.outcomeTag,
    tonePack: dialogueEvent.tonePack,
    bucketKey: dialogueEvent.bucketKey,
    lineId: dialogueEvent.lineId,
    isLoading: templateLoading || careLoading,
  };
}
