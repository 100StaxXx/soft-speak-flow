import { resolveSingleDailyPepTalkDateContext } from "./workflow.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createMockSupabase(timezone: string | null, error: string | null = null) {
  const maybeSingle = () =>
    Promise.resolve({
      data: error ? null : { timezone },
      error: error ? { message: error } : null,
    });
  const eq = () => ({ maybeSingle });
  const select = () => ({ eq });
  const from = () => ({ select });

  return { from };
}

Deno.test("resolveSingleDailyPepTalkDateContext uses profile timezone for the effective date", async () => {
  const context = await resolveSingleDailyPepTalkDateContext({
    supabase: createMockSupabase("Pacific/Honolulu"),
    userId: "user-123",
    now: new Date("2026-03-10T11:30:00.000Z"),
  });

  assert(context.timezone === "Pacific/Honolulu", `Expected timezone to be preserved, got ${context.timezone}`);
  assert(context.effectiveDate === "2026-03-09", `Expected previous day before reset, got ${context.effectiveDate}`);
  assert(context.themeAnchorDate.toISOString() === "2026-03-09T12:00:00.000Z", `Unexpected theme anchor ${context.themeAnchorDate.toISOString()}`);
});

Deno.test("resolveSingleDailyPepTalkDateContext supports far-ahead timezones", async () => {
  const context = await resolveSingleDailyPepTalkDateContext({
    supabase: createMockSupabase("Pacific/Kiritimati"),
    userId: "user-456",
    now: new Date("2026-03-10T13:30:00.000Z"),
  });

  assert(context.effectiveDate === "2026-03-11", `Expected next local day for UTC+14, got ${context.effectiveDate}`);
  assert(context.themeAnchorDate.toISOString() === "2026-03-11T12:00:00.000Z", `Unexpected theme anchor ${context.themeAnchorDate.toISOString()}`);
});

Deno.test("resolveSingleDailyPepTalkDateContext surfaces profile lookup failures", async () => {
  let threw = false;

  try {
    await resolveSingleDailyPepTalkDateContext({
      supabase: createMockSupabase(null, "boom"),
      userId: "user-789",
    });
  } catch (error) {
    threw = true;
    assert(
      error instanceof Error && error.message.includes("Failed to fetch profile timezone"),
      `Unexpected error ${String(error)}`,
    );
  }

  assert(threw, "Expected profile lookup failure to throw");
});
