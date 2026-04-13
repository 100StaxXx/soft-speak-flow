import { logger } from "@/utils/logger";

type PaywallSurface = "trial_gate" | "premium";

type PaywallEventName =
  | "paywall_viewed"
  | "referral_apply_started"
  | "referral_apply_succeeded"
  | "referral_apply_failed"
  | "continue_to_subscription"
  | "package_selected"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_cancelled"
  | "purchase_failed"
  | "restore_started"
  | "restore_completed"
  | "restore_failed";

type PaywallTelemetryPayload = Record<string, unknown> & {
  surface: PaywallSurface;
};

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
