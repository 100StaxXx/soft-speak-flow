import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPANION_BEHAVIORS,
  getCompanionAmbientBehavior,
  getCompanionInteractionMoment,
  getCompanionInteractionPrompt,
  type CompanionBehaviorId,
  type CompanionGesture,
  type CompanionInteractionPrompt,
} from "@/config/companionBehaviors";
import type { CompanionMotionEventType } from "@/config/companionMotion";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/utils/haptics";
import { logger } from "@/utils/logger";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";

const AMBIENT_MIN_DELAY_MS = 7_000;
const AMBIENT_DELAY_VARIANCE_MS = 5_000;
const BUBBLE_DISMISS_MS = 7_000;
const log = logger.scope("CompanionInteractions");

interface CompanionInteractionBubble {
  message: string;
  prompt: CompanionInteractionPrompt | null;
}

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPromptStorageKey = (companionId: string, promptKey: string) =>
  `cosmiq-companion-prompt:${companionId}:${getLocalDateKey()}:${promptKey}`;

const hasStoredPromptAnswer = (companionId: string, promptKey: string) => {
  try {
    return window.localStorage.getItem(getPromptStorageKey(companionId, promptKey)) !== null;
  } catch {
    return false;
  }
};

const storePromptAnswer = (companionId: string, promptKey: string, answerKey: string) => {
  try {
    window.localStorage.setItem(getPromptStorageKey(companionId, promptKey), answerKey);
  } catch {
    // Persistence is an enhancement; interaction remains available without it.
  }
};

export const useCompanionInteractions = ({
  companionId,
  currentStage,
  prefersReducedMotion,
}: {
  companionId: string | null | undefined;
  currentStage: number;
  prefersReducedMotion: boolean;
}) => {
  const { triggerEvent } = useCompanionMotionSafe();
  const prompt = useMemo(() => getCompanionInteractionPrompt(currentStage), [currentStage]);
  const [activeBehaviorId, setActiveBehaviorId] = useState<CompanionBehaviorId | null>(null);
  const [bubble, setBubble] = useState<CompanionInteractionBubble | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [promptOffered, setPromptOffered] = useState(() => (
    companionId ? hasStoredPromptAnswer(companionId, prompt.key) : true
  ));
  const ambientCycleRef = useRef(0);
  const behaviorTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);

  const clearBehaviorTimer = useCallback(() => {
    if (behaviorTimerRef.current !== null) {
      window.clearTimeout(behaviorTimerRef.current);
      behaviorTimerRef.current = null;
    }
  }, []);

  const clearBubbleTimer = useCallback(() => {
    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }
  }, []);

  const playBehavior = useCallback((behaviorId: CompanionBehaviorId) => {
    clearBehaviorTimer();
    setActiveBehaviorId(null);

    window.requestAnimationFrame(() => {
      setActiveBehaviorId(behaviorId);
      behaviorTimerRef.current = window.setTimeout(() => {
        setActiveBehaviorId(null);
        behaviorTimerRef.current = null;
      }, COMPANION_BEHAVIORS[behaviorId].durationMs);
    });
  }, [clearBehaviorTimer]);

  const showBubble = useCallback((nextBubble: CompanionInteractionBubble) => {
    clearBubbleTimer();
    setBubble(nextBubble);
    if (!nextBubble.prompt) {
      bubbleTimerRef.current = window.setTimeout(() => {
        setBubble(null);
        bubbleTimerRef.current = null;
      }, BUBBLE_DISMISS_MS);
    }
  }, [clearBubbleTimer]);

  const recordInteraction = useCallback(({
    kind,
    promptKey = null,
    answerKey = null,
  }: {
    kind: CompanionGesture | "answer";
    promptKey?: string | null;
    answerKey?: string | null;
  }) => {
    if (!companionId) return;

    void supabase.rpc("record_companion_interaction", {
      p_companion_id: companionId,
      p_kind: kind,
      p_prompt_key: promptKey,
      p_answer_key: answerKey,
      p_stage: currentStage,
      p_local_date: getLocalDateKey(),
    }).then(({ error }) => {
      if (error) {
        log.warn("Companion interaction could not be persisted", { kind, error: error.message });
        return;
      }

      window.dispatchEvent(new CustomEvent("companion-interaction-recorded", {
        detail: { companionId, kind },
      }));
    });
  }, [companionId, currentStage]);

  useEffect(() => {
    const hasLocalAnswer = companionId ? hasStoredPromptAnswer(companionId, prompt.key) : true;
    setPromptOffered(hasLocalAnswer);
    setBubble(null);
    setInteractionCount(0);

    if (!companionId || hasLocalAnswer) return;

    let cancelled = false;
    void supabase
      .from("companion_interaction_memory")
      .select("answer_key")
      .eq("companion_id", companionId)
      .eq("interaction_kind", "answer")
      .eq("prompt_key", prompt.key)
      .eq("interaction_day", getLocalDateKey())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          log.debug("Daily companion answer lookup was unavailable", { error: error.message });
          return;
        }
        if (!data?.answer_key) return;

        storePromptAnswer(companionId, prompt.key, data.answer_key);
        setPromptOffered(true);
      });

    return () => {
      cancelled = true;
    };
  }, [companionId, prompt.key]);

  useEffect(() => {
    if (prefersReducedMotion || !companionId || document.visibilityState === "hidden") return;

    const delay = AMBIENT_MIN_DELAY_MS
      + ((ambientCycleRef.current * 1_733 + currentStage * 811) % AMBIENT_DELAY_VARIANCE_MS);
    const timer = window.setTimeout(() => {
      ambientCycleRef.current += 1;
      playBehavior(getCompanionAmbientBehavior({
        level: currentStage,
        hour: new Date().getHours(),
        cycle: ambientCycleRef.current,
      }));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeBehaviorId, companionId, currentStage, playBehavior, prefersReducedMotion]);

  useEffect(() => () => {
    clearBehaviorTimer();
    clearBubbleTimer();
  }, [clearBehaviorTimer, clearBubbleTimer]);

  const interact = useCallback((gesture: CompanionGesture) => {
    const nextCount = interactionCount + 1;
    setInteractionCount(nextCount);
    const moment = getCompanionInteractionMoment({
      level: currentStage,
      gesture,
      interactionCount: nextCount,
    });

    playBehavior(moment.behaviorId);
    if (gesture === "hold") {
      haptics.medium();
    } else {
      haptics.light();
    }
    triggerEvent({
      type: gesture === "pet"
        ? "pet"
        : gesture === "hold"
          ? "comfort"
          : "touch",
      intensity: gesture === "pet" ? "medium" : "subtle",
      stage: currentStage,
      reason: moment.message,
    });
    recordInteraction({ kind: gesture });

    if ((gesture === "tap" || gesture === "keyboard") && !promptOffered) {
      setPromptOffered(true);
      showBubble({ message: prompt.question, prompt });
      return;
    }

    showBubble({ message: moment.message, prompt: null });
  }, [
    currentStage,
    interactionCount,
    playBehavior,
    prompt,
    promptOffered,
    recordInteraction,
    showBubble,
    triggerEvent,
  ]);

  const answerPrompt = useCallback((answerKey: string) => {
    const option = prompt.options.find((candidate) => candidate.key === answerKey);
    if (!option || !companionId) return;

    storePromptAnswer(companionId, prompt.key, option.key);
    playBehavior(option.behaviorId);
    haptics.success();
    triggerEvent({
      type: "play",
      intensity: "medium",
      stage: currentStage,
      reason: option.response,
    });
    recordInteraction({ kind: "answer", promptKey: prompt.key, answerKey: option.key });
    showBubble({ message: option.response, prompt: null });
  }, [companionId, currentStage, playBehavior, prompt, recordInteraction, showBubble, triggerEvent]);

  const reactToAdventureChoice = useCallback(({
    promptKey,
    answerKey,
    behaviorId,
    message,
    eventType = "play",
  }: {
    promptKey: string;
    answerKey: string;
    behaviorId: CompanionBehaviorId;
    message: string;
    eventType?: CompanionMotionEventType;
  }) => {
    if (!companionId) return;
    playBehavior(behaviorId);
    haptics.success();
    triggerEvent({
      type: eventType,
      intensity: eventType === "quest_complete" ? "heroic" : "medium",
      stage: currentStage,
      reason: message,
    });
    recordInteraction({ kind: "answer", promptKey, answerKey });
    showBubble({ message, prompt: null });
  }, [companionId, currentStage, playBehavior, recordInteraction, showBubble, triggerEvent]);

  return {
    activeBehaviorId,
    activeBehaviorClassName: activeBehaviorId && !prefersReducedMotion
      ? COMPANION_BEHAVIORS[activeBehaviorId].className
      : "",
    bubble,
    interact,
    answerPrompt,
    reactToAdventureChoice,
    dismissBubble: () => {
      clearBubbleTimer();
      setBubble(null);
    },
  };
};
