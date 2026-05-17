import { describe, expect, it } from "vitest";

import {
  classifyAdaptiveComingUpLoad,
  type AdaptiveLoadBlock,
} from "@/shared/adaptiveComingUpLoad";

const block = (overrides: Partial<AdaptiveLoadBlock>): AdaptiveLoadBlock => ({
  id: crypto.randomUUID(),
  title: "Quest",
  source: "task",
  startMinutes: 9 * 60,
  durationMinutes: 60,
  ...overrides,
});

describe("classifyAdaptiveComingUpLoad", () => {
  it("uses heavier thresholds for power users", () => {
    const result = classifyAdaptiveComingUpLoad({
      workloadTolerance: "heavy",
      blocks: [
        block({ startMinutes: 9 * 60, durationMinutes: 180 }),
        block({ startMinutes: 13 * 60, durationMinutes: 180 }),
      ],
    });

    expect(result.scheduledMinutes).toBe(360);
    expect(result.label).toBe("productive");
  });

  it("uses lighter thresholds for easily overwhelmed users", () => {
    const result = classifyAdaptiveComingUpLoad({
      workloadTolerance: "light",
      blocks: [
        block({ startMinutes: 9 * 60, durationMinutes: 120 }),
        block({ startMinutes: 13 * 60, durationMinutes: 150 }),
      ],
    });

    expect(result.scheduledMinutes).toBe(270);
    expect(result.label).toBe("busy");
  });

  it("keeps a spacious five-hour four-block day productive by default", () => {
    const result = classifyAdaptiveComingUpLoad({
      workloadTolerance: "normal",
      blocks: [
        block({ startMinutes: 6 * 60, durationMinutes: 30 }),
        block({ startMinutes: 10 * 60, durationMinutes: 120 }),
        block({ startMinutes: 14 * 60, durationMinutes: 90 }),
        block({ startMinutes: 19 * 60, durationMinutes: 60 }),
      ],
    });

    expect(result.scheduledMinutes).toBe(300);
    expect(result.gapMinutes).toBeGreaterThan(180);
    expect(result.label).toBe("productive");
  });

  it("upgrades lower-hour compressed context switching to busy", () => {
    const result = classifyAdaptiveComingUpLoad({
      workloadTolerance: "heavy",
      blocks: [
        block({
          startMinutes: 9 * 60,
          durationMinutes: 30,
          energyType: "deep",
          category: "work",
        }),
        block({
          startMinutes: 9 * 60 + 30,
          durationMinutes: 30,
          energyType: "social",
          category: "calls",
        }),
        block({
          startMinutes: 10 * 60,
          durationMinutes: 30,
          energyType: "errand",
          category: "life",
        }),
        block({
          startMinutes: 10 * 60 + 30,
          durationMinutes: 30,
          energyType: "creative",
          category: "content",
        }),
      ],
    });

    expect(result.scheduledMinutes).toBe(120);
    expect(result.contextSwitches).toBe(3);
    expect(result.label).toBe("busy");
  });

  it("lets strong momentum and routine spacious work avoid overwhelming", () => {
    const result = classifyAdaptiveComingUpLoad({
      workloadTolerance: "normal",
      momentumState: "locked_in",
      recentMissInterpretation: "normal_variance",
      blocks: [
        block({
          startMinutes: 8 * 60,
          durationMinutes: 180,
          energyType: "admin",
          flexibility: "flexible",
        }),
        block({
          startMinutes: 13 * 60,
          durationMinutes: 180,
          energyType: "errand",
          flexibility: "flexible",
        }),
        block({
          startMinutes: 19 * 60,
          durationMinutes: 150,
          energyType: "recovery",
          flexibility: "flexible",
        }),
      ],
    });

    expect(result.effectiveWorkloadTolerance).toBe("heavy");
    expect(result.scheduledMinutes).toBe(510);
    expect(result.reliefScore).toBeGreaterThanOrEqual(3);
    expect(result.label).toBe("busy");
  });

  it("treats low-energy missed work as strain", () => {
    const result = classifyAdaptiveComingUpLoad({
      workloadTolerance: "normal",
      momentumState: "slipping",
      recentMissInterpretation: "low_energy",
      missedCount: 2,
      blocks: [
        block({ startMinutes: 9 * 60, durationMinutes: 150, priority: "high" }),
        block({ startMinutes: 13 * 60, durationMinutes: 120, priority: "high" }),
      ],
    });

    expect(result.effectiveWorkloadTolerance).toBe("light");
    expect(result.pressureScore).toBeGreaterThanOrEqual(1);
    expect(result.label).toBe("overwhelming");
  });
});
