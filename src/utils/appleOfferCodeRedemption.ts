export const APPLE_OFFER_CODE_APP_STORE_ID = "6755738842";

const APPLE_ONE_TIME_OFFER_CODE_PATTERN = /^[A-Z0-9]{16,24}$/;

function extractCodeFromAppleRedemptionUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    for (const [key, code] of url.searchParams.entries()) {
      if (key.toLowerCase() === "code") {
        return code.trim() || null;
      }
    }
    return null;
  } catch {
    const match = trimmed.match(/[?&]code=([^&#\s]+)/i);
    if (!match?.[1]) return null;

    try {
      return decodeURIComponent(match[1]).trim() || null;
    } catch {
      return match[1].trim() || null;
    }
  }
}

export function normalizePaywallOfferCodeInput(value: string): string {
  return (extractCodeFromAppleRedemptionUrl(value) ?? value).trim().toUpperCase();
}

export function isAppleOneTimeOfferCode(value: string): boolean {
  const normalized = normalizePaywallOfferCodeInput(value);
  return APPLE_ONE_TIME_OFFER_CODE_PATTERN.test(normalized);
}

export function buildAppleOfferCodeRedeemUrl(code: string): string {
  const normalized = normalizePaywallOfferCodeInput(code);
  const params = new URLSearchParams({
    ctx: "offercodes",
    id: APPLE_OFFER_CODE_APP_STORE_ID,
    code: normalized,
  });

  return `https://apps.apple.com/redeem?${params.toString()}`;
}
