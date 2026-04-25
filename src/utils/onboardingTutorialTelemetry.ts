import { logger } from "@/utils/logger";

type OnboardingTutorialTelemetryPayload = Record<string, unknown>;

export function trackOnboardingTutorialEvent(
  eventName: string,
  payload: OnboardingTutorialTelemetryPayload = {},
): void {
  if (typeof logger.scope === "function") {
    logger.scope("OnboardingTutorialTelemetry").info(eventName, payload);
    return;
  }
  logger.info?.(`[OnboardingTutorialTelemetry] ${eventName}`, payload);
}
