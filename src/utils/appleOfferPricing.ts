export const GENESIS_SPECIAL_CODE = "GENESIS";

export type YearlyOfferTier = "referrals" | "genesis";

export type YearlyOfferDisplay = {
  tier: YearlyOfferTier;
  price: string;
  priceCents: number;
  unitPrice: string;
};

const YEARLY_OFFER_DISPLAYS: Record<YearlyOfferTier, YearlyOfferDisplay> = {
  referrals: {
    tier: "referrals",
    price: "$29.99",
    priceCents: 2999,
    unitPrice: "$2.50/month, locked while active",
  },
  genesis: {
    tier: "genesis",
    price: "$29.99",
    priceCents: 2999,
    unitPrice: "$2.50/month, locked while active",
  },
};

export function getYearlyOfferTier(
  campaignIdentifier: string | null | undefined,
  appliedCode?: string | null | undefined,
): YearlyOfferTier | null {
  if (isGenesisSpecialCode(appliedCode)) return "genesis";

  const normalized = campaignIdentifier?.trim().toLowerCase();
  if (normalized === "genesis") return "genesis";
  if (normalized === "referrals") return "referrals";
  return null;
}

export function getYearlyOfferDisplay(
  tier: YearlyOfferTier | null | undefined,
): YearlyOfferDisplay {
  return YEARLY_OFFER_DISPLAYS[tier ?? "referrals"];
}

export function isGenesisSpecialCode(code: string | null | undefined): boolean {
  return code?.trim().toUpperCase() === GENESIS_SPECIAL_CODE;
}
