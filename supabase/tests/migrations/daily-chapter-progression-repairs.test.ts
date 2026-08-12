function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("Daily Chapter repair keeps progression truthful and chapter history durable", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260810170000_daily_chapter_progression_repairs.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes("v_today_xp >= 260") &&
      source.includes("ROUND(v_effective_xp * 0.35)"),
    "Expected the database XP function to match the public 260 XP and 35% repeatable-XP rules",
  );
  assert(
    source.includes("ADD COLUMN IF NOT EXISTS suggested_window_label") &&
      source.includes("daily_chapter_reflection"),
    "Expected exact recommendation windows and idempotent Wisdom reflection awards",
  );
  assert(
    source.includes("protect_completed_daily_mission_thread") &&
      source.includes("status = 'active'") &&
      source.includes("Completed Daily Chapters are permanent memories"),
    "Expected completed and reflected Daily Chapters to survive future sessions",
  );
  assert(
    source.includes("is_alive = TRUE") &&
      source.includes("dormant_since = NULL") &&
      source.includes("recovery_progress = 100"),
    "Expected punitive health and dormancy state to be retired",
  );
  assert(
    source.includes("generate-dormant-companion-image") &&
      source.includes("generate-neglected-companion-image") &&
      source.includes("generate-memorial-image"),
    "Expected obsolete punitive image endpoint budgets to be removed",
  );
});
