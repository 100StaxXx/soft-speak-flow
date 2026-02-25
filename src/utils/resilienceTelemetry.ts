import { logger } from "@/utils/logger";

interface TelemetryPayload {
  [key: string]: unknown;
}

export function trackResilienceEvent(eventName: string, payload?: TelemetryPayload): void {
  logger.info(`[ResilienceTelemetry] ${eventName}`, payload ?? {});
}
