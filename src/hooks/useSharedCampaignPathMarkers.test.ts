import { describe, expect, it } from "vitest";
import {
  normalizeSharedCampaignPathMarkers,
  resolveSharedCampaignMarkerProgress,
} from "./useSharedCampaignPathMarkers";

describe("shared campaign path marker progress", () => {
  it("uses owner epic progress when the owner has no milestone or log progress", () => {
    expect(resolveSharedCampaignMarkerProgress({
      completedMilestonePercents: [],
      ownerProgressPercentage: 38,
      isOwner: true,
    })).toBe(38);
  });

  it("uses joined member contribution when the member has no milestone or log progress", () => {
    expect(resolveSharedCampaignMarkerProgress({
      completedMilestonePercents: [],
      memberContribution: 24,
      isOwner: false,
    })).toBe(24);
  });

  it("prefers the highest completed milestone percentage over fallback progress", () => {
    expect(resolveSharedCampaignMarkerProgress({
      completedMilestonePercents: [20, 80, 40],
      progressLogPercentage: 45,
      ownerProgressPercentage: 50,
      isOwner: true,
    })).toBe(80);
  });

  it("falls back to progress logs when no milestones are complete", () => {
    expect(resolveSharedCampaignMarkerProgress({
      completedMilestonePercents: [],
      progressLogPercentage: 62,
      memberContribution: 15,
    })).toBe(62);
  });

  it("clamps marker progress to the 0-100 path bounds", () => {
    expect(resolveSharedCampaignMarkerProgress({
      completedMilestonePercents: [140],
    })).toBe(100);
    expect(resolveSharedCampaignMarkerProgress({
      progressLogPercentage: -12,
    })).toBe(0);
  });
});

describe("normalizeSharedCampaignPathMarkers", () => {
  it("normalizes display-safe RPC rows into trail marker data", () => {
    expect(normalizeSharedCampaignPathMarkers([
      {
        user_id: "user-1",
        display_name: "  ",
        progress_percentage: "45",
        is_current_user: false,
        is_owner: true,
        companion_image_url: null,
        companion_image_focal_x: null,
        companion_image_focal_y: null,
        companion_mood: null,
        joined_at: null,
        last_activity_at: "2026-05-17T12:00:00.000Z",
      },
    ], "user-1")).toEqual([
      {
        userId: "user-1",
        displayName: "Adventurer",
        progressPercentage: 45,
        isCurrentUser: true,
        isOwner: true,
        companionImageUrl: null,
        companionImageFocalX: null,
        companionImageFocalY: null,
        companionMood: null,
        joinedAt: null,
        lastActivityAt: "2026-05-17T12:00:00.000Z",
      },
    ]);
  });
});
