import { describe, expect, it } from "vitest";
import { computeDayTick, generateRequestPlan, generateRitualPlan } from "./companionLifeEngine";

describe("companionLifeEngine", () => {
  it("produces deterministic day tick output for identical input", () => {
    const input = {
      careScore: 0.42,
      careConsistency: 0.58,
      routineStabilityScore: 54,
      requestFatigue: 3,
      isDormant: false,
    };

    const first = computeDayTick(input);
    const second = computeDayTick(input);

    expect(first).toEqual(second);
    expect(first.routineStabilityScore).toBeGreaterThanOrEqual(0);
    expect(first.routineStabilityScore).toBeLessThanOrEqual(100);
  });

  it("keeps request cadence within max and escalates urgency under low care", () => {
    const requests = generateRequestPlan({
      dateSeed: "2026-02-13:user-1",
      careScore: 0.2,
      requestFatigue: 4,
      openRequests: 1,
      maxRequests: 3,
    });

    expect(requests.length).toBeLessThanOrEqual(2);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.some((urgency) => urgency === "critical" || urgency === "important")).toBe(true);
  });

  it("builds a stable ritual plan count from care score", () => {
    const highCarePlan = generateRitualPlan({ dateSeed: "2026-02-13:user-1", careScore: 0.8, careConsistency: 0.8 });
    const lowCarePlan = generateRitualPlan({ dateSeed: "2026-02-13:user-1", careScore: 0.25, careConsistency: 0.15 });

    expect(highCarePlan.length).toBe(3);
    expect(lowCarePlan.length).toBe(5);
  });

  it("increases fatigue and lowers stability under sustained neglect pressure", () => {
    const result = computeDayTick({
      careScore: 0.2,
      careConsistency: 0.25,
      routineStabilityScore: 60,
      requestFatigue: 6,
      isDormant: false,
    });

    expect(result.routineStabilityScore).toBeLessThan(60);
    expect(result.requestFatigue).toBeGreaterThanOrEqual(6);
    expect(["fragile_echo", "repair_sequence"]).toContain(result.emotionalArc);
  });

  it("respects slot capacity and produces no request plan when slots are unavailable", () => {
    const noSlots = generateRequestPlan({
      dateSeed: "2026-02-13:user-1",
      careScore: 0.3,
      careConsistency: 0.4,
      requestFatigue: 5,
      openRequests: 3,
      maxRequests: 3,
    });

    expect(noSlots).toEqual([]);

    const constrainedSlots = generateRequestPlan({
      dateSeed: "2026-02-13:user-1",
      careScore: 0.3,
      careConsistency: 0.4,
      requestFatigue: 5,
      openRequests: 2,
      maxRequests: 3,
    });

    expect(constrainedSlots.length).toBe(1);
  });
});
