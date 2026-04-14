import { logger } from "@/utils/logger";

type PaywallEventName =
  | "paywall_viewed"
  | "offer_code_applied"
  | "offer_code_failed"
  | "package_selected"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_cancelled"
  | "purchase_failed"
  | "restore_started"
  | "restore_completed"
  | "restore_failed";

type PaywallTelemetryPayload = Record<string, unknown>;

export function trackPaywallEvent(
  eventName: PaywallEventName,
  payload: PaywallTelemetryPayload,
): void {
  if (typeof logger.scope === "function") {
    logger.scope("PaywallTelemetry").info(eventName, payload);
    return;
  }
  logger.info?.(`[PaywallTelemetry] ${eventName}`, payload);
}
