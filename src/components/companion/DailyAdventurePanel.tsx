import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Compass, Loader2, Orbit, Sparkles } from "lucide-react";

import {
  getCompanionStageSignatureBehavior,
  type CompanionBehaviorId,
} from "@/config/companionBehaviors";
import type { CompanionMotionEventType } from "@/config/companionMotion";
import { Button } from "@/components/ui/button";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useDailyMissionThread } from "@/hooks/useDailyMissionThread";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useExternalCalendarEvents } from "@/hooks/useExternalCalendarEvents";
import { toast } from "@/components/ui/sonner";
import {
  addAdventureDecision,
  buildCrossroadsChoices,
  buildEveningChoices,
  buildMorningAdventureChoices,
  buildReturnChoices,
  createDailyAdventureState,
  deriveDailyAdventurePhase,
  getCrossroadsTaskUpdate,
  getDailyAdventureStory,
  parseDailyAdventureState,
  type DailyAdventureChoice,
  type DailyAdventureState,
} from "@/shared/dailyAdventure";
import { buildDailyMissionRecommendation } from "@/shared/dailyMissionThread";
import { getEffectiveMissionDate } from "@/utils/timezone";
import { cn } from "@/lib/utils";

export interface DailyAdventureReaction {
  promptKey: string;
  answerKey: string;
  behaviorId: CompanionBehaviorId;
  message: string;
  eventType?: CompanionMotionEventType;
}

interface DailyAdventurePanelProps {
  companionName: string;
  currentStage: number;
  onReaction: (reaction: DailyAdventureReaction) => void;
}

const getMissionDateValue = (missionDate: string) => new Date(`${missionDate}T12:00:00`);

const getCurrentTimeMinutes = (missionDate: string): number | undefined => {
  const now = new Date();
  const localDate = now.toLocaleDateString("en-CA");
  const previousDate = format(addDays(now, -1), "yyyy-MM-dd");
  if (missionDate !== localDate) {
    return now.getHours() < 2 && missionDate === previousDate ? 23 * 60 + 45 : undefined;
  }
  return Math.min(23 * 60 + 45, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
};

const getInteractionChoices = (
  companionName: string,
  primaryTitle: string,
  intentionKey: string,
): DailyAdventureChoice[] => [
  {
    key: "show-next-move",
    label: "Show me the next move",
    description: "Ask your companion to make the opening feel smaller.",
    reply: `Start by opening “${primaryTitle}.” No finishing yet—just cross the threshold.`,
    behaviorId: "touch_eye_contact",
  },
  {
    key: "stay-close",
    label: `Stay close, ${companionName}`,
    description: "Begin with your companion keeping watch.",
    reply: "I’m here. You move; I’ll hold the signal steady until momentum takes over.",
    behaviorId: "guardian_guard",
  },
  {
    key: "why-this-path",
    label: "Why this path?",
    description: "Hear what this choice means inside today’s story.",
    reply: intentionKey === "recover"
      ? "Because protecting your energy keeps the whole expedition alive. This path matters."
      : intentionKey === "finish"
        ? "Because one closed loop gives your attention back to you. We’re reclaiming that ground."
        : "Because a larger quest changes through small coordinates. This is today’s coordinate.",
    behaviorId: "ambient_glance",
  },
];

const STAGE_SIGNATURE_BEHAVIORS = new Set<CompanionBehaviorId>([
  "egg_wobble",
  "hatchling_hop",
  "initiate_pounce",
  "awakened_flare",
  "guardian_guard",
  "champion_victory",
  "mythic_levitate",
  "ascended_phase",
]);

const ChoiceList = ({
  choices,
  disabled,
  onChoose,
}: {
  choices: DailyAdventureChoice[];
  disabled: boolean;
  onChoose: (choice: DailyAdventureChoice) => void;
}) => (
  <div className="mt-3 grid gap-2" role="group" aria-label="Choose your response">
    {choices.map((choice, index) => (
      <motion.button
        key={choice.key}
        type="button"
        disabled={disabled}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.045, duration: 0.2 }}
        className="group min-h-[4.25rem] rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 py-3 text-left transition hover:border-cyan-200/40 hover:bg-cyan-300/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:cursor-wait disabled:opacity-50"
        onClick={() => onChoose(choice)}
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold leading-snug text-foreground">{choice.label}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{choice.description}</span>
          </span>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100/55 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </motion.button>
    ))}
  </div>
);

export function DailyAdventurePanel({
  companionName,
  currentStage,
  onReaction,
}: DailyAdventurePanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const missionDate = getEffectiveMissionDate();
  const selectedDate = useMemo(() => getMissionDateValue(missionDate), [missionDate]);
  const [clock, setClock] = useState(() => new Date());
  const completionAttemptedRef = useRef<string | null>(null);
  const completionAwardAttemptedRef = useRef<string | null>(null);
  const reflectionAwardAttemptedRef = useRef<string | null>(null);
  const {
    tasks,
    isLoading: tasksLoading,
    addTask,
    moveTaskToDateAsync,
  } = useDailyTasks(selectedDate);
  const {
    events,
    connectedProviderCount,
  } = useExternalCalendarEvents(selectedDate);
  const { awardCompanionAttribute } = useCompanionAttributes();
  const {
    thread,
    previousThread,
    isLoading,
    error,
    retry,
    saveThread,
    isSaving,
    markCompleted,
    updateAdventure,
    isUpdatingAdventure,
    resolveAdventure,
    isResolvingAdventure,
  } = useDailyMissionThread(missionDate);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const story = useMemo(
    () => getDailyAdventureStory({ missionDate, companionName, currentStage }),
    [companionName, currentStage, missionDate],
  );
  const morningChoices = useMemo(
    () => buildMorningAdventureChoices({ missionDate, currentStage }),
    [currentStage, missionDate],
  );
  const storedState = useMemo(
    () => parseDailyAdventureState(thread?.adventure_state),
    [thread?.adventure_state],
  );
  const adventureState = useMemo<DailyAdventureState | null>(() => {
    if (storedState) return storedState;
    if (!thread) return null;
    const matchingChoice = morningChoices.find((choice) => choice.intention === thread.intention_key)
      ?? morningChoices[0];
    return createDailyAdventureState({
      story,
      choice: matchingChoice,
      chosenAt: thread.created_at,
    });
  }, [morningChoices, storedState, story, thread]);
  const primaryTask = useMemo(
    () => thread?.primary_task_id
      ? tasks.find((task) => task.id === thread.primary_task_id) ?? null
      : null,
    [tasks, thread?.primary_task_id],
  );
  const completedTaskCount = useMemo(
    () => tasks.filter((task) => task.completed && task.id !== thread?.primary_task_id).length,
    [tasks, thread?.primary_task_id],
  );
  const phase = deriveDailyAdventurePhase({
    status: thread?.status,
    state: adventureState,
    hour: clock.getHours() < 2 ? clock.getHours() + 24 : clock.getHours(),
    primaryTaskCompleted: Boolean(primaryTask?.completed),
    completedTaskCount,
  });

  useEffect(() => {
    if (
      !thread
      || thread.status !== "active"
      || !primaryTask?.completed
      || completionAttemptedRef.current === thread.id
    ) return;
    completionAttemptedRef.current = thread.id;
    void markCompleted().catch(() => {
      completionAttemptedRef.current = null;
    });
  }, [markCompleted, primaryTask?.completed, thread]);

  useEffect(() => {
    if (!thread?.completed_at || !["completed", "reflected"].includes(thread.status)) return;
    if (completionAwardAttemptedRef.current === thread.id) return;
    const award = thread.intention_key === "recover"
      ? { attribute: "vitality" as const, sourceEvent: "recovery_block_kept" as const, amount: 6 }
      : thread.intention_key === "finish"
        ? { attribute: "resolve" as const, sourceEvent: "hard_task_complete" as const, amount: 5 }
        : { attribute: "alignment" as const, sourceEvent: "epic_progress_complete" as const, amount: 5 };
    completionAwardAttemptedRef.current = thread.id;
    void awardCompanionAttribute({
      ...award,
      sourceKey: `daily_chapter_completion:${thread.id}`,
      applyEchoGains: true,
    }).catch(() => {
      completionAwardAttemptedRef.current = null;
    });
  }, [awardCompanionAttribute, thread]);

  useEffect(() => {
    if (!thread || thread.status !== "reflected" || reflectionAwardAttemptedRef.current === thread.id) return;
    reflectionAwardAttemptedRef.current = thread.id;
    void awardCompanionAttribute({
      attribute: "wisdom",
      sourceEvent: "daily_chapter_reflection",
      sourceKey: `daily_chapter_reflection:${thread.id}`,
      amount: 6,
      applyEchoGains: false,
    }).catch(() => {
      reflectionAwardAttemptedRef.current = null;
    });
  }, [awardCompanionAttribute, thread]);

  const react = useCallback((choice: DailyAdventureChoice, reactionPhase: string, eventType?: CompanionMotionEventType) => {
    onReaction({
      promptKey: `daily-adventure:${missionDate}:${reactionPhase}`,
      answerKey: choice.key,
      behaviorId: STAGE_SIGNATURE_BEHAVIORS.has(choice.behaviorId)
        ? getCompanionStageSignatureBehavior(currentStage)
        : choice.behaviorId,
      message: choice.reply,
      eventType,
    });
  }, [currentStage, missionDate, onReaction]);

  const handleMorningChoice = useCallback(async (choice: DailyAdventureChoice) => {
    if (!choice.intention) return;
    try {
      let recommendation = buildDailyMissionRecommendation({
        intention: choice.intention,
        tasks,
        calendarEvents: events.filter((event) => event.taskDate === missionDate),
        currentTimeMinutes: getCurrentTimeMinutes(missionDate),
      });

      if (!recommendation.primaryTaskId) {
        const createdTask = await addTask({
          taskText: recommendation.primaryTaskTitle,
          difficulty: "easy",
          source: "manual",
          taskDate: missionDate,
          estimatedDuration: recommendation.primaryTaskDurationMinutes,
        });
        recommendation = {
          ...recommendation,
          primaryTaskId: createdTask.id,
        };
      }

      const nextState = createDailyAdventureState({ story, choice });
      await saveThread({
        recommendation,
        adventureState: nextState,
        calendarEvidence: {
          connectedCalendarCount: connectedProviderCount,
          externalEventCount: events.filter((event) => event.taskDate === missionDate).length,
          availableMinutes: recommendation.availableMinutes,
        },
      });
      react(choice, "opening", "play");
    } catch (choiceError) {
      toast.error(choiceError instanceof Error ? choiceError.message : "Today’s adventure could not begin.");
    }
  }, [addTask, connectedProviderCount, events, missionDate, react, saveThread, story, tasks]);

  const handleCrossroadsChoice = useCallback(async (choice: DailyAdventureChoice) => {
    if (!thread || !adventureState) return;
    const nextState = addAdventureDecision({ state: adventureState, phase: "crossroads", choice });
    const missionUpdate = getCrossroadsTaskUpdate({
      choiceKey: choice.key,
      recommendation: {
        primaryTaskId: thread.primary_task_id,
        primaryTaskTitle: thread.primary_task_title,
        primaryTaskDurationMinutes: thread.primary_task_duration_minutes ?? 15,
        optionalTaskIds: thread.optional_task_ids,
        optionalTaskTitles: thread.optional_task_titles,
      },
      tasks,
    });
    try {
      await updateAdventure({ adventureState: nextState, missionUpdate });
      react(choice, "crossroads", choice.key === "regroup-together" ? "comfort" : "play");
    } catch (choiceError) {
      toast.error(choiceError instanceof Error ? choiceError.message : "The route could not be changed.");
    }
  }, [adventureState, react, tasks, thread, updateAdventure]);

  const handleReturnChoice = useCallback(async (choice: DailyAdventureChoice) => {
    if (!adventureState || !choice.reflectionKey) return;
    const nextState = addAdventureDecision({
      state: adventureState,
      phase: "evening",
      choice,
      outcome: "quest_completed",
    });
    try {
      await resolveAdventure({
        adventureState: nextState,
        reflection: { key: choice.reflectionKey, label: choice.label },
      });
      react(choice, "return", "quest_complete");
    } catch (choiceError) {
      toast.error(choiceError instanceof Error ? choiceError.message : "The chapter could not be saved.");
    }
  }, [adventureState, react, resolveAdventure]);

  const handleEveningChoice = useCallback(async (choice: DailyAdventureChoice) => {
    if (!adventureState) return;
    const outcome = choice.key === "carry-forward"
      ? "carried_forward"
      : choice.key === "release-the-day"
        ? "released"
        : null;
    const nextState = addAdventureDecision({ state: adventureState, phase: "evening", choice, outcome });
    try {
      if (!choice.closesChapter) {
        await updateAdventure({ adventureState: nextState });
        react(choice, "evening", "play");
        return;
      }

      if (choice.key === "carry-forward" && thread?.primary_task_id) {
        await moveTaskToDateAsync({
          taskId: thread.primary_task_id,
          targetDate: format(addDays(selectedDate, 1), "yyyy-MM-dd"),
        });
      }
      await resolveAdventure({
        adventureState: nextState,
        reflection: {
          key: choice.reflectionKey ?? "enough_today",
          label: choice.key === "carry-forward" ? "Carried the quest forward" : "Let today end honestly",
        },
      });
      react(choice, "evening", choice.key === "release-the-day" ? "comfort" : "play");
    } catch (choiceError) {
      toast.error(choiceError instanceof Error ? choiceError.message : "The ending could not be saved.");
    }
  }, [adventureState, moveTaskToDateAsync, react, resolveAdventure, selectedDate, thread?.primary_task_id, updateAdventure]);

  const isBusy = isSaving || isUpdatingAdventure || isResolvingAdventure;
  const primaryTitle = thread?.primary_task_title?.trim() || "Take one meaningful step";
  const phaseLabel = phase === "opening"
    ? "Morning Crossroads"
    : phase === "crossroads"
      ? "The Path Shifts"
      : phase === "evening"
        ? "Evening Return"
        : phase === "return"
          ? "Mission Complete"
          : phase === "resolved"
            ? "Chapter Remembered"
            : "Adventure Underway";

  if (isLoading || tasksLoading) {
    return (
      <section className="relative z-10 mt-4 flex min-h-28 w-full items-center justify-center rounded-3xl border border-cyan-200/10 bg-black/15" aria-label="Loading Daily Adventure">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-100" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="relative z-10 mt-4 w-full rounded-3xl border border-amber-200/20 bg-amber-300/[0.06] p-4 text-left">
        <p className="text-sm font-semibold">Your Daily Adventure is waiting off-map.</p>
        <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => void retry()}>Try again</Button>
      </section>
    );
  }

  const choices = phase === "opening"
    ? morningChoices
    : phase === "crossroads"
      ? buildCrossroadsChoices({
        primaryTitle,
        optionalTaskTitles: thread?.optional_task_titles ?? [],
        hour: clock.getHours() < 2 ? clock.getHours() + 24 : clock.getHours(),
      })
      : phase === "evening"
        ? buildEveningChoices({ primaryTitle })
        : phase === "return"
          ? buildReturnChoices({ primaryTitle })
          : phase === "underway"
            ? getInteractionChoices(companionName, primaryTitle, thread?.intention_key ?? "progress")
            : [];
  const handleChoice = phase === "opening"
    ? handleMorningChoice
    : phase === "crossroads"
      ? handleCrossroadsChoice
      : phase === "evening"
        ? handleEveningChoice
        : phase === "return"
          ? handleReturnChoice
          : (choice: DailyAdventureChoice) => react(choice, "underway", choice.key === "stay-close" ? "comfort" : "play");

  return (
    <motion.section
      layout
      className={cn(
        "relative z-10 mt-4 w-full overflow-hidden rounded-3xl border p-4 text-left shadow-[0_20px_60px_rgba(6,182,212,0.08)] backdrop-blur-xl sm:p-5",
        phase === "resolved"
          ? "border-emerald-200/20 bg-gradient-to-br from-emerald-300/[0.09] via-black/20 to-cyan-300/[0.06]"
          : "border-cyan-200/18 bg-gradient-to-br from-cyan-300/[0.09] via-black/20 to-violet-300/[0.09]",
      )}
      aria-labelledby="daily-adventure-title"
    >
      <div className="absolute -right-12 -top-14 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/80">
            {phase === "resolved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
            Daily Adventure · {phaseLabel}
          </p>
          <h3 id="daily-adventure-title" className="mt-1.5 text-base font-semibold leading-snug text-foreground">
            {adventureState?.chapterTitle ?? story.chapterTitle}
          </h3>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cyan-100/15 bg-cyan-200/[0.08] text-cyan-100">
          {phase === "resolved" ? <Sparkles className="h-4 w-4" /> : <Orbit className="h-4 w-4" />}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.22 }}
        >
          {phase === "opening" ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-foreground/85">{story.openingScene}</p>
              {previousThread ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Last chapter: {previousThread.reflection_label || previousThread.intention_label}. Nothing to make up for—this is a new route.
                </p>
              ) : null}
              <ChoiceList choices={choices} disabled={isBusy} onChoose={handleChoice} />
            </>
          ) : phase === "resolved" ? (
            <div className="mt-3">
              <p className="text-sm leading-relaxed text-foreground/85">
                {adventureState?.eveningChoice?.reply || "Today’s route is now part of your story together."}
              </p>
              <div className="mt-3 rounded-2xl border border-emerald-100/15 bg-black/15 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Remembered choice</p>
                <p className="mt-1 text-sm font-medium text-foreground">{thread?.reflection_label}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/70">
                  {phase === "return" ? "Completed quest" : "Current quest"}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{primaryTitle}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {thread?.primary_task_duration_minutes ?? 15} minute route
                  {thread?.suggested_window_label ? ` · ${thread.suggested_window_label}` : ""}
                </p>
              </div>
              {phase === "underway" && adventureState?.crossroadsChoice ? (
                <p className="mt-2 text-[11px] leading-relaxed text-violet-100/75">
                  Your choice changed the route: {adventureState.crossroadsChoice.label}.
                </p>
              ) : null}
              <ChoiceList choices={choices} disabled={isBusy} onChoose={handleChoice} />
              {phase !== "return" ? (
                <Button asChild variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs text-cyan-100/75">
                  <a href="/journeys">
                    Open quest in Agenda
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}
