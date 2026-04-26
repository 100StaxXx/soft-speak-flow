import { logger } from "@/utils/logger";

type TelemetryPayload = object;

export function trackResilienceEvent(eventName: string, payload?: TelemetryPayload): void {
  logger.info(`[ResilienceTelemetry] ${eventName}`, payload ?? {});
}
