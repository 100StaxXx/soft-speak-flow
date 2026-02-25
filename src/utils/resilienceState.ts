import type { BackendHealthState, ResilienceState } from "@/types/resilience";

export interface BaseResilienceStateInput {
  isOnline: boolean;
  backendHealth: BackendHealthState;
  probeFailures: number;
  outageThreshold: number;
  hasIncident: boolean;
  queueCount: number;
  degradedByErrors: boolean;
  degradedDismissed: boolean;
}

export interface ResilienceStateInput extends BaseResilienceStateInput {
  showRecoveredUntil: number;
  now?: number;
}

export function deriveBaseResilienceState(input: BaseResilienceStateInput): ResilienceState {
  if (!input.isOnline) return "offline";
  if (input.backendHealth === "outage" || input.probeFailures >= input.outageThreshold) return "outage";

  if (input.hasIncident && input.backendHealth === "healthy" && input.queueCount > 0) {
    return "recovering";
  }

  if (!input.degradedDismissed && input.degradedByErrors && input.backendHealth === "healthy") {
    return "degraded";
  }

  return "healthy";
}

export function deriveResilienceState(input: ResilienceStateInput): ResilienceState {
  const baseState = deriveBaseResilienceState(input);
  const now = input.now ?? Date.now();

  if (baseState === "healthy" && input.showRecoveredUntil > now) {
    return "recovered";
  }

  return baseState;
}
