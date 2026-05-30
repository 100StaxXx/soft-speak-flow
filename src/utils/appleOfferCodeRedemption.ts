export const APPLE_OFFER_CODE_APP_STORE_ID = "6755738842";

const APPLE_ONE_TIME_OFFER_CODE_PATTERN = /^[A-Z0-9]{16,24}$/;

export function normalizePaywallOfferCodeInput(value: string): string {
  return value.trim().toUpperCase();
}

export function isAppleOneTimeOfferCode(value: string): boolean {
  const normalized = normalizePaywallOfferCodeInput(value);
  return (
    APPLE_ONE_TIME_OFFER_CODE_PATTERN.test(normalized) &&
    /[A-Z]/.test(normalized) &&
    /\d/.test(normalized)
  );
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
