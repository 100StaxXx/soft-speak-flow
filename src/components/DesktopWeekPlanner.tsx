import { useMemo } from "react";
import { addDays, format, isSameDay, isToday, startOfWeek } from "date-fns";
import {
  CalendarArrowUp,
  CalendarPlus,
  Check,
  Clock,
  Flame,
  Pencil,
  Plus,
  Repeat,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";

import { ProgressRing } from "@/features/tasks/components/ProgressRing";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { MAIN_QUEST_XP_MULTIPLIER } from "@/config/xpRewards";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  showInlineAddButton?: boolean;
  onDateSelect: (date: Date) => void;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onAddQuest: () => void;
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

const formatTime = (time: string | null | undefined) => {
  if (!time) return "Anytime";
  const [hours, minutes] = time.split(":");
  const hour = Number.parseInt(hours, 10);
  if (!Number.isFinite(hour)) return time;
  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${meridiem}`;
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

export function DesktopWeekPlanner({
  selectedDate,
  tasks,
  currentStreak = 0,
  activeEpics = [],
  isCampaignsLoading = false,
  showInlineAddButton = true,
  onDateSelect,
  onToggle,
  onAddQuest,
  onUndoToggle,
  onEditQuest,
  onDeleteQuest,
  onMoveQuestToNextDay,
  onSendToCalendar,
  hasCalendarLink,
}: DesktopWeekPlannerProps) {
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

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
    "journeys-desktop-rail-card rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,20,38,0.94),rgba(16,13,27,0.9))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)]";

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6"
      data-testid="desktop-week-planner"
    >
      <div className="journeys-desktop-shell flex min-h-0 flex-col rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,21,39,0.95),rgba(13,11,23,0.92))] px-5 py-5 shadow-[0_28px_54px_rgba(0,0,0,0.24)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
              Week Planner
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {format(weekStart, "MMMM d")} - {format(addDays(weekStart, 6), "MMMM d")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the full week visible while still jumping into any selected day.
            </p>
          </div>

          {showInlineAddButton ? (
            <Button onClick={onAddQuest} className="rounded-2xl px-4">
              <Plus className="h-4 w-4" />
              Add Quest
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDate.get(dateKey) ?? [];
              const dayStats = dayStatsByDate.get(dateKey) ?? { total: 0, completed: 0, timed: 0 };
              const dayPercent = dayStats.total > 0 ? (dayStats.completed / dayStats.total) * 100 : 0;
              const isSelected = isSameDay(day, selectedDate);
              const dayIsToday = isToday(day);

              return (
                <section
                  key={dateKey}
                  className={cn(
                    "flex min-h-[520px] flex-col rounded-[28px] border bg-white/[0.03] p-4 transition-colors",
                    isSelected
                      ? "border-primary/60 bg-primary/[0.08] shadow-[0_18px_34px_rgba(122,61,255,0.16)]"
                      : "border-white/8",
                    dayIsToday && !isSelected && "border-celestial-blue/30 bg-celestial-blue/[0.06]",
                  )}
                  data-testid={`desktop-week-day-${dateKey}`}
                >
                  <button
                    type="button"
                    onClick={() => onDateSelect(day)}
                    className="rounded-2xl text-left transition-opacity hover:opacity-90"
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
                        <h3 className="mt-1 text-3xl font-semibold leading-none text-foreground">
                          {format(day, "d")}
                        </h3>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {format(day, "MMMM d")}
                        </p>
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
                  </button>

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{dayStats.total === 0 ? "Open day" : `${dayStats.completed}/${dayStats.total} done`}</span>
                    <span>{dayStats.timed} timed</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-200",
                        isSelected ? "bg-white/90" : dayIsToday ? "bg-celestial-blue" : "bg-primary/85",
                      )}
                      style={{ width: `${dayPercent}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-1 flex-col gap-3">
                    {dayTasks.length > 0 ? (
                      dayTasks.map((task) => {
                        const effectiveTaskXP = getEffectiveTaskXP(task);
                        const isComplete = !!task.completed;
                        const isRitual = !!task.habit_source_id;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "rounded-[22px] border border-white/8 bg-black/10 p-3",
                              isComplete && "opacity-65",
                            )}
                            data-testid={`desktop-week-task-${task.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isComplete && onUndoToggle) {
                                    onUndoToggle(task.id, effectiveTaskXP);
                                    return;
                                  }
                                  onToggle(task.id, !isComplete, effectiveTaskXP);
                                }}
                                className={cn(
                                  "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                  isComplete
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-white/25 text-transparent hover:border-primary/70",
                                )}
                                aria-label={isComplete ? "Mark task as incomplete" : "Mark task as complete"}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "line-clamp-2 text-sm font-medium text-foreground",
                                    isComplete && "text-muted-foreground line-through",
                                  )}
                                >
                                  {task.task_text}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(task.scheduled_time)}
                                  </span>
                                  {isRitual ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Repeat className="h-3 w-3" />
                                      Ritual
                                    </span>
                                  ) : null}
                                  {task.is_main_quest ? (
                                    <Badge variant="outline" className="h-5 border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px]">
                                      Main
                                    </Badge>
                                  ) : null}
                                  <span className="font-semibold text-stardust-gold/85">+{effectiveTaskXP} XP</span>
                                </div>

                                {!isComplete && (onEditQuest || onSendToCalendar || onMoveQuestToNextDay || onDeleteQuest) ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    {onEditQuest ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 rounded-xl px-2"
                                        onClick={() => onEditQuest(task)}
                                        aria-label={`Edit ${task.task_text}`}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                    {onSendToCalendar ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 rounded-xl px-2"
                                        onClick={() => onSendToCalendar(task.id)}
                                        aria-label={
                                          hasCalendarLink?.(task.id)
                                            ? `Re-send ${task.task_text} to calendar`
                                            : `Send ${task.task_text} to calendar`
                                        }
                                      >
                                        <CalendarPlus className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                    {onMoveQuestToNextDay && !isRitual ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 rounded-xl px-2"
                                        onClick={() => onMoveQuestToNextDay(task)}
                                        aria-label={`Move ${task.task_text} to tomorrow`}
                                      >
                                        <CalendarArrowUp className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                    {onDeleteQuest ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 rounded-xl px-2 text-destructive hover:text-destructive"
                                        onClick={() => onDeleteQuest(task)}
                                        aria-label={`Delete ${task.task_text}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center"
                        data-testid={`desktop-week-empty-${dateKey}`}
                      >
                        <p className="text-sm font-medium text-foreground">Open day</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          No quests scheduled yet for this day.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
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
            Week mode keeps every day visible so you can plan and adjust without losing context.
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
              {standaloneRitualCount > 0
                ? `${standaloneRitualCount} ritual${standaloneRitualCount === 1 ? "" : "s"} are not attached to a campaign.`
                : "All surfaced rituals are currently tied to campaigns."}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
