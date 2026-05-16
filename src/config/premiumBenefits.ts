export const PREMIUM_BENEFITS = [
  "Unlimited companion chat",
  "100+ levels and 12+ evolutions",
  "Unlimited Quests & Epics",
  "Offline access to downloaded content",
] as const;

export const PREMIUM_BENEFITS_SUMMARY =
  "Unlimited companion chat, 100+ levels and 12+ evolutions, unlimited Quests & Epics, and offline access to downloaded content.";

export const PREMIUM_PLAN_NOTE =
  "Both monthly and yearly plans include the same Cosmiq features and renew automatically until canceled.";

export const PREMIUM_APPLE_BILLING_DISCLOSURE =
  "Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Your Apple ID account will be charged for renewal within 24 hours before the period ends. Manage or cancel anytime in App Store account settings.";

export const PREMIUM_SUBSCRIPTION_LEGAL_LINKS = {
  privacy: {
    label: "Privacy Policy",
    inAppHref: "/privacy",
    publicHref: "https://app.cosmiq.quest/privacy",
  },
  terms: {
    label: "Terms of Use",
    inAppHref: "/terms",
    publicHref: "https://app.cosmiq.quest/terms",
  },
  appleEula: {
    label: "Apple Standard EULA",
    publicHref: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  },
} as const;
