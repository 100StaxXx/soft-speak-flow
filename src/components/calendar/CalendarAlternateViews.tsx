import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { ExternalEventDetails } from "./ExternalEventDetails";
import type { CalendarView } from "./CalendarToolbar";
import type { CalendarTask } from "@/types/quest";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
import { buildTaskTimelineFlow } from "@/utils/taskTimelineFlow";
import { cn } from "@/lib/utils";

export type CalendarDisplayTask = CalendarTask & { externalEvent?: ExternalCalendarEvent };
const HOUR_HEIGHT = 72;
const timeLabel = (minute: number) => format(new Date(2000, 0, 1, 0, minute), "h:mm a");

export function CalendarAlternateViews({ view, selectedDate, tasks, externalEvents, onDateSelect, onOpenDay, onTaskClick, onAdd, centerNowRequestKey }: {
  view: Exclude<CalendarView, "day">; selectedDate: Date; tasks: CalendarDisplayTask[];
  externalEvents: ExternalCalendarEvent[]; onDateSelect: (date: Date) => void;
  onOpenDay: (date: Date) => void; onTaskClick: (task: CalendarTask) => void;
  onAdd: (date: Date, time: string) => void;
  centerNowRequestKey?: number;
}) {
  const [event, setEvent] = useState<ExternalCalendarEvent | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const days = useMemo(() => Array.from({ length: view === "three-day" ? 3 : 7 }, (_, i) => addDays(selectedDate, i)), [selectedDate, view]);
  const grouped = useMemo(() => days.map(date => {
    const items = tasks.filter(task => task.task_date === format(date, "yyyy-MM-dd"))
      .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));
    const timed = items.filter(task => task.scheduled_time && task.estimated_duration !== 1440);
    return { date, items, timed, untimed: items.filter(task => !task.scheduled_time || task.estimated_duration === 1440), flow: buildTaskTimelineFlow(timed) };
  }), [days, tasks]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const pane = scrollRef.current;
    if (!pane) return;
    const current = new Date();
    const containsToday = Array.from({ length: 3 }, (_, i) => addDays(new Date(`${dateKey}T12:00:00`), i)).some(day => isSameDay(day, current));
    pane.scrollTop = view === "three-day" ? Math.max(0, ((containsToday ? current.getHours() + current.getMinutes() / 60 : 9) - 1) * HOUR_HEIGHT) : 0;
  }, [dateKey, view, centerNowRequestKey]);
  const openTask = (task: CalendarDisplayTask) => task.externalEvent ? setEvent(task.externalEvent) : onTaskClick(task);
  const taskButton = (task: CalendarDisplayTask) => <button key={task.id} onClick={() => openTask(task)}
    className={cn("min-h-11 w-full rounded-md border-l-2 border-primary bg-primary/15 px-2 py-2 text-left text-xs", task.completed && "opacity-60")}
    aria-label={`Open ${task.task_text}`}>
    <span className={cn("block break-words font-medium", task.completed && "line-through")}>{task.task_text}</span>
    {task.externalEvent && <span className="block text-[10px] text-foreground/65">{task.externalEvent.calendarName}</span>}
  </button>;
  return <div className="flex h-full min-h-0 flex-col" data-testid={`calendar-${view}-view`}>
    {view === "month" ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-950/35 p-2">
      <CalendarMonthView compact selectedDate={selectedDate} onDateSelect={onOpenDay} onMonthChange={onDateSelect} tasks={tasks} onTaskClick={openTask} onDateLongPress={date => onAdd(date, "09:00")} />
    </div> : view === "agenda" ? <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-950/35 px-3">
      {grouped.map(({ date, items }) => <section key={format(date, "yyyy-MM-dd")} className="border-b border-white/10 py-3">
        <button onClick={() => onOpenDay(date)} className="mb-2 min-h-11 text-sm font-medium">{format(date, "EEE, MMM d")}</button>
        {items.length ? <div className="space-y-2">{items.map(task => <div key={task.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2">
          <span className="pt-3 text-[11px] text-foreground/70">{task.scheduled_time ? timeLabel(Number(task.scheduled_time.slice(0, 2)) * 60 + Number(task.scheduled_time.slice(3, 5))) : task.externalEvent?.isAllDay ? "All day" : "Untimed"}</span>
          {taskButton(task)}
        </div>)}</div> : <span className="block pb-2 text-xs text-foreground/50">—</span>}
      </section>)}
    </div> : <>
      <div className="grid shrink-0 grid-cols-[48px_repeat(3,minmax(0,1fr))] border-b border-white/10 bg-slate-950/40">
        <span />{days.map(day => <button key={format(day, "yyyy-MM-dd")} className="min-h-11 text-xs font-medium" onClick={() => onOpenDay(day)}>{format(day, "EEE d")}</button>)}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-950/45" data-testid="three-day-scroll">
        {grouped.some(day => day.untimed.length > 0) && <div className="grid grid-cols-[48px_repeat(3,minmax(0,1fr))] border-b border-white/10">
          <span className="px-1 py-3 text-[10px] text-foreground/60">All day / untimed</span>
          {grouped.map(day => <div key={format(day.date, "yyyy-MM-dd")} className="space-y-1 border-l border-white/10 p-1">{day.untimed.map(taskButton)}</div>)}
        </div>}
        <div className="relative grid grid-cols-[48px_repeat(3,minmax(0,1fr))]" style={{ height: 24 * HOUR_HEIGHT }}>
          <div className="relative">{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-1 text-[10px] text-foreground/70" style={{ top: hour * HOUR_HEIGHT + 3 }}>{format(new Date(2000, 0, 1, hour), "h a")}</span>)}</div>
          {grouped.map(({ date, timed, flow }) => <div key={format(date, "yyyy-MM-dd")} className="relative border-l border-white/15">
            {Array.from({ length: 48 }, (_, slot) => <button key={slot} className={cn("absolute left-0 right-0 border-t border-white/10 hover:bg-white/5", slot % 2 && "border-dashed border-white/5")}
              style={{ top: slot * HOUR_HEIGHT / 2, height: HOUR_HEIGHT / 2 }}
              aria-label={`Add quest ${format(date, "MMM d")} at ${timeLabel(slot * 30)}`} onClick={() => onAdd(date, `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`)} />)}
            {timed.map(task => {
              const position = flow.byTaskId.get(task.id);
              if (!position) return null;
              return <button key={task.id} onClick={() => openTask(task)} aria-label={`Open ${task.task_text}`}
                className={cn("absolute z-10 overflow-hidden rounded border-l-2 border-primary bg-slate-900/95 px-1 py-1 text-left text-[11px]", task.completed && "opacity-60 line-through")}
                data-testid={`three-day-event-${task.id}`}
                style={{ top: position.startMinute * HOUR_HEIGHT / 60, height: Math.min(1440 - position.startMinute, Math.max(22, position.endMinute - position.startMinute)) * HOUR_HEIGHT / 60,
                  left: `${position.laneIndex * 100 / position.laneCount}%`, width: `${100 / position.laneCount}%` }}>
                <span className="block font-medium">{task.task_text}</span><span className="text-[9px] text-foreground/65">{timeLabel(position.startMinute)}</span>
              </button>;
            })}
            {isSameDay(date, now) && <div data-testid="three-day-now" className="pointer-events-none absolute inset-x-0 z-20 border-t border-primary" style={{ top: (now.getHours() * 60 + now.getMinutes()) * HOUR_HEIGHT / 60 }} />}
          </div>)}
        </div>
      </div>
    </>}
    {event && <ExternalEventDetails event={event} events={externalEvents} quests={tasks.filter(task => !task.externalEvent)} onClose={() => setEvent(null)} />}
  </div>;
}
