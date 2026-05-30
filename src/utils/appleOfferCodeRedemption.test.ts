import { describe, expect, it } from "vitest";
import {
  buildAppleOfferCodeRedeemUrl,
  isAppleOneTimeOfferCode,
  normalizePaywallOfferCodeInput,
} from "./appleOfferCodeRedemption";

describe("appleOfferCodeRedemption", () => {
  it("uppercases and trims paywall code input", () => {
    expect(normalizePaywallOfferCodeInput("  73wjl3eplwx7wa36e6  ")).toBe("73WJL3EPLWX7WA36E6");
  });

  it("preserves existing custom creator-code characters while normalizing case", () => {
    const normalized = normalizePaywallOfferCodeInput(" cosmiq-test42 ");

    expect(normalized).toBe("COSMIQ-TEST42");
    expect(isAppleOneTimeOfferCode(normalized)).toBe(false);
  });

  it("builds the Apple redemption URL for the live Cosmiq App Store ID", () => {
    expect(buildAppleOfferCodeRedeemUrl("73wjl3eplwx7wa36e6")).toBe(
      "https://apps.apple.com/redeem?ctx=offercodes&id=6755738842&code=73WJL3EPLWX7WA36E6",
    );
  });

  it("rejects obviously malformed Apple one-time code input", () => {
    expect(isAppleOneTimeOfferCode("CREATOR123")).toBe(false);
    expect(isAppleOneTimeOfferCode("COSMIQ-TEST42")).toBe(false);
    expect(isAppleOneTimeOfferCode("1234567890123456")).toBe(false);
    expect(isAppleOneTimeOfferCode("ABCDEFGHIJKLMNOP")).toBe(false);
  });

  it("accepts downloaded Apple one-time-use code shapes", () => {
    expect(isAppleOneTimeOfferCode("73WJL3EPLWX7WA36E6")).toBe(true);
  });
});
