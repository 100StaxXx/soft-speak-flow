function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const redeemPromoCodeModule = await import("./index.ts");

Deno.test("normalizePromoRedeemRequest accepts promoCode and promo_code payloads", () => {
  const direct = redeemPromoCodeModule.normalizePromoRedeemRequest({ promoCode: " bigfella2026 " });
  const legacy = redeemPromoCodeModule.normalizePromoRedeemRequest({ promo_code: "launch30" });

  assert(direct?.promoCode === "BIGFELLA2026", "Expected promoCode payload to normalize");
  assert(legacy?.promoCode === "LAUNCH30", "Expected promo_code payload to normalize");
});

Deno.test("extractPromoRedemptionClientIp prefers cf-connecting-ip before forwarded-for", () => {
  const request = new Request("https://example.com", {
    headers: {
      "cf-connecting-ip": "203.0.113.77",
      "x-forwarded-for": "198.51.100.88",
    },
  });

  assert(
    redeemPromoCodeModule.extractPromoRedemptionClientIp(request) === "203.0.113.77",
    "Expected cf-connecting-ip to take precedence",
  );
});
