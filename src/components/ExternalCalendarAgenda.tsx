import { format, isValid, parseISO } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlannerContextCalendarEvent } from "@/types/companionPlanner";

interface ExternalCalendarAgendaProps {
  events: PlannerContextCalendarEvent[];
  className?: string;
}

const providerLabel = (provider: string) => (
  provider === "google" ? "Google" : provider === "outlook" ? "Outlook" : provider
);

const formatEventTime = (event: PlannerContextCalendarEvent) => {
  if (event.isAllDay) return "All day";

  const start = parseISO(event.start);
  const end = parseISO(event.end);
  if (!isValid(start) || !isValid(end)) return "Scheduled";
  return `${format(start, "h:mm a")}–${format(end, "h:mm a")}`;
};

export function ExternalCalendarAgenda({ events, className }: ExternalCalendarAgendaProps) {
  if (events.length === 0) return null;

  return (
    <section
      className={cn(
        "mb-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[0_16px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl",
        className,
      )}
      aria-label="Connected calendar events"
      data-testid="external-calendar-agenda"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Connected calendars</h2>
            <p className="text-[11px] text-muted-foreground">Read-only events kept current automatically</p>
          </div>
        </div>
        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[10px] text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => {
          const start = parseISO(event.start);
          const dateLabel = isValid(start) ? format(start, "EEE, MMM d") : "Upcoming";

          return (
            <article
              key={event.id}
              className="min-w-0 rounded-[18px] border border-white/[0.08] bg-black/10 px-3 py-2.5"
              data-testid={`external-calendar-event-${event.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    <span>{dateLabel} · {formatEventTime(event)}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  {providerLabel(event.provider)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
