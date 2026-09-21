import { useMemo } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { cn } from "@/lib/utils";

const formatScheduledTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
};

export function TodayAgendaCard() {
  const navigate = useNavigate();
  const {
    tasks,
    isLoading,
    toggleTask,
    isToggling,
  } = useDailyTasks(new Date());

  // The generated Faithful Step already has its own focused card above. Keep
  // the agenda preview from repeating the same deliverable.
  const agendaTasks = useMemo(
    () => tasks.filter((task) => task.source !== "faithful_step"),
    [tasks],
  );
  const totalCount = agendaTasks.length;
  const completedCount = agendaTasks.filter((task) => task.completed).length;

  const previewTasks = useMemo(
    () => [...agendaTasks]
      .sort((left, right) => {
        if (left.completed !== right.completed) return left.completed ? 1 : -1;
        if (left.scheduled_time && right.scheduled_time) {
          return left.scheduled_time.localeCompare(right.scheduled_time);
        }
        if (left.scheduled_time) return -1;
        if (right.scheduled_time) return 1;
        return (left.sort_order ?? 0) - (right.sort_order ?? 0);
      })
      .slice(0, 3),
    [agendaTasks],
  );

  const openAgenda = () => navigate("/journeys");

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/[0.88] shadow-sm backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-border/65 p-4">
        <div className="rounded-2xl bg-primary/[0.12] p-3 text-primary">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your day</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading today’s plan…"
              : totalCount > 0
                ? `${completedCount} of ${totalCount} actions complete`
                : "A simple place for what already needs your attention."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={openAgenda}
          aria-label="Open full agenda"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4" aria-label="Loading today’s agenda">
          {[0, 1].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : previewTasks.length > 0 ? (
        <div className="divide-y divide-border/55 px-2">
          {previewTasks.map((task) => {
            const displayTime = formatScheduledTime(task.scheduled_time);
            return (
              <div key={task.id} className="flex min-h-[58px] items-center gap-2 px-2 py-2">
                <button
                  type="button"
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition",
                    task.completed
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/35 bg-background/65 text-transparent hover:border-primary",
                  )}
                  disabled={task.completed || isToggling}
                  aria-label={task.completed ? `${task.task_text} complete` : `Complete ${task.task_text}`}
                  onClick={() => toggleTask({
                    taskId: task.id,
                    completed: true,
                    xpReward: task.xp_reward,
                  })}
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left hover:bg-muted/55"
                  onClick={() => navigate(`/journeys?taskId=${encodeURIComponent(task.id)}`)}
                >
                  <span className={cn("block truncate text-sm font-medium", task.completed && "text-muted-foreground line-through")}>
                    {task.task_text}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {displayTime ? <><Clock3 className="h-3.5 w-3.5" />{displayTime}</> : "Anytime today"}
                    <span aria-hidden="true">·</span>
                    <span>+{task.xp_reward} XP</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 text-center">
          <ListChecks className="mx-auto h-7 w-7 text-primary" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your prepared practice is enough for today. Any calendar plans will appear here automatically.
          </p>
        </div>
      )}

      <div className="border-t border-border/65 p-3">
        <Button type="button" variant="ghost" className="h-11 w-full justify-between rounded-xl" onClick={openAgenda}>
          <span>Open full agenda</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
