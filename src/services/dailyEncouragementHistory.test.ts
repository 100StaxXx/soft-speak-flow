import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import {
  getNextDailyEncouragementMilestone,
  recordDailyEncouragementProgress,
} from "./dailyEncouragementHistory";

describe("daily encouragement history milestones", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("records playback at 25%, 50%, and the 80% heard threshold", () => {
    const recorded = new Set<number>();

    expect(getNextDailyEncouragementMilestone(0.24, recorded)).toBeNull();
    expect(getNextDailyEncouragementMilestone(0.25, recorded)).toBe(0.25);

    recorded.add(0.25);
    expect(getNextDailyEncouragementMilestone(0.79, recorded)).toBe(0.5);

    recorded.add(0.5);
    expect(getNextDailyEncouragementMilestone(0.8, recorded)).toBe(0.8);
  });

  it("does not repeat milestones already recorded", () => {
    const recorded = new Set<number>([0.25, 0.5, 0.8]);
    expect(getNextDailyEncouragementMilestone(1, recorded)).toBeNull();
  });

  it("records completed encouragement without triggering a retired feature", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await expect(recordDailyEncouragementProgress("encouragement-1", "completed", 1)).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("record_daily_encouragement_progress", {
      p_daily_pep_talk_id: "encouragement-1",
      p_event: "completed",
      p_progress: 1,
    });
  });
});
