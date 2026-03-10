function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const missionModule = await import("./index.ts");

const XP_RULES: Record<string, { min: number; max: number }> = {
  connection: { min: 5, max: 10 },
  quick_win: { min: 5, max: 10 },
  identity: { min: 10, max: 15 },
  wellness: { min: 5, max: 10 },
  gratitude: { min: 5, max: 10 },
  growth: { min: 10, max: 15 },
};

Deno.test("generate-daily-missions falls back deterministically when AI is rate-limited (429)", () => {
  const aiFailure = missionModule.mapAIHttpFailure(429, "Too many requests", "120");
  const reason = missionModule.resolveFallbackReason(new missionModule.AIRequestError(aiFailure));
  const fallback = missionModule.generateFallbackMissions(
    "user-429",
    "2026-03-02",
    ["connection", "growth", "wellness"],
    ["Ship launch prep"],
  );

  assert(aiFailure.code === "AI_RATE_LIMITED", "Expected AI_RATE_LIMITED code");
  assert(reason === "rate_limited", "Expected degraded reason to map to rate_limited");
  assert(fallback.length === 3, "Expected exactly 3 fallback missions");
});

Deno.test("generate-daily-missions falls back when AI output is invalid JSON", () => {
  const parsed = missionModule.parseAIMissions("```json\nnot valid json\n```");
  const reason = missionModule.resolveFallbackReason(
    new missionModule.InvalidAIGenerationError("Invalid AI response format"),
  );
  const fallback = missionModule.generateFallbackMissions(
    "user-invalid-json",
    "2026-03-02",
    ["identity", "quick_win", "gratitude"],
    [],
  );

  assert(parsed.missions === null, "Expected invalid JSON parsing to fail");
  assert(reason === "invalid_ai_output", "Expected invalid_ai_output degraded reason");
  assert(fallback.length === 3, "Expected exactly 3 fallback missions");
});

Deno.test("fallback missions are unique categories with valid XP bounds", () => {
  const fallback = missionModule.generateFallbackMissions(
    "user-xp",
    "2026-03-02",
    ["connection", "growth", "wellness"],
    [],
  );

  assert(fallback.length === 3, "Expected exactly 3 missions");

  const categories = fallback.map((mission: { category: string }) => mission.category);
  const unique = new Set(categories);
  assert(unique.size === 3, "Expected unique categories");

  for (const mission of fallback) {
    const rule = XP_RULES[mission.category];
    assert(Boolean(rule), `Unexpected category: ${mission.category}`);
    assert(
      mission.xp >= rule.min && mission.xp <= rule.max,
      `XP for ${mission.category} out of bounds: ${mission.xp}`,
    );
  }
});

Deno.test("invalid profile timezone normalizes to UTC without throwing", () => {
  const normalized = missionModule.normalizeTimezone("Not/A_Real_Timezone");
  const invalidTzDate = missionModule.getEffectiveMissionDate("Not/A_Real_Timezone");
  const utcDate = missionModule.getEffectiveMissionDate("UTC");

  assert(normalized === "UTC", "Expected invalid timezone to normalize to UTC");
  assert(typeof invalidTzDate === "string" && invalidTzDate.length > 0, "Expected mission date output");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(invalidTzDate), `Expected YYYY-MM-DD format, got ${invalidTzDate}`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(utcDate), `Expected YYYY-MM-DD format, got ${utcDate}`);
  assert(!invalidTzDate.includes("/"), "Expected mission date to avoid locale slash separators");
  assert(invalidTzDate === utcDate, "Expected invalid timezone mission date to match UTC");
});

Deno.test("active habits query uses is_active schema flag", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(
    source.includes('.eq("is_active", true)'),
    "Expected habits query to filter by is_active = true",
  );
  assert(
    !source.includes("archived_at"),
    "Expected no archived_at dependency in habits query",
  );
});
