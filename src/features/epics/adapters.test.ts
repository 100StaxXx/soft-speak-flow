import { describe, expect, it } from "vitest";

import type { EpicRecord } from "@/hooks/epicsQuery";

import { toCampaign, toCampaignSummary } from "./adapters";

describe("epic adapters", () => {
  it("maps an EpicRecord into the canonical campaign shape", () => {
    const epic: EpicRecord = {
      id: "epic-1",
      user_id: "user-1",
      title: "Build Morning Routine",
      description: "A two-week reset.",
      status: "active",
      progress_percentage: 45,
      target_days: 14,
      start_date: "2026-04-01",
      end_date: "2026-04-14",
      epic_habits: [
        {
          habit_id: "habit-1",
          habits: {
            id: "habit-1",
            title: "Stretch",
            difficulty: "easy",
            description: "Loosen up.",
            frequency: "daily",
            estimated_minutes: 10,
            custom_days: null,
            custom_month_days: null,
            preferred_time: "07:00",
            category: "body",
          },
        },
      ],
      latest_journey_path_generated_at: "2026-04-03T12:00:00.000Z",
      latest_journey_path_milestone_index: 2,
      latest_journey_path_url: "https://example.com/path.png",
      theme_color: "heroic",
      milestone_count: 3,
      created_at: "2026-04-01T08:00:00.000Z",
      completed_at: null,
      xp_reward: 140,
      is_public: true,
      invite_code: "EPIC-1234",
      story_type_slug: "hero-journey",
    };

    expect(toCampaign(epic)).toEqual({
      id: "epic-1",
      userId: "user-1",
      title: "Build Morning Routine",
      description: "A two-week reset.",
      status: "active",
      startDate: "2026-04-01",
      endDate: "2026-04-14",
      targetDays: 14,
      progressPercentage: 45,
      themeColor: "heroic",
      habitCount: 1,
      milestoneCount: 3,
      latestJourneyPathUrl: "https://example.com/path.png",
      latestJourneyPathGeneratedAt: "2026-04-03T12:00:00.000Z",
      latestJourneyPathMilestoneIndex: 2,
      createdAt: "2026-04-01T08:00:00.000Z",
      completedAt: null,
      xpReward: 140,
      isPublic: true,
      inviteCode: "EPIC-1234",
      storyTypeSlug: "hero-journey",
      rituals: [
        {
          habitId: "habit-1",
          habit: {
            id: "habit-1",
            title: "Stretch",
            difficulty: "easy",
            description: "Loosen up.",
            frequency: "daily",
            estimatedMinutes: 10,
            customDays: null,
            customMonthDays: null,
            preferredTime: "07:00",
            category: "body",
          },
        },
      ],
    });
  });

  it("keeps partial offline rows safe and stable", () => {
    const epic: EpicRecord = {
      id: "epic-2",
      user_id: "user-2",
      title: "Offline Campaign",
      description: null,
      status: "active",
      progress_percentage: null,
      target_days: 30,
      start_date: "2026-04-10",
      end_date: null,
      epic_habits: null,
      latest_journey_path_generated_at: null,
      latest_journey_path_milestone_index: null,
      latest_journey_path_url: null,
    };

    expect(toCampaignSummary(epic)).toEqual({
      id: "epic-2",
      title: "Offline Campaign",
      status: "active",
      startDate: "2026-04-10",
      endDate: null,
      targetDays: 30,
      progressPercentage: null,
      themeColor: null,
      habitCount: 0,
      milestoneCount: 0,
      latestJourneyPathUrl: null,
    });
  });
});
