import { addDays, addMonths, format, isSameDay, startOfWeek } from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CalendarView = "agenda" | "day" | "three-day" | "month";
export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: "agenda", label: "Agenda" }, { value: "day", label: "Day" },
  { value: "three-day", label: "3-Day" }, { value: "month", label: "Month" },
];

export function CalendarToolbar({ selectedDate, view, onViewChange, onDateSelect, onToday, onAdd, onManageCalendars, onRefresh, onInfo, onVoiceAdd, isSyncing, syncError, tasksPerDay = {} }: {
  selectedDate: Date; view: CalendarView; onViewChange: (view: CalendarView) => void;
  onDateSelect: (date: Date) => void; onToday: () => void; onAdd: () => void;
  onManageCalendars: () => void; onRefresh: () => void; onInfo: () => void;
  onVoiceAdd?: () => void; isSyncing?: boolean; syncError?: string | null;
  tasksPerDay?: Record<string, number>;
}) {
  const weekStart = startOfWeek(selectedDate);
  const move = (direction: number) => onDateSelect(view === "month"
    ? addMonths(selectedDate, direction)
    : addDays(selectedDate, direction * (view === "three-day" ? 3 : 7)));
  const iconButton = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return <header className="shrink-0 border-b border-white/10 bg-slate-950/25 px-2 pb-1 backdrop-blur-md" data-testid="calendar-toolbar">
    <div className="flex items-center gap-1">
      <button className="min-w-0 flex-1 py-3 text-left" onClick={() => onViewChange("month")} aria-label={`Open ${format(selectedDate, "MMMM yyyy")} calendar`}>
        <h1 className="truncate text-2xl font-semibold tracking-tight">{format(selectedDate, "MMMM")}</h1>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm hover:bg-white/10" aria-label="Calendar view">
          <CalendarDays className="h-4 w-4" /><span>{CALENDAR_VIEWS.find(option => option.value === view)?.label}</span><ChevronDown className="h-3 w-3" />
        </button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={view} onValueChange={value => onViewChange(value as CalendarView)}>
            {CALENDAR_VIEWS.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button className={iconButton} onClick={onAdd} aria-label="Add quest" data-tour="add-quest-launcher"><Plus className="h-5 w-5" /></button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className={iconButton} aria-label="Calendar options"><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onToday}>Go to today</DropdownMenuItem>
          <DropdownMenuItem onSelect={onManageCalendars}>Calendar settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={onRefresh} disabled={isSyncing}>{isSyncing ? "Syncing calendars…" : syncError ? "Retry calendar sync" : "Refresh calendars"}</DropdownMenuItem>
          {onVoiceAdd && <DropdownMenuItem onSelect={onVoiceAdd}>Add with voice</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onInfo}>Calendar help</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="flex items-center justify-between text-xs">
      <button className={iconButton} aria-label={view === "month" ? "Previous month" : view === "three-day" ? "Previous 3 days" : "Previous week"} onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></button>
      <button className="min-h-11 px-3 text-sm text-foreground/80" onClick={onToday}>Today</button>
      <span className="text-foreground/65">{format(selectedDate, "yyyy")}</span>
      <button className={iconButton} aria-label={view === "month" ? "Next month" : view === "three-day" ? "Next 3 days" : "Next week"} onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></button>
    </div>
    {view !== "month" && <div className="grid grid-cols-7" data-testid="journeys-mobile-date-strip">
      {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(day => <button key={format(day, "yyyy-MM-dd")} onClick={() => onDateSelect(day)}
        aria-label={format(day, "EEEE, MMMM d, yyyy")} aria-pressed={isSameDay(day, selectedDate)}
        aria-current={isSameDay(day, new Date()) ? "date" : undefined}
        className="flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="text-[10px] font-medium uppercase text-foreground/70">{format(day, "EEEEE")}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-base", isSameDay(day, selectedDate) ? "bg-primary text-primary-foreground" : "text-foreground")}>{format(day, "d")}</span>
        <span className={cn("h-1 w-1 rounded-full", tasksPerDay[format(day, "yyyy-MM-dd")] ? "bg-primary" : "bg-transparent")} />
      </button>)}
    </div>}
    {syncError && <button onClick={onRefresh} disabled={isSyncing} className="min-h-11 w-full text-left text-xs text-foreground/80" role="status">Calendar sync needs attention · {isSyncing ? "Retrying…" : "Tap to retry"}</button>}
  </header>;
}
