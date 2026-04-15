export const ACTIVE_CAMPAIGN_LIMIT = 3;

export const ACTIVE_CAMPAIGN_LIMIT_MESSAGE =
  `You can only have ${ACTIVE_CAMPAIGN_LIMIT} active campaigns at a time. Complete or abandon one before starting another.`;

export const ACTIVE_CAMPAIGN_LIMIT_WARNING =
  `You have ${ACTIVE_CAMPAIGN_LIMIT} active campaigns. Complete one before starting another.`;

export const hasReachedActiveCampaignLimit = (activeCampaignCount: number) =>
  activeCampaignCount >= ACTIVE_CAMPAIGN_LIMIT;

export const isActiveCampaignLimitHaystack = (haystack: string) =>
  haystack.includes(`${ACTIVE_CAMPAIGN_LIMIT} active epics`) ||
  haystack.includes("active epics at a time") ||
  haystack.includes("active campaigns at a time");
