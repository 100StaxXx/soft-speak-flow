import { useMemo } from "react";
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek, subWeeks } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarTask } from "@/types/quest";

interface DesktopWeekStripProps {
  selectedDate: Date;
  tasks?: CalendarTask[];
  onDateSelect: (date: Date) => void;
  onOpenMonthView: () => void;
}

interface DayStats {
  total: number;
  completed: number;
  scheduled: number;
}

export function DesktopWeekStrip({
  selectedDate,
  tasks = [],
  onDateSelect,
  onOpenMonthView,
}: DesktopWeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const dayStats = useMemo(() => {
    const stats = new Map<string, DayStats>();
    weekDays.forEach((day) => {
      stats.set(format(day, "yyyy-MM-dd"), { total: 0, completed: 0, scheduled: 0 });
    });

    tasks.forEach((task) => {
      const dateKey = task.task_date;
      const existing = stats.get(dateKey);
      if (!existing) return;
      existing.total += 1;
      if (task.completed) existing.completed += 1;
      if (task.scheduled_time) existing.scheduled += 1;
    });

    return stats;
  }, [tasks, weekDays]);

  const weekCompleted = tasks.filter((task) => task.completed).length;
  const weekTotal = tasks.length;

  return (
    <section className="hidden xl:block">
      <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,21,39,0.94),rgba(14,12,24,0.88))] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
              Week View
            </p>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {format(weekStart, "MMMM yyyy")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")} · {weekCompleted}/{weekTotal} completed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => onDateSelect(subWeeks(selectedDate, 1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => onDateSelect(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => onDateSelect(addWeeks(selectedDate, 1))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10"
              onClick={onOpenMonthView}
            >
              <CalendarDays className="h-4 w-4" />
              Month
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const stats = dayStats.get(dateKey) ?? { total: 0, completed: 0, scheduled: 0 };
            const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const selected = isSameDay(day, selectedDate);
            const today = isToday(day);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onDateSelect(day)}
                className={cn(
                  "rounded-[24px] border px-4 py-4 text-left transition-all duration-200",
                  "bg-white/[0.03] hover:bg-white/[0.06]",
                  selected
                    ? "border-primary/60 bg-primary/14 shadow-[0_18px_34px_rgba(122,61,255,0.18)]"
                    : "border-white/8",
                  today && !selected && "border-celestial-blue/30 bg-celestial-blue/[0.08]",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.18em]",
                        selected
                          ? "text-primary-foreground/78"
                          : today
                          ? "text-celestial-blue"
                          : "text-muted-foreground/80",
                      )}
                    >
                      {format(day, "EEE")}
                    </p>
                    <p className="mt-1 text-3xl font-semibold leading-none text-foreground">
                      {format(day, "d")}
                    </p>
                  </div>
                  {today ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        selected ? "bg-white/14 text-white" : "bg-celestial-blue/15 text-celestial-blue",
                      )}
                    >
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{stats.total === 0 ? "Open day" : `${stats.completed}/${stats.total} done`}</span>
                    <span>{stats.scheduled} timed</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/6">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-200",
                        selected ? "bg-white/90" : today ? "bg-celestial-blue" : "bg-primary/85",
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
