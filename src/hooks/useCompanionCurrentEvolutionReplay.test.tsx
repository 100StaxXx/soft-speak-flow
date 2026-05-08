import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evolutions: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  jobError: null as null | { message: string; code?: string },
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          mocks.filters.push({ table, column, value });
          return chain;
        },
        order: () => chain,
        limit: async () => {
          if (table === "companion_evolutions") {
            return { data: mocks.evolutions, error: null };
          }
          if (table === "companion_animation_jobs") {
            return { data: mocks.jobs, error: mocks.jobError };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };
      return chain;
    },
  },
}));

import {
  fetchLatestCompanionEvolutionReplay,
  getCurrentCompanionEvolutionReplayStage,
} from "@/hooks/useCompanionCurrentEvolutionReplay";

describe("useCompanionCurrentEvolutionReplay helpers", () => {
  beforeEach(() => {
    mocks.evolutions = [];
    mocks.jobs = [];
    mocks.jobError = null;
    mocks.filters = [];
  });

  it("resolves the current visual boundary stage and ignores eggs", () => {
    expect(getCurrentCompanionEvolutionReplayStage({ current_stage: 0 })).toBeNull();
    expect(getCurrentCompanionEvolutionReplayStage({ current_stage: 1 })).toBe(1);
    expect(getCurrentCompanionEvolutionReplayStage({ current_stage: 8 })).toBe(5);
    expect(getCurrentCompanionEvolutionReplayStage({ current_stage: 56 })).toBe(56);
  });

  it("prefers the latest playable companion evolution row", async () => {
    mocks.evolutions = [
      {
        id: "evo-5",
        stage: 5,
        image_url: "https://example.com/stage-5.png",
        evolved_at: "2026-05-01T12:00:00.000Z",
        animation_video_url: "https://example.com/stage-5.mp4",
        animation_completed_at: "2026-05-01T12:02:00.000Z",
      },
    ];
    mocks.jobs = [
      {
        id: "job-5",
        evolution_id: "evo-5",
        stage: 5,
        source_image_url: "https://example.com/job-stage-5.png",
        video_url: "https://example.com/job-stage-5.mp4",
        completed_at: "2026-05-01T12:03:00.000Z",
        requested_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-01T12:03:00.000Z",
      },
    ];

    const replay = await fetchLatestCompanionEvolutionReplay({
      companionId: "companion-1",
      stage: 5,
    });

    expect(replay).toEqual({
      stage: 5,
      videoUrl: "https://example.com/stage-5.mp4",
      imageUrl: "https://example.com/stage-5.png",
      completedAt: "2026-05-01T12:02:00.000Z",
      source: "evolution",
      evolutionId: "evo-5",
    });
    expect(mocks.filters).toEqual(
      expect.arrayContaining([
        { table: "companion_evolutions", column: "companion_id", value: "companion-1" },
        { table: "companion_evolutions", column: "stage", value: 5 },
        { table: "companion_evolutions", column: "animation_status", value: "succeeded" },
      ]),
    );
  });

  it("falls back to a succeeded animation job when the evolution row has no video", async () => {
    mocks.evolutions = [
      {
        id: "evo-5",
        stage: 5,
        image_url: "https://example.com/stage-5.png",
        evolved_at: "2026-05-01T12:00:00.000Z",
        animation_video_url: null,
        animation_completed_at: null,
      },
    ];
    mocks.jobs = [
      {
        id: "job-5",
        evolution_id: "evo-5",
        stage: 5,
        source_image_url: "https://example.com/job-stage-5.png",
        video_url: "https://example.com/job-stage-5.mp4",
        completed_at: "2026-05-01T12:03:00.000Z",
        requested_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-01T12:03:00.000Z",
      },
    ];

    await expect(
      fetchLatestCompanionEvolutionReplay({
        companionId: "companion-1",
        stage: 5,
      }),
    ).resolves.toEqual({
      stage: 5,
      videoUrl: "https://example.com/job-stage-5.mp4",
      imageUrl: "https://example.com/job-stage-5.png",
      completedAt: "2026-05-01T12:03:00.000Z",
      source: "job",
      evolutionId: "evo-5",
    });
  });

  it("returns null when no playable replay exists", async () => {
    mocks.evolutions = [
      {
        id: "evo-5",
        stage: 5,
        image_url: "https://example.com/stage-5.png",
        evolved_at: "2026-05-01T12:00:00.000Z",
        animation_video_url: "   ",
        animation_completed_at: null,
      },
    ];
    mocks.jobs = [];

    await expect(
      fetchLatestCompanionEvolutionReplay({
        companionId: "companion-1",
        stage: 5,
      }),
    ).resolves.toBeNull();
  });
});
