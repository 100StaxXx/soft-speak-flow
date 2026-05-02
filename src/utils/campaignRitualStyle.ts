export type CampaignRitualLike = {
  habit_source_id?: string | null;
  epic_id?: string | null;
};

export const CAMPAIGN_RITUAL_CARD_CLASS_NAME = "campaign-ritual-card";

export const CAMPAIGN_RITUAL_CARD_CLASSES =
  `${CAMPAIGN_RITUAL_CARD_CLASS_NAME} border-primary/35 bg-primary/[0.08]`;

export const isCampaignRitualTask = (task: CampaignRitualLike) =>
  Boolean(task.habit_source_id && task.epic_id);
