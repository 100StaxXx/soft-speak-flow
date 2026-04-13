export type CheckinReminderKind = "morning" | "evening";

export const EVENING_REFLECTION_NOTIFICATION_URL = "/mentor?open=evening-reflection";

export function getCheckinReminderUrl(kind: CheckinReminderKind): string {
  return kind === "evening" ? EVENING_REFLECTION_NOTIFICATION_URL : "/";
}
