import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useEpicsMock: vi.fn(),
}));

vi.mock("./useEpics", () => ({
  useEpics: (...args: unknown[]) => mocks.useEpicsMock(...args),
}));

import { useCampaigns } from "./useCampaigns";

describe("useCampaigns", () => {
  it("reuses the legacy epics hook and maps records into canonical campaigns", () => {
    const createEpic = vi.fn();
    const renameEpic = vi.fn();
    const updateEpicStatus = vi.fn();

    mocks.useEpicsMock.mockReturnValue({
      epics: [{
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: null,
        status: "active",
        progress_percentage: 55,
        target_days: 21,
        start_date: "2026-04-01",
        end_date: null,
        epic_habits: [],
        latest_journey_path_generated_at: null,
        latest_journey_path_milestone_index: null,
        latest_journey_path_url: null,
      }],
      activeEpics: [{
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: null,
        status: "active",
        progress_percentage: 55,
        target_days: 21,
        start_date: "2026-04-01",
        end_date: null,
        epic_habits: [],
        latest_journey_path_generated_at: null,
        latest_journey_path_milestone_index: null,
        latest_journey_path_url: null,
      }],
      completedEpics: [],
      isLoading: false,
      error: null,
      createEpic,
      isCreating: false,
      updateEpic: vi.fn(),
      renameEpic,
      deleteEpic: vi.fn(),
      updateEpicStatus,
      createCampaignRitual: vi.fn(),
      isCreatingCampaignRitual: false,
    });

    const { result } = renderHook(() => useCampaigns({ enabled: false }));

    expect(mocks.useEpicsMock).toHaveBeenCalledWith({ enabled: false });
    expect(result.current.campaigns[0]).toMatchObject({
      id: "epic-1",
      title: "Campaign Alpha",
      startDate: "2026-04-01",
      targetDays: 21,
    });
    expect(result.current.createCampaign).toBe(createEpic);
    expect(result.current.renameCampaign).toBe(renameEpic);
    expect(result.current.updateCampaignStatus).toBe(updateEpicStatus);
  });
});
