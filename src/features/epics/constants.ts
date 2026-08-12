export const ACTIVE_CAMPAIGN_LIMIT = 1;

export const ACTIVE_CAMPAIGN_LIMIT_MESSAGE =
  "Graceward keeps one Journey active at a time. Complete or release it before beginning another.";

export const ACTIVE_CAMPAIGN_LIMIT_WARNING =
  "You already have an active Journey. Complete or release it before beginning another.";

export const hasReachedActiveCampaignLimit = (activeCampaignCount: number) =>
  activeCampaignCount >= ACTIVE_CAMPAIGN_LIMIT;

export const isActiveCampaignLimitHaystack = (haystack: string) =>
  haystack.includes(`${ACTIVE_CAMPAIGN_LIMIT} active epics`) ||
  haystack.includes("active epics at a time") ||
  haystack.includes("active campaigns at a time");
