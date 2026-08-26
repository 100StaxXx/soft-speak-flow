/**
 * User-facing product identity and vocabulary.
 *
 * Legacy database, route, and analytics names intentionally remain unchanged
 * during the Christian product migration. Keeping display language here lets us
 * change the brand without putting existing user data at risk.
 */
export type ProductMode = "christian" | "cosmiq";

// Shared product-language modules are imported by both Vite and Deno edge
// tests. Vite supplies `import.meta.env`; Deno does not, so keep the read
// optional instead of forcing every backend test through Vite's ambient types.
const configuredMode = (import.meta as ImportMeta & {
  readonly env?: Record<string, string | boolean | undefined>;
}).env?.VITE_PRODUCT_MODE;
const normalizedConfiguredMode = typeof configuredMode === "string"
  ? configuredMode.trim().toLowerCase()
  : undefined;
const mode: ProductMode = normalizedConfiguredMode === "cosmiq"
  ? "cosmiq"
  : "christian";

const PRODUCT_CONFIG = {
  christian: {
    name: "Graceward",
    legalEntity: "Cosmiq LLC",
    tagline: "Grow in faith, one day at a time.",
    description:
      "A Christian companion for Scripture, prayer, reflection, and faithful action.",
    supportEmail: "hello@graceward.app",
    requiresSubscription: false,
  },
  cosmiq: {
    name: "Cosmiq",
    legalEntity: "Cosmiq LLC",
    tagline: "Turn intention into meaningful momentum.",
    description:
      "A living companion for planning, focus, reflection, and personal growth.",
    supportEmail: "hello@cosmiq.app",
    requiresSubscription: true,
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
