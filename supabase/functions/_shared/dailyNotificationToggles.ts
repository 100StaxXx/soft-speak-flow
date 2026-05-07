import type { NotificationType } from "./notificationsV2.ts";

export interface DailyNotificationToggleProfile {
  daily_push_enabled?: boolean | null;
  daily_quote_push_enabled?: boolean | null;
}

export type DailyNotificationDisabledReason =
  | "daily_push_disabled"
  | "daily_quote_disabled";

export function isDailyNotificationType(type: NotificationType): boolean {
  return type === "daily_pep" || type === "daily_quote";
}

export function getDisabledDailyNotificationReason(
  type: NotificationType,
  profile: DailyNotificationToggleProfile | null | undefined,
): DailyNotificationDisabledReason | null {
  if (type === "daily_pep") {
    return profile?.daily_push_enabled === true ? null : "daily_push_disabled";
  }

  if (type === "daily_quote") {
    return profile?.daily_quote_push_enabled === true
      ? null
      : "daily_quote_disabled";
  }

  return null;
}
