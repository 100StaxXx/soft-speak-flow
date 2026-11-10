/** Date-only schedule evaluation shared by the planner and reminder worker. Monday is zero. */
interface Schedule {
  frequency?: string | null; custom_days?: number[] | null; custom_month_days?: number[] | null;
  customPeriod?: "week" | "month" | null; ritual_settings?: unknown;
}
interface Settings { paused?: boolean; history?: Array<Schedule & { from: string; paused?: boolean }>; exceptions?: Record<string, { kind?: string; to?: string }> }
export function ritualScheduledOnDate(schedule: Schedule, key: string, weekday?: number): boolean {
  const settings = (schedule.ritual_settings ?? {}) as Settings;
  const history = Array.isArray(settings.history) ? settings.history : [];
  const historical = history.filter(item => item && typeof item.from === "string" && item.from <= key).sort((a, b) => b.from.localeCompare(a.from))[0];
  if (historical ? historical.paused : settings.paused) return false;
  const exception = settings.exceptions?.[key];
  if (exception?.kind === "skip" || exception?.kind === "move") return false;
  if (Object.values(settings.exceptions ?? {}).some(item => item?.kind === "move" && item.to === key)) return true;
  const active = historical ?? schedule;
  const [year, month, day] = key.split("-").map(Number);
  const dow = weekday ?? (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  const days = Array.isArray(active.custom_days) ? active.custom_days : [];
  const rawMonthDays = Array.isArray(active.custom_month_days) ? active.custom_month_days : [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthDays = rawMonthDays.map(value => Math.min(last, Math.max(1, value)));
  switch (active.frequency?.toLowerCase()) {
    case "daily": return true;
    case "weekly": return (days[0] ?? 0) === dow;
    case "weekdays": case "5x_week": return dow >= 0 && dow <= 4;
    case "weekends": return dow === 5 || dow === 6;
    case "3x_week": return (days.length ? days : [0, 2, 4]).includes(dow);
    case "monthly": return (monthDays.length ? monthDays : [1]).includes(day);
    case "custom": return active.customPeriod === "month" || (active.customPeriod !== "week" && monthDays.length > 0)
      ? (monthDays.length ? monthDays : [1]).includes(day) : days.includes(dow);
    default: return true;
  }
}
