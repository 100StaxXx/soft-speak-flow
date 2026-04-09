import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek, subWeeks } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Mic,
  Plus,
  Target,
  Trophy,
} from "lucide-react";

import { ProgressRing } from "@/features/tasks/components/ProgressRing";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { MAIN_QUEST_XP_MULTIPLIER } from "@/config/xpRewards";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DesktopQuestDetailsPopover,
  useDesktopQuestCardClickHandlers,
} from "@/components/DesktopQuestDetailsPopover";
import { getEpicDaysRemaining } from "@/utils/epicDates";

interface ActiveEpic {
  id: string;
  title: string;
  description?: string | null;
  progress_percentage?: number | null;
  target_days: number;
  start_date: string;
  end_date: string | null;
  epic_habits?: Array<{
    habit_id: string;
    habits: {
      id: string;
      title: string;
      difficulty: string;
      description?: string | null;
      frequency?: string;
      estimated_minutes?: number | null;
      custom_days?: number[] | null;
    };
  }>;
}

interface DesktopWeekPlannerProps {
  selectedDate: Date;
  tasks: DailyTask[];
  currentStreak?: number;
  activeEpics?: ActiveEpic[];
  isCampaignsLoading?: boolean;
  hideAnytimeRow?: boolean;
  plannerMode?: "week" | "day";
  desktopInteractionResetKey?: string | number;
  onDateSelect: (date: Date) => void;
  onPlannerModeChange?: (mode: "week" | "day") => void;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onAddQuest: () => void;
  onVoiceAddQuest?: () => void;
  onOpenMonthView?: () => void;
  onUndoToggle?: (taskId: string, xpReward: number) => void;
  onEditQuest?: (task: DailyTask) => void;
  onDeleteQuest?: (task: DailyTask) => void;
  onMoveQuestToNextDay?: (task: DailyTask) => void;
  onSendToCalendar?: (taskId: string) => void;
  hasCalendarLink?: (taskId: string) => boolean;
}

interface DayStats {
  total: number;
  completed: number;
  timed: number;
}

interface DayBuckets {
  anytime: DailyTask[];
  timedByHour: Map<number, DailyTask[]>;
}

interface WeekPlannerTaskCardProps {
  task: DailyTask;
  compact?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onUndoToggle?: (taskId: string, xpReward: number) => void;
  onEditQuest?: (task: DailyTask) => void;
  onDeleteQuest?: (task: DailyTask) => void;
  onMoveQuestToNextDay?: (task: DailyTask) => void;
  onSendToCalendar?: (taskId: string) => void;
  hasCalendarLink?: (taskId: string) => boolean;
}

const DEFAULT_TIMELINE_START_HOUR = 6;
const DEFAULT_TIMELINE_END_HOUR = 21;
const JOURNEYS_QUEST_CARD_SHELL_CLASS_NAME =
  "journeys-quest-card-shell overflow-hidden border bg-white/[0.04] shadow-[0_12px_22px_rgba(0,0,0,0.14)] transition-colors";
const JOURNEYS_QUEST_CARD_SHELL_ACTIVE_CLASS_NAME = "journeys-quest-card-shell--active";

const formatHourLabel = (hour: number) => format(new Date(2000, 0, 1, hour, 0), "h a");

const parseHour = (time: string | null | undefined) => {
  if (!time) return null;
  const [hours] = time.split(":");
  const parsed = Number.parseInt(hours, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMinute = (time: string | null | undefined) => {
  if (!time) return null;
  const [hours, minutes] = time.split(":");
  const parsedHours = Number.parseInt(hours, 10);
  const parsedMinutes = Number.parseInt(minutes ?? "0", 10);
  if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) return null;
  return (parsedHours * 60) + parsedMinutes;
};

const getEffectiveTaskXP = (task: Pick<DailyTask, "xp_reward" | "is_main_quest">) => (
  task.is_main_quest
    ? Math.round(task.xp_reward * MAIN_QUEST_XP_MULTIPLIER)
    : task.xp_reward
);

const sortWeekTasks = (left: DailyTask, right: DailyTask) => {
  const leftHasTime = !!left.scheduled_time;
  const rightHasTime = !!right.scheduled_time;

  if (leftHasTime && rightHasTime && left.scheduled_time !== right.scheduled_time) {
    return left.scheduled_time!.localeCompare(right.scheduled_time!);
  }

  if (leftHasTime !== rightHasTime) {
    return leftHasTime ? -1 : 1;
  }

  const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return (right.created_at ?? "").localeCompare(left.created_at ?? "");
};

function WeekPlannerTaskCard({
  task,
  compact = false,
  isOpen,
  onOpenChange,
  onToggle,
  onUndoToggle,
  onEditQuest,
  onDeleteQuest,
  onMoveQuestToNextDay,
  onSendToCalendar,
  hasCalendarLink,
}: WeekPlannerTaskCardProps) {
  const effectiveTaskXP = getEffectiveTaskXP(task);
  const isComplete = !!task.completed;
  const { handleClick, handleDoubleClick } = useDesktopQuestCardClickHandlers(task, {
    onSingleClick: (clickedTask) => onOpenChange(clickedTask.id === task.id),
    onDoubleClick: onEditQuest
      ? (clickedTask) => {
          onOpenChange(false);
          onEditQuest(clickedTask);
        }
      : undefined,
  });

  return (
    <div
      data-testid={`desktop-week-task-${task.id}`}
      data-quest-card-shell="true"
      className={cn(
        JOURNEYS_QUEST_CARD_SHELL_CLASS_NAME,
        "rounded-[18px] border-white/10 p-2",
        compact && "rounded-[16px]",
        isOpen && JOURNEYS_QUEST_CARD_SHELL_ACTIVE_CLASS_NAME,
        isOpen && "border-primary/40 bg-primary/[0.08]",
        isComplete && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (isComplete && onUndoToggle) {
              onUndoToggle(task.id, effectiveTaskXP);
              return;
            }
            onToggle(task.id, !isComplete, effectiveTaskXP);
          }}
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            isComplete
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/25 text-transparent hover:border-primary/70",
          )}
          aria-label={isComplete ? "Mark task as incomplete" : "Mark task as complete"}
        >
          <Check className="h-3 w-3" />
        </button>

        <DesktopQuestDetailsPopover
          task={task}
          open={isOpen}
          onOpenChange={onOpenChange}
          hasCalendarLink={hasCalendarLink?.(task.id)}
          onEdit={onEditQuest}
          onDelete={onDeleteQuest}
          onMoveQuestToNextDay={!task.habit_source_id ? onMoveQuestToNextDay : undefined}
          onSendToCalendar={onSendToCalendar}
          anchor={(
            <button
              type="button"
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              data-testid={`desktop-week-task-button-${task.id}`}
              className={cn(
                "min-w-0 flex-1 rounded-[14px] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                compact && "px-1.5 py-1",
              )}
            >
              <p
                className={cn(
                  compact ? "text-xs" : "text-sm",
                  "truncate font-medium text-foreground",
                  isComplete && "text-muted-foreground line-through",
                )}
              >
                {task.task_text}
              </p>
            </button>
          )}
        />
      </div>
    </div>
  );
}

export function DesktopWeekPlanner({
  selectedDate,
  tasks,
  currentStreak = 0,
  activeEpics = [],
  isCampaignsLoading = false,
  hideAnytimeRow = false,
  plannerMode = "week",
  desktopInteractionResetKey,
  onDateSelect,
  onPlannerModeChange,
  onToggle,
  onAddQuest,
  onVoiceAddQuest,
  onOpenMonthView,
  onUndoToggle,
  onEditQuest,
  onDeleteQuest,
  onMoveQuestToNextDay,
  onSendToCalendar,
  hasCalendarLink,
}: DesktopWeekPlannerProps) {
  const [openDetailsTaskId, setOpenDetailsTaskId] = useState<string | null>(null);
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  useEffect(() => {
    setOpenDetailsTaskId(null);
  }, [desktopInteractionResetKey]);

  useEffect(() => {
    if (openDetailsTaskId && !tasks.some((task) => task.id === openDetailsTaskId)) {
      setOpenDetailsTaskId(null);
    }
  }, [openDetailsTaskId, tasks]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, DailyTask[]>();

    weekDays.forEach((day) => {
      grouped.set(format(day, "yyyy-MM-dd"), []);
    });

    tasks.forEach((task) => {
      if (!task.task_date || !grouped.has(task.task_date)) return;
      grouped.get(task.task_date)?.push(task);
    });

    grouped.forEach((dayTasks, key) => {
      grouped.set(key, dayTasks.slice().sort(sortWeekTasks));
    });

    return grouped;
  }, [tasks, weekDays]);

  const dayStatsByDate = useMemo(() => {
    const stats = new Map<string, DayStats>();
    tasksByDate.forEach((dayTasks, dateKey) => {
      stats.set(dateKey, {
        total: dayTasks.length,
        completed: dayTasks.filter((task) => !!task.completed).length,
        timed: dayTasks.filter((task) => !!task.scheduled_time).length,
      });
    });
    return stats;
  }, [tasksByDate]);

  const dayBucketsByDate = useMemo(() => {
    const buckets = new Map<string, DayBuckets>();

    weekDays.forEach((day) => {
      buckets.set(format(day, "yyyy-MM-dd"), {
        anytime: [],
        timedByHour: new Map<number, DailyTask[]>(),
      });
    });

    tasksByDate.forEach((dayTasks, dateKey) => {
      const anytime: DailyTask[] = [];
      const timedByHour = new Map<number, DailyTask[]>();

      dayTasks.forEach((task) => {
        const hour = parseHour(task.scheduled_time);
        if (hour === null) {
          anytime.push(task);
          return;
        }

        const existing = timedByHour.get(hour) ?? [];
        existing.push(task);
        timedByHour.set(hour, existing);
      });

      timedByHour.forEach((hourTasks, hour) => {
        timedByHour.set(hour, hourTasks.slice().sort(sortWeekTasks));
      });

      buckets.set(dateKey, {
        anytime,
        timedByHour,
      });
    });

    return buckets;
  }, [tasksByDate, weekDays]);

  const timelineHours = useMemo(() => {
    const scheduledMinutes = tasks
      .map((task) => parseMinute(task.scheduled_time))
      .filter((value): value is number => value !== null);

    if (scheduledMinutes.length === 0) {
      return Array.from(
        { length: DEFAULT_TIMELINE_END_HOUR - DEFAULT_TIMELINE_START_HOUR + 1 },
        (_, index) => DEFAULT_TIMELINE_START_HOUR + index,
      );
    }

    const earliestHour = Math.floor(Math.min(...scheduledMinutes) / 60);
    const latestHour = tasks.reduce((latest, task) => {
      const startMinute = parseMinute(task.scheduled_time);
      if (startMinute === null) return latest;
      const endMinute = startMinute + Math.max(task.estimated_duration ?? 30, 30) - 1;
      return Math.max(latest, Math.floor(endMinute / 60));
    }, DEFAULT_TIMELINE_END_HOUR);

    const startHour = Math.max(0, Math.min(DEFAULT_TIMELINE_START_HOUR, earliestHour));
    const endHour = Math.min(23, Math.max(DEFAULT_TIMELINE_END_HOUR, latestHour));

    return Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  }, [tasks]);

  const ritualTasks = useMemo(
    () => tasks.filter((task) => !!task.habit_source_id),
    [tasks],
  );
  const standaloneRitualCount = ritualTasks.filter((task) => !task.epic_id).length;

  const weekCompletedCount = tasks.filter((task) => !!task.completed).length;
  const weekTotalCount = tasks.length;
  const weekScheduledCount = tasks.filter((task) => !!task.scheduled_time).length;
  const weekActiveDays = new Set(tasks.map((task) => task.task_date).filter(Boolean)).size;
  const weekXP = tasks.reduce((sum, task) => {
    if (!task.completed) return sum;
    return sum + getEffectiveTaskXP(task);
  }, 0);
  const progressPercent = weekTotalCount > 0 ? (weekCompletedCount / weekTotalCount) * 100 : 0;

  const epicProgress = useMemo(() => {
    const ritualCountsByEpic = new Map<string, { total: number; completed: number }>();

    ritualTasks.forEach((task) => {
      if (!task.epic_id) return;
      const current = ritualCountsByEpic.get(task.epic_id) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (task.completed) {
        current.completed += 1;
      }
      ritualCountsByEpic.set(task.epic_id, current);
    });

    return activeEpics.map((epic) => {
      const ritualCounts = ritualCountsByEpic.get(epic.id) ?? { total: 0, completed: 0 };
      return {
        epic,
        ritualCounts,
        daysRemaining: getEpicDaysRemaining(epic),
      };
    });
  }, [activeEpics, ritualTasks]);

  const desktopRailCardClass =
    "journeys-desktop-rail-card rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,20,38,0.94),rgba(16,13,27,0.9))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)]";

  const renderTaskCard = useCallback((task: DailyTask, compact = false) => (
    <WeekPlannerTaskCard
      key={task.id}
      task={task}
      compact={compact}
      isOpen={openDetailsTaskId === task.id}
      onOpenChange={(open) => {
        setOpenDetailsTaskId(open ? task.id : null);
      }}
      onToggle={onToggle}
      onUndoToggle={onUndoToggle}
      onEditQuest={onEditQuest}
      onDeleteQuest={onDeleteQuest}
      onMoveQuestToNextDay={onMoveQuestToNextDay}
      onSendToCalendar={onSendToCalendar}
      hasCalendarLink={hasCalendarLink}
    />
  ), [
    hasCalendarLink,
    onDeleteQuest,
    onEditQuest,
    onMoveQuestToNextDay,
    onSendToCalendar,
    onToggle,
    onUndoToggle,
    openDetailsTaskId,
  ]);

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-5"
      data-testid="desktop-week-planner"
    >
      <div className="journeys-desktop-shell flex min-h-0 flex-col rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,21,39,0.95),rgba(13,11,23,0.92))] px-4 py-4 shadow-[0_28px_54px_rgba(0,0,0,0.24)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
              Week Planner
            </p>
            <h2 className="mt-2 text-[1.65rem] font-semibold tracking-tight text-foreground">
              {format(weekStart, "MMMM d")} - {format(addDays(weekStart, 6), "MMMM d")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cleaner desktop week planning with click-to-inspect quests.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {onPlannerModeChange ? (
              <div
                className="flex items-center gap-1 rounded-[18px] border border-white/10 bg-white/5 p-1"
                role="group"
                aria-label="Desktop planner mode"
              >
                <Button
                  type="button"
                  variant={plannerMode === "week" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 rounded-[14px] px-3 text-xs",
                    plannerMode === "week"
                      ? "bg-white/12 text-white hover:bg-white/15"
                      : "text-muted-foreground hover:bg-white/8 hover:text-foreground",
                  )}
                  aria-pressed={plannerMode === "week"}
                  onClick={() => onPlannerModeChange("week")}
                >
                  Week
                </Button>
                <Button
                  type="button"
                  variant={plannerMode === "day" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 rounded-[14px] px-3 text-xs",
                    plannerMode === "day"
                      ? "bg-white/12 text-white hover:bg-white/15"
                      : "text-muted-foreground hover:bg-white/8 hover:text-foreground",
                  )}
                  aria-pressed={plannerMode === "day"}
                  onClick={() => onPlannerModeChange("day")}
                >
                  Day
                </Button>
              </div>
            ) : null}

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-[18px] border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => onDateSelect(subWeeks(selectedDate, 1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-[18px] border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
              onClick={() => onDateSelect(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-[18px] border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => onDateSelect(addWeeks(selectedDate, 1))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {onOpenMonthView ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-[18px] border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
                onClick={onOpenMonthView}
              >
                <CalendarDays className="h-4 w-4" />
                Month
              </Button>
            ) : null}
            <div className="flex items-center gap-2">
              {onVoiceAddQuest ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Add quest with voice"
                  className="h-9 w-9 rounded-[18px] border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                  onClick={onVoiceAddQuest}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                size="sm"
                data-tour="add-quest-launcher"
                className="h-9 rounded-[18px] px-4 shadow-[0_14px_28px_rgba(122,61,255,0.2)]"
                onClick={onAddQuest}
              >
                <Plus className="h-4 w-4" />
                Add Quest
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-black/10">
          <div className="overflow-auto" style={{ maxHeight: "min(72vh, 820px)" }}>
            <div className="grid min-w-[1120px] grid-cols-[72px_repeat(7,minmax(150px,1fr))]">
              <div className="sticky left-0 top-0 z-40 border-b border-r border-white/8 bg-[rgba(19,16,29,0.98)] px-3 py-4 backdrop-blur-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
                  Schedule
                </p>
              </div>

              {weekDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayStats = dayStatsByDate.get(dateKey) ?? { total: 0, completed: 0, timed: 0 };
                const isSelected = isSameDay(day, selectedDate);
                const dayIsToday = isToday(day);

                return (
                  <div
                    key={dateKey}
                    data-testid={`desktop-week-day-${dateKey}`}
                    className={cn(
                      "sticky top-0 z-30 border-b border-r border-white/8 px-3 py-3 backdrop-blur-xl",
                      isSelected
                        ? "bg-primary/[0.12]"
                        : dayIsToday
                        ? "bg-celestial-blue/[0.1]"
                        : "bg-[rgba(24,21,38,0.98)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onDateSelect(day)}
                      className="w-full rounded-2xl text-left transition-opacity hover:opacity-90"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={cn(
                              "text-[11px] font-semibold uppercase tracking-[0.18em]",
                              isSelected
                                ? "text-primary-foreground/78"
                                : dayIsToday
                                ? "text-celestial-blue"
                                : "text-muted-foreground/75",
                            )}
                          >
                            {format(day, "EEE")}
                          </p>
                          <h3 className="mt-1 text-2xl font-semibold leading-none text-foreground">
                            {format(day, "d")}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">{format(day, "MMMM d")}</p>
                        </div>
                        {dayIsToday ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                              isSelected ? "bg-white/14 text-white" : "bg-celestial-blue/15 text-celestial-blue",
                            )}
                          >
                            Today
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{dayStats.total === 0 ? "Open day" : `${dayStats.completed}/${dayStats.total} done`}</span>
                        <span>{dayStats.timed} timed</span>
                      </div>
                    </button>
                  </div>
                );
              })}

              {hideAnytimeRow ? null : (
                <>
                  <div className="sticky left-0 z-20 border-b border-r border-white/8 bg-[rgba(19,16,29,0.98)] px-3 py-3 backdrop-blur-xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                      Anytime
                    </p>
                  </div>

                  {weekDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const buckets = dayBucketsByDate.get(dateKey) ?? { anytime: [], timedByHour: new Map<number, DailyTask[]>() };
                    const isSelected = isSameDay(day, selectedDate);
                    const dayIsToday = isToday(day);

                    return (
                      <div
                        key={`${dateKey}-anytime`}
                        data-testid={`desktop-week-anytime-${dateKey}`}
                        className={cn(
                          "min-h-[92px] border-b border-r border-white/8 p-2 align-top",
                          isSelected
                            ? "bg-primary/[0.05]"
                            : dayIsToday
                            ? "bg-celestial-blue/[0.04]"
                            : "bg-white/[0.01]",
                        )}
                      >
                        {buckets.anytime.length > 0 ? (
                          <div className="space-y-2">
                            {buckets.anytime.map((task) => renderTaskCard(task, true))}
                          </div>
                        ) : (
                          <div className="flex min-h-[72px] items-center justify-center rounded-[18px] border border-dashed border-white/8 bg-white/[0.02] px-3 text-center text-[11px] text-muted-foreground">
                            No anytime quests
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {timelineHours.map((hour) => (
                <div key={hour} className="contents">
                  <div
                    className="sticky left-0 z-10 border-b border-r border-white/8 bg-[rgba(19,16,29,0.98)] px-3 py-3 text-right text-[11px] font-semibold text-muted-foreground/75 backdrop-blur-xl"
                    data-testid={`desktop-week-hour-${hour}`}
                  >
                    {formatHourLabel(hour)}
                  </div>

                  {weekDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const buckets = dayBucketsByDate.get(dateKey) ?? { anytime: [], timedByHour: new Map<number, DailyTask[]>() };
                    const hourTasks = buckets.timedByHour.get(hour) ?? [];
                    const isSelected = isSameDay(day, selectedDate);
                    const dayIsToday = isToday(day);

                    return (
                      <div
                        key={`${dateKey}-${hour}`}
                        className={cn(
                          "min-h-[84px] border-b border-r border-white/8 p-2 align-top",
                          isSelected
                            ? "bg-primary/[0.04]"
                            : dayIsToday
                            ? "bg-celestial-blue/[0.03]"
                            : "bg-transparent",
                        )}
                      >
                        {hourTasks.length > 0 ? (
                          <div className="space-y-2">
                            {hourTasks.map((task) => renderTaskCard(task))}
                          </div>
                        ) : (
                          <div className="min-h-[68px] rounded-[16px] border border-dashed border-transparent" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <section className={desktopRailCardClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
                This Week
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {weekCompletedCount}/{weekTotalCount || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                quests completed across {weekActiveDays || 0} active day{weekActiveDays === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="flex items-center gap-3">
                <ProgressRing percent={progressPercent} size={40} strokeWidth={3.5} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">
                    XP banked
                  </p>
                  <p className="text-sm font-semibold text-stardust-gold">{weekXP}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Active</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{weekActiveDays}</p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Timed</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{weekScheduledCount}</p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Streak</p>
              <p className="mt-2 flex items-center gap-1 text-xl font-semibold text-foreground">
                <Flame className="h-4 w-4 text-stardust-gold/80" />
                {currentStreak}
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-primary/85"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Week mode keeps every day visible with a fixed hour gutter so planning feels closer to desktop calendar tools.
          </p>
        </section>

        <section className={desktopRailCardClass}>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Target className="h-3 w-3" />
            Campaigns & rituals
          </div>

          {epicProgress.length > 0 ? (
            <div className="mt-4 space-y-3">
              {epicProgress.map(({ epic, ritualCounts, daysRemaining }) => (
                <div
                  key={epic.id}
                  className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{epic.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ritualCounts.completed}/{ritualCounts.total} rituals completed this week
                      </p>
                    </div>
                    <Badge variant="outline" className="h-5 border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px]">
                      {Math.round(epic.progress_percentage ?? 0)}%
                    </Badge>
                  </div>
                  {daysRemaining !== null ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : isCampaignsLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading weekly campaigns...
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No campaigns are attached to this week yet.
            </p>
          )}

          <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">
                  Rituals this week
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">{ritualTasks.length}</p>
              </div>
              <Trophy className="h-5 w-5 text-stardust-gold/75" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {standaloneRitualCount} standalone ritual{standaloneRitualCount === 1 ? "" : "s"} surfaced outside campaigns.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
