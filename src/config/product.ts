/**
 * User-facing product identity and vocabulary.
 *
 * Legacy database, route, and analytics names intentionally remain unchanged
 * during the Christian product migration. Keeping display language here lets us
 * change the brand without putting existing user data at risk.
 */
export type ProductMode = "christian" | "cosmiq";

const configuredMode = import.meta.env.VITE_PRODUCT_MODE?.trim().toLowerCase();
const mode: ProductMode = configuredMode === "cosmiq" ? "cosmiq" : "christian";

const PRODUCT_CONFIG = {
  christian: {
    name: "Graceward",
    legalEntity: "Cosmiq LLC",
    tagline: "Grow in faith, one day at a time.",
    description:
      "A Christian companion for Scripture, prayer, reflection, and faithful action.",
    supportEmail: "hello@graceward.app",
  },
  cosmiq: {
    name: "Cosmiq",
    legalEntity: "Cosmiq LLC",
    tagline: "Turn intention into meaningful momentum.",
    description:
      "A living companion for planning, focus, reflection, and personal growth.",
    supportEmail: "hello@cosmiq.app",
  },
} as const;

export const PRODUCT = {
  ...PRODUCT_CONFIG[mode],
  mode,
} as const;

export const PRODUCT_COPY = {
  actionComplete: mode === "christian" ? "Faithful practice complete" : "Quest complete",
  dailyPractice: mode === "christian" ? "practice" : "quest",
  dailyPractices: mode === "christian" ? "practices" : "quests",
  growthLabel: mode === "christian" ? "Growth" : "XP",
} as const;
