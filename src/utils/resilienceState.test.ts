import { describe, expect, it } from "vitest";
import { deriveBaseResilienceState, deriveResilienceState } from "@/utils/resilienceState";

describe("deriveResilienceState", () => {
  it("transitions healthy -> offline", () => {
    const state = deriveBaseResilienceState({
      isOnline: false,
      backendHealth: "healthy",
      probeFailures: 0,
      outageThreshold: 3,
      hasIncident: false,
      queueCount: 0,
      degradedByErrors: false,
      degradedDismissed: false,
    });

    expect(state).toBe("offline");
  });

  it("transitions to outage after threshold failures", () => {
    const state = deriveBaseResilienceState({
      isOnline: true,
      backendHealth: "degraded",
      probeFailures: 3,
      outageThreshold: 3,
      hasIncident: true,
      queueCount: 2,
      degradedByErrors: true,
      degradedDismissed: false,
    });

    expect(state).toBe("outage");
  });

  it("transitions outage -> recovering when healthy with queued actions", () => {
    const state = deriveBaseResilienceState({
      isOnline: true,
      backendHealth: "healthy",
      probeFailures: 0,
      outageThreshold: 3,
      hasIncident: true,
      queueCount: 2,
      degradedByErrors: false,
      degradedDismissed: false,
    });

    expect(state).toBe("recovering");
  });

  it("shows recovered during banner window after queue drain", () => {
    const now = 1_000;
    const state = deriveResilienceState({
      isOnline: true,
      backendHealth: "healthy",
      probeFailures: 0,
      outageThreshold: 3,
      hasIncident: false,
      queueCount: 0,
      degradedByErrors: false,
      degradedDismissed: false,
      showRecoveredUntil: now + 5_000,
      now,
    });

    expect(state).toBe("recovered");
  });

  it("returns healthy after recovered window expires", () => {
    const now = 10_000;
    const state = deriveResilienceState({
      isOnline: true,
      backendHealth: "healthy",
      probeFailures: 0,
      outageThreshold: 3,
      hasIncident: false,
      queueCount: 0,
      degradedByErrors: false,
      degradedDismissed: false,
      showRecoveredUntil: now - 1,
      now,
    });

    expect(state).toBe("healthy");
  });
});
