import type { EpicRecord } from "@/hooks/epicsQuery";
import type {
  Campaign,
  CampaignHabit,
  CampaignHabitLink,
  CampaignSummary,
} from "@/types/domain";

type EpicRecordLike = EpicRecord & Record<string, unknown>;

const readString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const toCampaignHabit = (
  habit: NonNullable<EpicRecord["epic_habits"]>[number]["habits"],
): CampaignHabit | null => {
  if (!habit) return null;

  return {
    id: habit.id,
    title: habit.title,
    difficulty: habit.difficulty ?? null,
    description: habit.description ?? null,
    frequency: habit.frequency ?? null,
    estimatedMinutes: habit.estimated_minutes ?? null,
    customDays: habit.custom_days ?? null,
    customMonthDays: habit.custom_month_days ?? null,
    preferredTime: habit.preferred_time ?? null,
    category: habit.category ?? null,
  };
};

const toCampaignRituals = (epic: EpicRecord): CampaignHabitLink[] =>
  (epic.epic_habits ?? []).map((link) => ({
    habitId: link.habit_id,
    habit: toCampaignHabit(link.habits),
  }));

const resolveMilestoneCount = (epic: EpicRecordLike): number => {
  if (Array.isArray(epic.epic_milestones)) {
    return epic.epic_milestones.length;
  }

  return readNumber(epic.milestone_count) ?? 0;
};

export const toCampaign = (epic: EpicRecord): Campaign => {
  const epicRecord = epic as EpicRecordLike;
  const rituals = toCampaignRituals(epic);

  return {
    id: epic.id,
    userId: epic.user_id,
    title: epic.title,
    description: epic.description ?? null,
    status: epic.status,
    startDate: epic.start_date,
    endDate: epic.end_date ?? null,
    targetDays: epic.target_days,
    progressPercentage: epic.progress_percentage ?? null,
    themeColor: readString(epicRecord.theme_color),
    habitCount: rituals.length,
    milestoneCount: resolveMilestoneCount(epicRecord),
    latestJourneyPathUrl: epic.latest_journey_path_url ?? null,
    latestJourneyPathGeneratedAt: epic.latest_journey_path_generated_at ?? null,
    latestJourneyPathMilestoneIndex: epic.latest_journey_path_milestone_index ?? null,
    createdAt: readString(epicRecord.created_at),
    completedAt: readString(epicRecord.completed_at),
    xpReward: readNumber(epicRecord.xp_reward),
    isPublic: readBoolean(epicRecord.is_public),
    inviteCode: readString(epicRecord.invite_code),
    storyTypeSlug: readString(epicRecord.story_type_slug),
    rituals,
  };
};

export const toCampaignSummary = (epic: EpicRecord): CampaignSummary => {
  const campaign = toCampaign(epic);

  return {
    id: campaign.id,
    title: campaign.title,
    status: campaign.status,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    targetDays: campaign.targetDays,
    progressPercentage: campaign.progressPercentage,
    themeColor: campaign.themeColor,
    habitCount: campaign.habitCount,
    milestoneCount: campaign.milestoneCount,
    latestJourneyPathUrl: campaign.latestJourneyPathUrl,
  };
};
