import {
  getLocalDateTimeParts,
  getNotificationPriority,
  normalizeTimezone,
} from "../_shared/notificationsV2.ts";

export interface DayPlanBlockRecord {
  id: string;
  questId?: string | null;
  title: string;
  startTime: string | null;
  durationMinutes: number;
  source?: string | null;
}

export interface DailyPlanRow {
  id: string;
  user_id: string;
  plan_date: string;
  status: "draft" | "committed";
  blocks: DayPlanBlockRecord[];
  updated_at: string | null;
}

export interface OverdueProfile {
  id: string;
  timezone: string | null;
  task_reminders_enabled: boolean | null;
}

export interface OverdueBlockEvaluation {
  block: DayPlanBlockRecord;
  endMinutes: number;
  startMinutes: number;
}

export interface OverduePushQueueRow {
  user_id: string;
  notification_type: "plan_day_overdue";
  title: string;
  body: string;
  scheduled_for: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
  status: "queued";
  source_table: string;
  source_id: string;
  dedupe_key: string;
  priority: number;
  delivered: boolean;
}

const HHMM_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const parseHHMMToMinutes = (value: string | null | undefined): number | null => {
  if (typeof value !== "string") return null;
  const match = value.match(HHMM_PATTERN);
  if (!match) return null;
  const hh = Number.parseInt(match[1] ?? "0", 10);
  const mm = Number.parseInt(match[2] ?? "0", 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
};

export const findOverdueBlocks = (
  plan: DailyPlanRow,
  completedQuestIds: ReadonlySet<string>,
  nowLocalMinutes: number,
  localDate: string,
): OverdueBlockEvaluation[] => {
  if (plan.status !== "committed") return [];
  if (plan.plan_date !== localDate) return [];

  const overdue: OverdueBlockEvaluation[] = [];
  for (const block of plan.blocks) {
    if (!block.startTime) continue;
    if (!block.questId) continue;
    if (completedQuestIds.has(block.questId)) continue;
    const startMinutes = parseHHMMToMinutes(block.startTime);
    if (startMinutes === null) continue;
    const duration = Number.isFinite(block.durationMinutes)
      ? Math.max(5, Math.round(block.durationMinutes))
      : 30;
    const endMinutes = startMinutes + duration;
    if (nowLocalMinutes < endMinutes) continue;
    overdue.push({ block, startMinutes, endMinutes });
  }
  overdue.sort((left, right) => left.startMinutes - right.startMinutes);
  return overdue;
};

export const formatTimeOfDay = (minutes: number): string => {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const period = hh >= 12 ? "pm" : "am";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm === 0
    ? `${hour12} ${period}`
    : `${hour12}:${String(mm).padStart(2, "0")} ${period}`;
};

export const buildOverduePushQueueRow = (
  plan: DailyPlanRow,
  overdue: OverdueBlockEvaluation,
  remainingCount: number,
  now: Date,
): OverduePushQueueRow => {
  const startLabel = formatTimeOfDay(overdue.startMinutes);
  const remainder = Math.max(0, remainingCount - 1);
  const remainderText = remainder === 0
    ? "Still happening, or want to adjust?"
    : remainder === 1
    ? "One other block is also waiting — want to adjust?"
    : `${remainder} other blocks are also waiting — want to adjust?`;
  return {
    user_id: plan.user_id,
    notification_type: "plan_day_overdue",
    title: "Cosmiq",
    body: `${overdue.block.title} was set for ${startLabel}. ${remainderText}`,
    scheduled_for: now.toISOString(),
    context: {
      plan_id: plan.id,
      block_id: overdue.block.id,
      quest_id: overdue.block.questId ?? null,
      plan_date: plan.plan_date,
      remaining_overdue: remainingCount,
    },
    payload: {
      deepLink: "cosmiq://journeys/plan",
      planId: plan.id,
      blockId: overdue.block.id,
      url: "/journeys",
    },
    status: "queued",
    source_table: "daily_plans",
    source_id: plan.id,
    dedupe_key: `plan_day_overdue:${plan.user_id}:${plan.plan_date}`,
    priority: getNotificationPriority("plan_day_overdue"),
    delivered: false,
  };
};

export interface BuildOverduePushesOptions {
  plans: DailyPlanRow[];
  profiles: Map<string, OverdueProfile>;
  completedQuestIds: ReadonlySet<string>;
  now: Date;
}

export const buildOverduePushes = (
  options: BuildOverduePushesOptions,
): OverduePushQueueRow[] => {
  const rows: OverduePushQueueRow[] = [];
  for (const plan of options.plans) {
    const profile = options.profiles.get(plan.user_id);
    if (!profile) continue;
    if (profile.task_reminders_enabled === false) continue;
    const timezone = normalizeTimezone(profile.timezone);
    const local = getLocalDateTimeParts(options.now, timezone);
    const nowLocalMinutes = local.hour * 60 + local.minute;
    const overdue = findOverdueBlocks(
      plan,
      options.completedQuestIds,
      nowLocalMinutes,
      local.localDate,
    );
    if (overdue.length === 0) continue;
    rows.push(
      buildOverduePushQueueRow(plan, overdue[0], overdue.length, options.now),
    );
  }
  return rows;
};
