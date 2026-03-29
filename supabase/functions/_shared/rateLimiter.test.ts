function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const rateLimiterModule = await import("./rateLimiter.ts");

Deno.test("canonicalizeRateLimitKey groups smart plan routes under the shared daily plan bucket", () => {
  assert(
    rateLimiterModule.canonicalizeRateLimitKey("generate-smart-daily-plan") === "daily-plan-generation",
    "Expected smart daily plans to share the daily-plan-generation bucket",
  );
  assert(
    rateLimiterModule.canonicalizeRateLimitKey("decompose-task") === "task-intelligence",
    "Expected decompose-task to share the task-intelligence bucket",
  );
});

Deno.test("phase 1 rate limit thresholds use the tighter security defaults", () => {
  assert(rateLimiterModule.RATE_LIMITS["journey-path"].maxCalls === 5, "Expected journey path limit to be 5 per day");
  assert(rateLimiterModule.RATE_LIMITS["daily-plan-generation"].maxCalls === 10, "Expected daily plan generation limit to be 10 per day");
  assert(rateLimiterModule.RATE_LIMITS["daily-plan-adjustment"].maxCalls === 15, "Expected daily plan adjustment limit to be 15 per day");
  assert(rateLimiterModule.RATE_LIMITS["task-intelligence"].maxCalls === 50, "Expected task intelligence limit to be 50 per day");
});
