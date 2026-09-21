import { assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260810220000_add_daily_adventure_state.sql",
  import.meta.url,
);

Deno.test("Daily Adventure state is versionable and completed routes remain durable", async () => {
  const sql = await Deno.readTextFile(migrationUrl);

  assertMatch(sql, /ADD COLUMN IF NOT EXISTS adventure_state jsonb NOT NULL DEFAULT '\{\}'::jsonb/i);
  assertMatch(sql, /CHECK \(jsonb_typeof\(adventure_state\) = 'object'\)/i);
  assertMatch(sql, /OLD\.status = 'reflected'[\s\S]*Reflected Daily Chapters are immutable/i);
  assertMatch(sql, /NEW\.adventure_state - 'eveningChoice' - 'outcome'/i);
  assertMatch(sql, /OLD\.adventure_state <> '\{\}'::jsonb/i);
});
