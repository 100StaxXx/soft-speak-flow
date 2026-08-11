import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Compass,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { DailyChapterConstellation, type DailyChapterStatus } from "@/components/DailyChapterConstellation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTalkPopupContextSafe } from "@/contexts/TalkPopupContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useDailyMissionThread } from "@/hooks/useDailyMissionThread";
import type { DailyTask } from "@/services/dailyTasksRemote";
import {
  buildDailyMissionRecommendation,
  DAILY_MISSION_INTENTIONS,
  type DailyMissionIntention,
} from "@/shared/dailyMissionThread";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
import { cn } from "@/lib/utils";

interface DailyMissionThreadCardProps {
  missionDate: string;
  tasks: DailyTask[];
  externalEvents: ExternalCalendarEvent[];
  connectedCalendarCount: number;
  onAddQuest: (prefill?: { title: string; durationMinutes: number }) => void;
  onPrimaryTaskIdChange?: (taskId: string | null) => void;
}

const completionMessage = (intentionKey: string, title: string): string => {
  if (intentionKey === "recover") {
    return `You protected what mattered today. “${title}” was enough.`;
  }
  if (intentionKey === "finish") {
    return `You named the open loop and closed it: “${title}.”`;
  }
  return `Today’s move is real now: “${title}.” The larger path changed with it.`;
};

const RETURN_CHOICES = [
  { key: "moved_forward", label: "It moved me forward", reply: "I’ll remember that forward motion mattered today." },
  { key: "cleared_space", label: "It cleared some space", reply: "I’ll remember that closing the loop made room." },
  { key: "enough_today", label: "It was enough for today", reply: "Enough counts. We can leave the rest where it is." },
] as const;

const getPreviousChapterCallback = (
  previousThread: ReturnType<typeof useDailyMissionThread>["previousThread"],
  missionDate: string,
): string | null => {
  if (!previousThread) return null;
  const intention = previousThread.intention_label?.trim().toLowerCase() || "make the day count";
  const reflection = previousThread.reflection_label?.trim();
  const missionDateMs = new Date(`${missionDate}T12:00:00`).getTime();
  const previousDateMs = new Date(`${previousThread.mission_date}T12:00:00`).getTime();
  const isYesterday = Math.round((missionDateMs - previousDateMs) / 86_400_000) === 1;
  const prefix = isYesterday ? "Yesterday" : "Last time";

  return reflection
    ? `${prefix} you chose to ${intention}, and said “${reflection.toLowerCase()}.” Nothing to make up for—what should today become?`
    : `${prefix} you chose to ${intention}. Nothing to make up for—what should today become?`;
};

const getCurrentTimeMinutes = (missionDate: string): number | undefined => {
  const now = new Date();
  if (missionDate !== now.toLocaleDateString("en-CA")) return undefined;
  const current = now.getHours() * 60 + now.getMinutes();
  return Math.min(23 * 60 + 45, Math.ceil(current / 15) * 15);
};

export function DailyMissionThreadCard({
  missionDate,
  tasks,
  externalEvents,
  connectedCalendarCount,
  onAddQuest,
  onPrimaryTaskIdChange,
}: DailyMissionThreadCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const talkPopup = useTalkPopupContextSafe();
  const { awardCompanionAttribute } = useCompanionAttributes();
  const completionAttemptedRef = useRef<string | null>(null);
  const linkAttemptedRef = useRef<string | null>(null);
  const completionAwardAttemptedRef = useRef<string | null>(null);
  const reflectionAwardAttemptedRef = useRef<string | null>(null);
  const {
    thread,
    previousThread,
    isLoading,
    error,
    retry,
    saveThread,
    isSaving,
    markCompleted,
    linkPrimaryTask,
    clearThread,
    isClearing,
    reflectOnMission,
    isReflecting,
  } = useDailyMissionThread(missionDate);
  const previousChapterCallback = useMemo(
    () => getPreviousChapterCallback(previousThread, missionDate),
    [missionDate, previousThread],
  );

  const primaryTask = useMemo(
    () => thread?.primary_task_id
      ? tasks.find((task) => task.id === thread.primary_task_id) ?? null
      : null,
    [tasks, thread?.primary_task_id],
  );
  const newlyCreatedMatchingTask = useMemo(() => {
    if (!thread || thread.primary_task_id) return null;
    const expectedTitle = typeof thread.primary_task_title === "string"
      ? thread.primary_task_title.replace(/\s+/g, " ").trim().toLowerCase()
      : "";
    if (!expectedTitle) return null;
    return tasks.find((task) => (
      typeof task.task_text === "string"
      && task.task_text.replace(/\s+/g, " ").trim().toLowerCase() === expectedTitle
    )) ?? null;
  }, [tasks, thread]);

  useEffect(() => {
    if (
      !thread
      || thread.primary_task_id
      || !newlyCreatedMatchingTask
      || linkAttemptedRef.current === newlyCreatedMatchingTask.id
    ) return;

    linkAttemptedRef.current = newlyCreatedMatchingTask.id;
    void linkPrimaryTask(newlyCreatedMatchingTask.id).catch(() => {
      linkAttemptedRef.current = null;
    });
  }, [linkPrimaryTask, newlyCreatedMatchingTask, thread]);

  useEffect(() => {
    onPrimaryTaskIdChange?.(thread?.status === "active" ? thread.primary_task_id : null);
    return () => onPrimaryTaskIdChange?.(null);
  }, [onPrimaryTaskIdChange, thread?.primary_task_id, thread?.status]);

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
    if (!thread || !["completed", "reflected"].includes(thread.status) || completionAwardAttemptedRef.current === thread.id) {
      return;
    }

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

  const handleChooseIntention = useCallback(async (intention: DailyMissionIntention) => {
    const recommendation = buildDailyMissionRecommendation({
      intention,
      tasks,
      calendarEvents: externalEvents,
      currentTimeMinutes: getCurrentTimeMinutes(missionDate),
    });

    await saveThread({
      recommendation,
      calendarEvidence: {
        connectedCalendarCount,
        externalEventCount: externalEvents.length,
        availableMinutes: recommendation.availableMinutes,
      },
    });
    await talkPopup.show({ message: recommendation.companionAck });
  }, [connectedCalendarCount, externalEvents, missionDate, saveThread, talkPopup, tasks]);

  const handleClear = useCallback(async () => {
    await clearThread();
    completionAttemptedRef.current = null;
    linkAttemptedRef.current = null;
  }, [clearThread]);

  const handleReflection = useCallback(async (choice: typeof RETURN_CHOICES[number]) => {
    await reflectOnMission({ key: choice.key, label: choice.label });
    await talkPopup.show({ message: choice.reply });
  }, [reflectOnMission, talkPopup]);

  if (isLoading) {
    return (
      <Card className="mb-4 flex min-h-32 items-center justify-center border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.07] via-background/80 to-violet-500/[0.08]">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-200" aria-label="Loading today’s Daily Chapter" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-4 border-amber-300/20 bg-amber-500/[0.06] p-4" role="status">
        <p className="text-sm font-medium text-foreground">Daily Chapter is temporarily unavailable.</p>
        <p className="mt-1 text-xs text-muted-foreground">Your quests and calendar still work normally.</p>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void retry()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!thread) {
    return (
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
        aria-labelledby="daily-mission-thread-title"
      >
        <Card className="mb-4 overflow-hidden border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.08] via-background/90 to-violet-500/[0.1] p-4 shadow-[0_18px_55px_rgba(34,211,238,0.08)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                Daily Chapter
              </div>
              <h2 id="daily-mission-thread-title" className="text-lg font-semibold text-foreground">
                What would make today count?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the shape of the day. Your companion will pick one realistic action from your agenda.
              </p>
            </div>
            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>

          {previousChapterCallback ? (
            <p className="mt-4 rounded-2xl border border-violet-200/15 bg-violet-300/[0.05] px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
              {previousChapterCallback}
            </p>
          ) : null}

          <div className="mt-4">
            <DailyChapterConstellation status="unstarted" />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Choose today’s intention">
            {DAILY_MISSION_INTENTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={isSaving}
                className="min-h-20 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-left transition-colors hover:border-cyan-200/35 hover:bg-cyan-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:opacity-55"
                onClick={() => void handleChooseIntention(option.key)}
              >
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {connectedCalendarCount > 0
              ? `Uses your agenda and ${connectedCalendarCount} connected calendar${connectedCalendarCount === 1 ? "" : "s"}. Nothing is moved automatically.`
              : "Uses your Cosmiq agenda. Connect a calendar for availability-aware recommendations."}
          </div>
        </Card>
      </motion.section>
    );
  }

  // Keep the surface usable during rollout if an older cached/mock row is missing
  // one of the fields introduced with Mission Threads.
  const primaryTitle = typeof thread.primary_task_title === "string" && thread.primary_task_title.trim()
    ? thread.primary_task_title
    : "Take one meaningful step";
  const intentionKey = typeof thread.intention_key === "string" ? thread.intention_key : "progress";
  const intentionLabel = typeof thread.intention_label === "string" && thread.intention_label.trim()
    ? thread.intention_label
    : "Make progress";
  const calendarSummary = typeof thread.calendar_summary === "string" && thread.calendar_summary.trim()
    ? thread.calendar_summary
    : "Built from today’s available quests.";
  const companionAck = typeof thread.companion_ack === "string" && thread.companion_ack.trim()
    ? thread.companion_ack
    : "I’ll keep this one in view with you.";
  const isCompleted = thread.status === "completed" || thread.status === "reflected";
  const optionalTitles = Array.isArray(thread.optional_task_titles)
    ? thread.optional_task_titles.filter((title): title is string => typeof title === "string" && Boolean(title.trim())).slice(0, 2)
    : [];

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
      aria-labelledby="daily-mission-thread-title"
    >
      <Card
        className={cn(
          "mb-4 overflow-hidden border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.08] via-background/90 to-violet-500/[0.1] p-4 sm:p-5",
          isCompleted && "border-emerald-300/25 from-emerald-400/[0.08] to-cyan-500/[0.08]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
              {isCompleted
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                : <Compass className="h-3.5 w-3.5" aria-hidden="true" />}
              Daily Chapter
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 tracking-[0.12em] text-muted-foreground">
                {intentionLabel}
              </span>
            </div>
            <h2 id="daily-mission-thread-title" className={cn(
              "text-lg font-semibold leading-snug text-foreground",
              isCompleted && "text-emerald-50",
            )}>
              {primaryTitle}
            </h2>
            <p className="mt-1 text-xs font-medium text-cyan-100/80">
              {thread.primary_task_duration_minutes ?? 15} minute action
              {thread.primary_task_id ? " · linked to your agenda" : " · ready to turn into a quest"}
            </p>
            {thread.suggested_window_label ? (
              <p className="mt-1 text-xs font-semibold text-violet-100/80">
                Suggested window: {thread.suggested_window_label}
              </p>
            ) : null}
          </div>
          {isCompleted ? (
            <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 p-2 text-emerald-200">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <DailyChapterConstellation status={thread.status as DailyChapterStatus} />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {isCompleted
            ? completionMessage(intentionKey, primaryTitle)
            : calendarSummary}
        </p>

        {!isCompleted && optionalTitles.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Optional side quests</p>
            <p className="mt-1 text-xs text-foreground/80">{optionalTitles.join(" · ")}</p>
          </div>
        ) : null}

        <blockquote className="mt-3 border-l-2 border-cyan-200/35 pl-3 text-sm italic text-foreground/85">
          “{isCompleted ? completionMessage(intentionKey, primaryTitle) : companionAck}”
        </blockquote>

        {thread.status === "completed" ? (
          <div className="mt-4 rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.05] p-3">
            <p className="text-sm font-semibold text-foreground">How did that action change the day?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RETURN_CHOICES.map((choice) => (
                <Button
                  key={choice.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isReflecting}
                  className="h-auto min-h-9 whitespace-normal rounded-full border-emerald-200/20 bg-black/10 px-3 py-2 text-left text-xs"
                  onClick={() => void handleReflection(choice)}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          </div>
        ) : thread.status === "reflected" && thread.reflection_label ? (
          <p className="mt-3 text-xs text-emerald-100/80">
            Remembered for tomorrow: {thread.reflection_label}.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!thread.primary_task_id && !isCompleted ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onAddQuest({
                title: primaryTitle,
                durationMinutes: thread.primary_task_duration_minutes ?? 15,
              })}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add this quest
            </Button>
          ) : null}
          {!isCompleted ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isClearing}
              onClick={() => void handleClear()}
            >
              {isClearing
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                : <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              Change chapter
            </Button>
          ) : null}
        </div>
      </Card>
    </motion.section>
  );
}
