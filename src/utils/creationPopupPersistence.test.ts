import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => {
  const storage = new Map<string, string>();

  return {
    storage,
    safeLocalStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        return true;
      },
      removeItem: (key: string) => {
        storage.delete(key);
        return true;
      },
      clear: () => {
        storage.clear();
        return true;
      },
    },
  };
});

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
}));

import {
  CAMPAIGN_BUILDER_DRAFT_VERSION,
  clearCampaignBuilderDraftSnapshot,
  clearCreationPopupMarker,
  readCampaignBuilderDraftSnapshot,
  readCreationPopupMarker,
  writeCampaignBuilderDraftSnapshot,
  writeCreationPopupMarker,
} from "@/utils/creationPopupPersistence";
import {
  getCampaignBuilderDraftStorageKey,
  getCreationPopupMarkerStorageKey,
} from "@/utils/accountLocalState";

describe("creationPopupPersistence", () => {
  beforeEach(() => {
    storageMocks.safeLocalStorage.clear();
  });

  it("round-trips active creation popup markers and clears only the expected surface", () => {
    writeCreationPopupMarker("user-1", {
      surface: "campaign",
      route: "/campaigns",
      selectedDate: null,
      updatedAt: "2026-05-01T12:00:00.000Z",
    });

    expect(readCreationPopupMarker("user-1")).toEqual({
      surface: "campaign",
      route: "/campaigns",
      selectedDate: null,
      updatedAt: "2026-05-01T12:00:00.000Z",
    });

    clearCreationPopupMarker("user-1", "quest");
    expect(readCreationPopupMarker("user-1")?.surface).toBe("campaign");

    clearCreationPopupMarker("user-1", "campaign");
    expect(readCreationPopupMarker("user-1")).toBeNull();
  });

  it("rejects invalid creation markers", () => {
    storageMocks.safeLocalStorage.setItem(getCreationPopupMarkerStorageKey("user-1"), "{bad json");
    expect(readCreationPopupMarker("user-1")).toBeNull();

    storageMocks.safeLocalStorage.setItem(
      getCreationPopupMarkerStorageKey("user-1"),
      JSON.stringify({
        surface: "note",
        route: "/journeys",
        selectedDate: "2026-05-01",
        updatedAt: "2026-05-01T12:00:00.000Z",
      }),
    );
    expect(readCreationPopupMarker("user-1")).toBeNull();
  });

  it("round-trips campaign builder drafts and rejects stale versions", () => {
    writeCampaignBuilderDraftSnapshot("user-1", {
      step: "review",
      goalInput: "Launch the course",
      deadline: "2026-06-01",
      timelineContext: "Already have a rough outline",
      epicTitle: "Course Launch",
      epicWhy: "Make the work real",
      storyType: null,
      themeColor: "heroic",
      customHabits: [{ id: "habit-1", title: "Draft lesson", type: "habit", description: "", difficulty: "medium" }],
      selectedTemplate: null,
      schedule: {
        feasibilityAssessment: {
          daysAvailable: 30,
          typicalDays: 30,
          feasibility: "achievable",
          message: "Achievable",
        },
        phases: [{ id: "phase-1", name: "Build", description: "", startDate: "2026-05-01", endDate: "2026-05-10", phaseOrder: 1 }],
        milestones: [{ id: "milestone-1", title: "Outline", description: "", targetDate: "2026-05-10", phaseOrder: 1, phaseName: "Build", isPostcardMilestone: true, milestonePercent: 50 }],
        rituals: [{ id: "ritual-1", title: "Write", description: "", frequency: "daily", difficulty: "medium" }],
        weeklyHoursEstimate: 4,
        suggestedChapterCount: 4,
        executionModel: "sequential",
      },
      originalRituals: [{ id: "ritual-1", title: "Write", description: "", frequency: "daily", difficulty: "medium" }],
      localClarificationAnswers: { daily_time: "45 minutes" },
      localEpicContext: "Course launch context",
      showClarification: false,
      clarificationQuestions: [],
      updatedAt: "2026-05-01T12:05:00.000Z",
    });

    expect(readCampaignBuilderDraftSnapshot("user-1")).toMatchObject({
      version: CAMPAIGN_BUILDER_DRAFT_VERSION,
      step: "review",
      goalInput: "Launch the course",
      schedule: {
        weeklyHoursEstimate: 4,
      },
    });

    storageMocks.safeLocalStorage.setItem(
      getCampaignBuilderDraftStorageKey("user-1"),
      JSON.stringify({
        version: CAMPAIGN_BUILDER_DRAFT_VERSION + 1,
        step: "review",
      }),
    );

    expect(readCampaignBuilderDraftSnapshot("user-1")).toBeNull();
  });

  it("treats null users as no-ops", () => {
    expect(clearCreationPopupMarker(null)).toBe(false);
    expect(clearCampaignBuilderDraftSnapshot(undefined)).toBe(false);
    expect(readCreationPopupMarker(null)).toBeNull();
    expect(readCampaignBuilderDraftSnapshot(undefined)).toBeNull();
  });
});
