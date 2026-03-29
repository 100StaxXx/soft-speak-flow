function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const creatorStatsModule = await import("./index.ts");

Deno.test("normalizeCreatorDashboardRequest requires referral code and creator token fields", () => {
  const normalized = creatorStatsModule.normalizeCreatorDashboardRequest({
    referral_code: "creator42",
    creator_access_token: "signed-token",
  });

  assert(normalized.referralCode === "CREATOR42", "Expected referral code to normalize to uppercase");
  assert(normalized.creatorAccessToken === "signed-token", "Expected creator token to be preserved");
});

Deno.test("getClientIP prefers Cloudflare headers over spoofable forwarded-for values", () => {
  const request = new Request("https://example.com", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.44",
      "x-real-ip": "198.51.100.55",
    },
  });

  assert(
    creatorStatsModule.getClientIP(request) === "203.0.113.10",
    "Expected cf-connecting-ip to take precedence",
  );
});
