import { assert, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260810014500_accept_living_narrative_side_quest.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("living narrative side quest acceptance is atomic and idempotent", () => {
  assertMatch(sql, /CREATE OR REPLACE FUNCTION public\.accept_companion_narrative_side_quest/);
  assertMatch(sql, /SECURITY INVOKER/);
  assertMatch(sql, /FOR UPDATE/);
  assertMatch(sql, /IF v_choice\.side_quest_task_id IS NOT NULL/);
  assertMatch(sql, /INSERT INTO public\.daily_tasks/);
  assertMatch(sql, /side_quest_status = 'accepted'/);
  assertMatch(sql, /side_quest_task_id = v_task\.id/);
  assertMatch(sql, /REVOKE ALL ON FUNCTION public\.accept_companion_narrative_side_quest\(uuid\)[\s\S]*FROM PUBLIC, anon/);
  assert(!/SECURITY DEFINER/.test(sql));
});

Deno.test("companion is an allowed inbox task source", () => {
  assertMatch(sql, /daily_tasks_source_check/);
  assertMatch(sql, /'faithful_step'/);
  assertMatch(sql, /'companion'/);
  assertMatch(sql, /task_date,[\s\S]*scheduled_time,[\s\S]*source/);
  assertMatch(sql, /NULL,[\s\S]*NULL,[\s\S]*'easy'/);
});
