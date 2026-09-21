import { PRODUCT } from "@/config/product";
import { PRODUCT_RUNTIME } from "@/config/productRuntime";

export const PREMIUM_PRODUCT_NAME = PRODUCT.mode === "christian"
  ? "Graceward Plus"
  : "Cosmiq Premium";

export const PREMIUM_BENEFITS = PRODUCT.mode === "christian"
  ? [
      "Reviewed daily Scripture and prayer",
      "One ready-made self-improvement practice each day",
      "Guide encouragement and guided reflections",
      "Offline access to downloaded content",
    ]
  : [
      "Personalized planning and focus support",
      "Guided reflections and companion insights",
      "Expanded companion growth experiences",
      "Offline access to downloaded content",
    ];

export const PREMIUM_BENEFITS_SUMMARY = PRODUCT.mode === "christian"
  ? "Daily Scripture and prayer, a ready-made daily practice, Guide encouragement, guided reflections, and offline access to downloaded content."
  : "Personalized planning and focus support, guided reflections, expanded companion growth experiences, and offline access to downloaded content.";

export const PREMIUM_PLAN_NOTE =
  `Both monthly and yearly plans include the same ${PREMIUM_PRODUCT_NAME} features and renew automatically until canceled.`;

export const PREMIUM_APPLE_BILLING_DISCLOSURE =
  "Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Your Apple ID account will be charged for renewal within 24 hours before the period ends. Manage or cancel anytime in App Store account settings.";

export const PREMIUM_SUBSCRIPTION_LEGAL_LINKS = {
  privacy: {
    label: "Privacy Policy",
    inAppHref: "/privacy",
    publicHref: `${PRODUCT_RUNTIME.publicSiteOrigin}/privacy`,
  },
  terms: {
    label: "Terms of Use",
    inAppHref: "/terms",
    publicHref: `${PRODUCT_RUNTIME.publicSiteOrigin}/terms`,
  },
  appleEula: {
    label: "Apple Standard EULA",
    publicHref: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  },
};
