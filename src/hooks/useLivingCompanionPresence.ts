import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildPreviousThreadMemoryComment,
  deriveLivingCompanionDailyState,
  LIVING_COMPANION_EVENT_COMMENTS,
  formatLivingCompanionDayKey,
  getLivingCompanionBodyLanguage,
  selectLivingCompanionActionLine,
  selectLivingCompanionTouchLine,
  type LivingCompanionBodyLanguage,
  type LivingCompanionQuestionOption,
} from "@/config/livingCompanion";
import type { CompanionExpressionMood } from "@/config/companionCatalog";
import {
  getCompanionLifeActionLabel,
  getCompanionLifeStageProfile,
  getCompanionSpeciesMotionProfile,
  selectCompanionIdleAction,
  type CompanionInteractionZone,
  type CompanionLifeAction,
} from "@/config/companionLife";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";
import {
  announceCompanionPresenceSpeech,
  COMPANION_PRESENCE_SPOKE_EVENT,
  type CompanionPresenceSpokeDetail,
} from "@/lib/companionPresenceEvents";
import { isNearEvolution } from "@/lib/companionEvolutionSignals";
import { safeLocalStorage, safeSessionStorage } from "@/utils/storage";
import { haptics } from "@/utils/haptics";
import { useDailyGuideThread } from "@/hooks/useDailyGuideThread";
import { useDailyAdventure } from "@/hooks/useDailyAdventure";
import { useProfile } from "@/hooks/useProfile";
import { DAILY_GUIDE_FOCUS_SELECTED_EVENT } from "@/lib/dailyGuideThread";
import { trackProductExperience } from "@/lib/productAnalytics";
import { getEffectiveDailyDate } from "@/utils/timezone";
import { productScopedStorageKey } from "@/config/productRuntime";

const EXTERNAL_SPEECH_GAP_MS = 45_000;
const COMMENT_AUTO_DISMISS_MS = 5_800;
const TAP_COOLDOWN_MS = 900;
const PROACTIVE_COMMENT_COOLDOWN_MS = 8 * 60 * 1000;
const MAX_PROACTIVE_COMMENTS_PER_SESSION = 3;

const PRESENCE_BUDGET_STORAGE_PREFIX = productScopedStorageKey("living-companion:budget");
const TAP_COUNT_STORAGE_PREFIX = productScopedStorageKey("living-companion:taps");
const MEMORY_STORAGE_PREFIX = productScopedStorageKey("living-companion:daily-memory");
const DAILY_QUESTION_STORAGE_PREFIX = productScopedStorageKey("living-companion:question");

const LIFE_ACTION_DURATIONS: Record<CompanionLifeAction, number> = {
  breathe: 3_800,
  "look-around": 2_600,
  "weight-shift": 2_400,
  stretch: 2_800,
  listen: 2_200,
  greet: 1_900,
  nuzzle: 2_600,
  play: 2_500,
  celebrate: 2_800,
  settle: 3_200,
  signature: 3_200,
};

export interface LivingCompanionGaze {
  x: number;
  y: number;
  active: boolean;
}

export interface LivingCompanionInteractionPoint {
  x: number;
  y: number;
}

export interface LivingCompanionPrompt {
  id: string;
  kind: "comment" | "question";
  message: string;
  options?: readonly LivingCompanionQuestionOption[];
}

interface PresenceBudget {
  count: number;
  lastSpokenAt: number;
}

interface UseLivingCompanionPresenceOptions {
  companionId?: string | null;
  companionName: string;
  expressionMood: CompanionExpressionMood;
  isVisible: boolean;
  canInteract: boolean;
  canSpeak?: boolean;
  isDormant: boolean;
  hasDormancyWarning: boolean;
  inactiveDays?: number;
  progressToNext: number;
  canEvolve: boolean;
  currentStage?: number;
  presetId?: string | null;
  spiritAnimal?: string | null;
  enableDailyQuestion?: boolean;
}

const parsePresenceBudget = (value: string | null): PresenceBudget => {
  if (!value) return { count: 0, lastSpokenAt: 0 };

  try {
    const parsed = JSON.parse(value) as Partial<PresenceBudget>;
    return {
      count: Number.isFinite(parsed.count) ? Math.max(0, Number(parsed.count)) : 0,
      lastSpokenAt: Number.isFinite(parsed.lastSpokenAt)
        ? Math.max(0, Number(parsed.lastSpokenAt))
        : 0,
    };
  } catch {
    return { count: 0, lastSpokenAt: 0 };
  }
};

const getBudgetStorageKey = (companionId: string, dayKey: string) =>
  `${PRESENCE_BUDGET_STORAGE_PREFIX}:${companionId}:${dayKey}`;

const getTapCountStorageKey = (companionId: string) =>
  `${TAP_COUNT_STORAGE_PREFIX}:${companionId}`;

const getMemoryStorageKey = (companionId: string, dayKey: string) =>
  `${MEMORY_STORAGE_PREFIX}:${companionId}:${dayKey}`;

const getDailyQuestionStorageKey = (companionId: string, dayKey: string) =>
  `${DAILY_QUESTION_STORAGE_PREFIX}:${companionId}:${dayKey}`;

export const useLivingCompanionPresence = ({
  companionId,
  companionName,
  expressionMood,
  isVisible,
  canInteract,
  canSpeak = true,
  isDormant,
  hasDormancyWarning,
  inactiveDays = 0,
  progressToNext,
  canEvolve,
  currentStage = 1,
  presetId,
  spiritAnimal,
  enableDailyQuestion = true,
}: UseLivingCompanionPresenceOptions) => {
  const { triggerEvent } = useCompanionMotionSafe();
  const { profile } = useProfile();
  const {
    thread: dailyGuideThread,
    previousThread: previousDailyGuideThread,
    updateThread: updateDailyGuideThread,
  } = useDailyGuideThread({
    enabled: isVisible && canInteract && canSpeak,
  });
  const resolvedCompanionId = companionId ?? "companion";
  const dayKey = getEffectiveDailyDate(profile?.timezone ?? undefined);
  const budgetStorageKey = getBudgetStorageKey(resolvedCompanionId, dayKey);
  const tapCountStorageKey = getTapCountStorageKey(resolvedCompanionId);
  const memoryStorageKey = getMemoryStorageKey(resolvedCompanionId, dayKey);
  const dailyQuestionStorageKey = getDailyQuestionStorageKey(resolvedCompanionId, dayKey);
  const [prompt, setPrompt] = useState<LivingCompanionPrompt | null>(null);
  const [transientBodyLanguage, setTransientBodyLanguage] =
    useState<LivingCompanionBodyLanguage | null>(null);
  const [interactionNonce, setInteractionNonce] = useState(0);
  const [activeAction, setActiveAction] = useState<CompanionLifeAction>("breathe");
  const [gaze, setGaze] = useState<LivingCompanionGaze>({ x: 0, y: 0, active: false });
  const [interactionPoint, setInteractionPoint] = useState<LivingCompanionInteractionPoint>({ x: 50, y: 50 });
  const [lastExternalSpeechAt, setLastExternalSpeechAt] = useState(0);
  const transientTimerRef = useRef<number | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const gazeFrameRef = useRef<number | null>(null);
  const pendingGazeRef = useRef<LivingCompanionGaze | null>(null);
  const idleSequenceRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const tapCountRef = useRef(
    Number.parseInt(safeSessionStorage.getItem(tapCountStorageKey) ?? "0", 10) || 0,
  );
  const budgetRef = useRef<PresenceBudget>(
    parsePresenceBudget(safeSessionStorage.getItem(budgetStorageKey)),
  );
  const lifeStage = useMemo(() => getCompanionLifeStageProfile(currentStage), [currentStage]);
  const speciesMotion = useMemo(
    () => getCompanionSpeciesMotionProfile(presetId, spiritAnimal),
    [presetId, spiritAnimal],
  );
  const dailyAdventure = useDailyAdventure({
    ownerId: profile?.id ?? resolvedCompanionId,
    dateKey: dayKey,
    companionId: resolvedCompanionId,
    companionName,
  });

  const baseBodyLanguage = useMemo(
    () =>
      getLivingCompanionBodyLanguage({
        expressionMood,
        isDormant,
        hasDormancyWarning,
      }),
    [expressionMood, hasDormancyWarning, isDormant],
  );
  const dailyState = useMemo(
    () => deriveLivingCompanionDailyState({
      baseBodyLanguage,
      hour: new Date().getHours(),
      encouragementCompleted: Boolean(dailyGuideThread?.encouragement_completed_at),
      focusAnswered: Boolean(dailyGuideThread?.focus_answered_at),
      practiceCompleted: Boolean(dailyGuideThread?.practice_completed_at),
      eveningReflected: Boolean(dailyGuideThread?.evening_reflected_at),
    }),
    [
      baseBodyLanguage,
      dailyGuideThread?.encouragement_completed_at,
      dailyGuideThread?.evening_reflected_at,
      dailyGuideThread?.focus_answered_at,
      dailyGuideThread?.practice_completed_at,
    ],
  );
  const bodyLanguage = transientBodyLanguage ?? dailyState.bodyLanguage;
  const nearEvolution = isNearEvolution({ progressToNext, canEvolve });

  const animateBodyLanguage = useCallback((next: LivingCompanionBodyLanguage, durationMs = 2_400) => {
    if (transientTimerRef.current !== null) {
      window.clearTimeout(transientTimerRef.current);
    }

    setTransientBodyLanguage(next);
    setInteractionNonce((current) => current + 1);
    transientTimerRef.current = window.setTimeout(() => {
      transientTimerRef.current = null;
      setTransientBodyLanguage(null);
    }, durationMs);
  }, []);

  const runLifeAction = useCallback((action: CompanionLifeAction, durationMs = LIFE_ACTION_DURATIONS[action]) => {
    if (actionTimerRef.current !== null) {
      window.clearTimeout(actionTimerRef.current);
    }
    setActiveAction(action);
    actionTimerRef.current = window.setTimeout(() => {
      actionTimerRef.current = null;
      setActiveAction("breathe");
    }, durationMs);
  }, []);

  const updateGaze = useCallback((nextGaze: LivingCompanionGaze) => {
    pendingGazeRef.current = nextGaze;
    if (gazeFrameRef.current !== null) return;
    gazeFrameRef.current = window.requestAnimationFrame(() => {
      gazeFrameRef.current = null;
      if (pendingGazeRef.current) setGaze(pendingGazeRef.current);
    });
  }, []);

  const writeBudget = useCallback((budget: PresenceBudget) => {
    budgetRef.current = budget;
    safeSessionStorage.setItem(budgetStorageKey, JSON.stringify(budget));
  }, [budgetStorageKey]);

  const showProactiveComment = useCallback((
    message: string,
    nextBodyLanguage: LivingCompanionBodyLanguage,
    options?: { bypassCooldown?: boolean },
  ) => {
    if (!isVisible || !canInteract || !canSpeak || isDormant) return false;

    const now = Date.now();
    const budget = budgetRef.current;
    const cooldownMet = now - budget.lastSpokenAt >= PROACTIVE_COMMENT_COOLDOWN_MS;
    if (
      budget.count >= MAX_PROACTIVE_COMMENTS_PER_SESSION
      || (!options?.bypassCooldown && !cooldownMet)
    ) {
      return false;
    }

    writeBudget({
      count: budget.count + 1,
      lastSpokenAt: now,
    });
    setPrompt({
      id: `event-${now}`,
      kind: "comment",
      message,
    });
    animateBodyLanguage(nextBodyLanguage);
    announceCompanionPresenceSpeech("presence-bubble");
    return true;
  }, [animateBodyLanguage, canInteract, canSpeak, isDormant, isVisible, writeBudget]);

  const interact = useCallback((
    zone: CompanionInteractionZone = "head",
    point: LivingCompanionInteractionPoint = { x: 50, y: 50 },
  ) => {
    if (!isVisible || !canInteract) return;

    const now = Date.now();
    if (now - lastTapAtRef.current < TAP_COOLDOWN_MS) return;
    lastTapAtRef.current = now;
    haptics.light();
    setInteractionPoint(point);

    if (prompt?.kind === "question") {
      animateBodyLanguage("curious", 1_800);
      runLifeAction("listen", 1_800);
      return;
    }

    tapCountRef.current += 1;
    safeSessionStorage.setItem(tapCountStorageKey, String(tapCountRef.current));
    const nextBodyLanguage = isDormant ? "sleepy" : dailyState.bodyLanguage;
    setPrompt({
      id: `tap-${tapCountRef.current}`,
      kind: "comment",
      message: currentStage <= 0
        ? "A small pulse of warmth answers your touch from inside the shell."
        : isDormant
        ? "I'm resting, but nothing between us has been lost. We can begin again."
        : selectLivingCompanionTouchLine({
          zone,
          companionId: resolvedCompanionId,
          interactionCount: tapCountRef.current,
        }),
    });
    animateBodyLanguage(isDormant ? "sleepy" : currentStage <= 0 ? "calm" : "curious", 1_900);
    runLifeAction(currentStage <= 0 ? "listen" : isDormant ? "settle" : zone === "heart" ? "nuzzle" : zone === "side" ? "play" : "greet");
    triggerEvent({
      type: "xp_gain",
      intensity: "subtle",
      durationMs: 720,
      reason: "companion_tap",
    });
    announceCompanionPresenceSpeech("tap");
    void trackProductExperience("companion_interacted", {
      surface: "companion",
      properties: { interaction: "tap", zone, body_language: nextBodyLanguage },
    });
  }, [
    animateBodyLanguage,
    canInteract,
    currentStage,
    dailyState.bodyLanguage,
    isDormant,
    isVisible,
    prompt?.kind,
    resolvedCompanionId,
    runLifeAction,
    tapCountStorageKey,
    triggerEvent,
  ]);

  const comfort = useCallback(() => {
    if (!isVisible || !canInteract) return;

    haptics.success();
    setPrompt({
      id: `comfort-${Date.now()}`,
      kind: "comment",
      message: isDormant
        ? "We can be still here. Rest is allowed."
        : currentStage <= 0
          ? "The egg settles beneath your hand, its light holding steady."
        : hasDormancyWarning || baseBodyLanguage === "concerned"
          ? "Thank you for slowing down with me. Let's make the next thing kind."
          : "I felt that. It's good to pause together.",
    });
    animateBodyLanguage(isDormant ? "sleepy" : "happy", 2_600);
    runLifeAction(isDormant || currentStage <= 0 ? "settle" : "nuzzle");
    triggerEvent({
      type: "xp_gain",
      intensity: "subtle",
      durationMs: 900,
      reason: "companion_comfort",
    });
    announceCompanionPresenceSpeech("tap");
    void trackProductExperience("companion_interacted", {
      surface: "companion",
      properties: { interaction: "comfort", body_language: isDormant ? "sleepy" : "happy" },
    });
  }, [
    animateBodyLanguage,
    baseBodyLanguage,
    canInteract,
    currentStage,
    hasDormancyWarning,
    isDormant,
    isVisible,
    runLifeAction,
    triggerEvent,
  ]);

  const greet = useCallback(() => {
    if (!isVisible || !canInteract) return;
    tapCountRef.current += 1;
    safeSessionStorage.setItem(tapCountStorageKey, String(tapCountRef.current));
    setPrompt({
      id: `greet-${Date.now()}`,
      kind: "comment",
      message: currentStage <= 0
        ? "Two bright pulses answer from within. Something knows you are here."
        : selectLivingCompanionActionLine({
          action: "greet",
          companionId: resolvedCompanionId,
          interactionCount: tapCountRef.current,
        }),
    });
    animateBodyLanguage("happy", 2_400);
    runLifeAction(currentStage <= 0 ? "listen" : "greet");
    haptics.medium();
    announceCompanionPresenceSpeech("tap");
    void trackProductExperience("companion_interacted", {
      surface: "companion",
      properties: { interaction: "double_tap_greeting", stage: currentStage },
    });
  }, [animateBodyLanguage, canInteract, currentStage, isVisible, resolvedCompanionId, runLifeAction, tapCountStorageKey]);

  const pet = useCallback((point: LivingCompanionInteractionPoint = { x: 50, y: 50 }) => {
    if (!isVisible || !canInteract) return;
    tapCountRef.current += 1;
    safeSessionStorage.setItem(tapCountStorageKey, String(tapCountRef.current));
    setInteractionPoint(point);
    setPrompt({
      id: `pet-${Date.now()}`,
      kind: "comment",
      message: currentStage <= 0
        ? "The glow follows your hand across the shell."
        : selectLivingCompanionActionLine({
          action: "nuzzle",
          companionId: resolvedCompanionId,
          interactionCount: tapCountRef.current,
        }),
    });
    animateBodyLanguage("happy", 2_600);
    runLifeAction(currentStage <= 0 ? "listen" : "nuzzle");
    haptics.success();
    triggerEvent({ type: "xp_gain", intensity: "subtle", durationMs: 900, reason: "companion_pet" });
    announceCompanionPresenceSpeech("tap");
    void trackProductExperience("companion_interacted", {
      surface: "companion",
      properties: { interaction: "pet", stage: currentStage },
    });
  }, [animateBodyLanguage, canInteract, currentStage, isVisible, resolvedCompanionId, runLifeAction, tapCountStorageKey, triggerEvent]);

  const play = useCallback(() => {
    if (!isVisible || !canInteract || currentStage <= 0 || isDormant) return;
    tapCountRef.current += 1;
    safeSessionStorage.setItem(tapCountStorageKey, String(tapCountRef.current));
    const action: Extract<CompanionLifeAction, "play" | "signature"> =
      lifeStage.unlockedBehaviors.includes("signature") && tapCountRef.current % 4 === 0
        ? "signature"
        : "play";
    setPrompt({
      id: `play-${Date.now()}`,
      kind: "comment",
      message: selectLivingCompanionActionLine({
        action,
        companionId: resolvedCompanionId,
        interactionCount: tapCountRef.current,
      }),
    });
    animateBodyLanguage("excited", 2_800);
    runLifeAction(action);
    haptics.success();
    triggerEvent({
      type: action === "signature" ? "streak" : "quest_complete",
      intensity: action === "signature" ? "heroic" : "medium",
      durationMs: action === "signature" ? 1_600 : 1_100,
      reason: `companion_${action}`,
    });
    announceCompanionPresenceSpeech("tap");
    void trackProductExperience("companion_interacted", {
      surface: "companion",
      properties: { interaction: action, stage: currentStage, species: speciesMotion.speciesId },
    });
  }, [animateBodyLanguage, canInteract, currentStage, isDormant, isVisible, lifeStage.unlockedBehaviors, resolvedCompanionId, runLifeAction, speciesMotion.speciesId, tapCountStorageKey, triggerEvent]);

  const answerQuestion = useCallback((optionId: string) => {
    if (!enableDailyQuestion || !isVisible || !canInteract || !canSpeak || isDormant) return null;
    const decision = dailyAdventure.decision;
    const option = dailyAdventure.choose(optionId);
    if (!option) return null;
    const answeredAt = new Date().toISOString();
    safeLocalStorage.setItem(dailyQuestionStorageKey, JSON.stringify({
      status: "answered",
      questionId: decision.id,
      optionId: option.id,
      answeredAt,
    }));
    setPrompt({
      id: `answer-${decision.id}-${option.id}`,
      kind: "comment",
      message: option.response,
    });
    animateBodyLanguage(option.bodyLanguage, 2_800);
    runLifeAction(option.lifeAction);
    haptics.medium();
    triggerEvent({
      type: decision.kind === "path" ? "quest_complete" : "xp_gain",
      intensity: decision.kind === "path" ? "medium" : "subtle",
      durationMs: decision.kind === "path" ? 1_200 : 900,
      reason: `daily_adventure:${decision.kind}:${option.id}`,
    });
    window.dispatchEvent(new CustomEvent("companion-daily-question-answered", {
      detail: {
        companionId: resolvedCompanionId,
        questionId: decision.id,
        optionId: option.id,
        optionLabel: option.label,
        answeredAt,
      },
    }));
    const threadPatch = {
      companion_question_id: decision.id,
      companion_question: decision.prompt,
      companion_answer_id: option.id,
      companion_answer_label: option.label,
      companion_answered_at: answeredAt,
      companion_response: option.response,
      companion_acknowledged_at: answeredAt,
      ...(decision.kind === "path" && option.category && option.pathTitle ? {
        guide_question_id: decision.id,
        guide_question: decision.prompt,
        focus_option_id: option.id,
        focus_label: option.pathTitle,
        focus_category: option.category,
        focus_answered_at: answeredAt,
      } : {}),
    };
    void updateDailyGuideThread(threadPatch);
    if (decision.kind === "path" && option.category && option.pathTitle) {
      window.dispatchEvent(new CustomEvent(DAILY_GUIDE_FOCUS_SELECTED_EVENT, {
        detail: {
          category: option.category,
          focusLabel: option.pathTitle,
          guideName: companionName,
          source: "companion",
        },
      }));
    }
    void trackProductExperience("daily_adventure_choice_selected", {
      surface: "companion",
      properties: {
        decision_id: decision.id,
        decision_kind: decision.kind,
        option_id: option.id,
        category: option.category,
        intent: option.intent,
      },
    });
    announceCompanionPresenceSpeech("daily-question");
    return option;
  }, [
    animateBodyLanguage,
    canInteract,
    canSpeak,
    companionName,
    dailyAdventure,
    dailyQuestionStorageKey,
    enableDailyQuestion,
    isDormant,
    isVisible,
    resolvedCompanionId,
    runLifeAction,
    triggerEvent,
    updateDailyGuideThread,
  ]);

  const dismissPrompt = useCallback(() => {
    setPrompt(null);
  }, []);

  useEffect(() => {
    tapCountRef.current =
      Number.parseInt(safeSessionStorage.getItem(tapCountStorageKey) ?? "0", 10) || 0;
    budgetRef.current = parsePresenceBudget(safeSessionStorage.getItem(budgetStorageKey));
    lastTapAtRef.current = 0;
    setPrompt(null);
    setTransientBodyLanguage(null);
    setActiveAction("breathe");
    setGaze({ x: 0, y: 0, active: false });
    setLastExternalSpeechAt(0);

    if (transientTimerRef.current !== null) {
      window.clearTimeout(transientTimerRef.current);
      transientTimerRef.current = null;
    }
  }, [budgetStorageKey, tapCountStorageKey]);

  useEffect(() => {
    if (!isVisible || !canInteract || isDormant || prompt) return;
    const [minimumDelay, maximumDelay] = lifeStage.idleCadenceMs;
    const spread = Math.max(0, maximumDelay - minimumDelay);
    const delay = minimumDelay + ((idleSequenceRef.current * 977) % Math.max(1, spread));
    const timer = window.setTimeout(() => {
      idleSequenceRef.current += 1;
      runLifeAction(selectCompanionIdleAction({ stage: currentStage, sequence: idleSequenceRef.current }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [canInteract, currentStage, isDormant, isVisible, lifeStage.idleCadenceMs, prompt, runLifeAction, activeAction]);

  useEffect(() => {
    if (
      !isVisible
      || !canInteract
      || !canSpeak
      || isDormant
      || prompt
      || !dailyGuideThread?.companion_response
      || dailyGuideThread.companion_acknowledged_at
    ) return;

    const timer = window.setTimeout(() => {
      setPrompt({
        id: `daily-thread-${dailyGuideThread.updated_at}`,
        kind: "comment",
        message: dailyGuideThread.companion_response!,
      });
      animateBodyLanguage(dailyGuideThread.focus_answered_at ? "curious" : "happy", 2_800);
      runLifeAction(dailyGuideThread.focus_answered_at ? "listen" : "greet");
      announceCompanionPresenceSpeech("presence-bubble");
      void trackProductExperience("companion_response_viewed", {
        surface: "companion",
        properties: {
          source: "daily_thread",
          has_focus: Boolean(dailyGuideThread.focus_answered_at),
          practice_completed: Boolean(dailyGuideThread.practice_completed_at),
        },
      });
      void updateDailyGuideThread({
        companion_acknowledged_at: new Date().toISOString(),
      });
    }, 1_250);

    return () => window.clearTimeout(timer);
  }, [
    animateBodyLanguage,
    canInteract,
    canSpeak,
    dailyGuideThread?.companion_acknowledged_at,
    dailyGuideThread?.companion_response,
    dailyGuideThread?.focus_answered_at,
    dailyGuideThread?.practice_completed_at,
    dailyGuideThread?.updated_at,
    isDormant,
    isVisible,
    prompt,
    runLifeAction,
    updateDailyGuideThread,
  ]);

  useEffect(() => {
    if (
      !isVisible
      || !canInteract
      || !canSpeak
      || isDormant
      || prompt
      || profile?.companion_memory_enabled === false
      || safeLocalStorage.getItem(memoryStorageKey)
      || dailyGuideThread?.focus_answered_at
      || dailyGuideThread?.encouragement_completed_at
      || (dailyGuideThread?.companion_response && !dailyGuideThread.companion_acknowledged_at)
    ) return;

    const memoryComment = buildPreviousThreadMemoryComment({
      focusLabel: previousDailyGuideThread?.focus_label,
      companionAnswerLabel: previousDailyGuideThread?.companion_answer_label,
      practiceCompleted: Boolean(previousDailyGuideThread?.practice_completed_at),
    });
    if (!memoryComment) return;

    const timer = window.setTimeout(() => {
      if (safeLocalStorage.getItem(memoryStorageKey)) return;
      safeLocalStorage.setItem(memoryStorageKey, new Date().toISOString());
      setPrompt({
        id: `daily-memory-${previousDailyGuideThread?.thread_date ?? dayKey}`,
        kind: "comment",
        message: memoryComment,
      });
      animateBodyLanguage("calm", 2_800);
      runLifeAction("settle");
      announceCompanionPresenceSpeech("presence-bubble");
      void trackProductExperience("companion_response_viewed", {
        surface: "companion",
        properties: { source: "previous_daily_thread" },
      });
    }, 1_800);

    return () => window.clearTimeout(timer);
  }, [
    animateBodyLanguage,
    canInteract,
    canSpeak,
    dailyGuideThread?.companion_acknowledged_at,
    dailyGuideThread?.companion_response,
    dailyGuideThread?.encouragement_completed_at,
    dailyGuideThread?.focus_answered_at,
    dayKey,
    isDormant,
    isVisible,
    memoryStorageKey,
    previousDailyGuideThread?.companion_answer_label,
    previousDailyGuideThread?.focus_label,
    previousDailyGuideThread?.practice_completed_at,
    previousDailyGuideThread?.thread_date,
    profile?.companion_memory_enabled,
    prompt,
    runLifeAction,
  ]);

  useEffect(() => {
    if (
      !enableDailyQuestion
      || !isVisible
      || !canInteract
      || !canSpeak
      || isDormant
      || prompt
      || dailyAdventure.decision.kind === "bridge"
      || safeLocalStorage.getItem(dailyQuestionStorageKey)
      || (dailyGuideThread?.companion_response && !dailyGuideThread.companion_acknowledged_at)
      || Date.now() - lastExternalSpeechAt < EXTERNAL_SPEECH_GAP_MS
    ) return;

    const timer = window.setTimeout(() => {
      if (safeLocalStorage.getItem(dailyQuestionStorageKey)) return;
      const decision = dailyAdventure.decision;
      safeLocalStorage.setItem(dailyQuestionStorageKey, JSON.stringify({
        status: "offered",
        questionId: decision.id,
        offeredAt: new Date().toISOString(),
      }));
      setPrompt({
        id: decision.id,
        kind: "question",
        message: decision.prompt,
        options: decision.options,
      });
      animateBodyLanguage("curious", 3_200);
      runLifeAction("listen", 3_200);
      announceCompanionPresenceSpeech("daily-question");
      void trackProductExperience("daily_adventure_question_viewed", {
        surface: "companion",
        properties: { decision_id: decision.id, decision_kind: decision.kind },
      });
    }, 3_200);

    return () => window.clearTimeout(timer);
  }, [
    animateBodyLanguage,
    canInteract,
    canSpeak,
    dailyAdventure.decision,
    dailyGuideThread?.companion_acknowledged_at,
    dailyGuideThread?.companion_response,
    dailyQuestionStorageKey,
    enableDailyQuestion,
    isDormant,
    isVisible,
    lastExternalSpeechAt,
    prompt,
    runLifeAction,
  ]);

  useEffect(() => {
    if (prompt?.kind !== "comment") return;
    const timer = window.setTimeout(() => setPrompt(null), COMMENT_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [prompt]);

  useEffect(() => {
    if (!canInteract) return;

    const listeners = Object.entries(LIVING_COMPANION_EVENT_COMMENTS).map(([eventName, comment]) => {
      const handler = () => {
        const isMajorMoment = eventName === "companion-evolved";
        const shown = showProactiveComment(comment.message, comment.bodyLanguage, {
          bypassCooldown: isMajorMoment,
        });
        if (!shown) return;

        runLifeAction(isMajorMoment ? "signature" : "celebrate");

        triggerEvent({
          type: isMajorMoment ? "evolution_reveal" : "quest_complete",
          intensity: isMajorMoment ? "heroic" : "medium",
          reason: comment.message,
        });
      };
      window.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      listeners.forEach(({ eventName, handler }) => {
        window.removeEventListener(eventName, handler);
      });
    };
  }, [canInteract, runLifeAction, showProactiveComment, triggerEvent]);

  useEffect(() => {
    const handleExternalSpeech = (event: Event) => {
      const detail = (event as CustomEvent<CompanionPresenceSpokeDetail>).detail;
      if (
        detail?.source === "tap"
        || detail?.source === "daily-question"
        || detail?.source === "presence-bubble"
      ) return;
      setLastExternalSpeechAt(detail?.spokenAt ?? Date.now());
      setPrompt(null);
    };
    window.addEventListener(COMPANION_PRESENCE_SPOKE_EVENT, handleExternalSpeech);
    return () => window.removeEventListener(COMPANION_PRESENCE_SPOKE_EVENT, handleExternalSpeech);
  }, []);

  useEffect(() => {
    return () => {
      if (transientTimerRef.current !== null) {
        window.clearTimeout(transientTimerRef.current);
      }
      if (actionTimerRef.current !== null) {
        window.clearTimeout(actionTimerRef.current);
      }
      if (gazeFrameRef.current !== null) {
        window.cancelAnimationFrame(gazeFrameRef.current);
      }
    };
  }, []);

  return {
    bodyLanguage,
    stateLabel: dailyState.label,
    prompt,
    interactionNonce,
    interactionPoint,
    activeAction,
    activeActionLabel: getCompanionLifeActionLabel(activeAction, speciesMotion),
    gaze,
    lifeStage,
    speciesMotion,
    interact,
    comfort,
    greet,
    pet,
    play,
    updateGaze,
    answerQuestion,
    dismissPrompt,
    dailyAdventure,
    companionName,
  };
};
