import { assert, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260810193000_living_companion_interactions.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("living companion interaction memory is ownership-scoped and write-protected", () => {
  assertMatch(sql, /CREATE TABLE IF NOT EXISTS public\.companion_interaction_memory/);
  assertMatch(sql, /ALTER TABLE public\.companion_interaction_memory ENABLE ROW LEVEL SECURITY/);
  assertMatch(sql, /USING \(user_id = auth\.uid\(\)\)/);
  assertMatch(sql, /REVOKE INSERT, UPDATE, DELETE ON public\.companion_interaction_memory/);
  assertMatch(sql, /interaction_kind IN \('tap', 'pet', 'hold', 'keyboard', 'answer'\)/);
  assertMatch(sql, /interaction_day date NOT NULL DEFAULT CURRENT_DATE/);
  assertMatch(sql, /p_local_date < CURRENT_DATE - 1 OR p_local_date > CURRENT_DATE \+ 1/);
  assertMatch(sql, /char_length\(btrim\(p_prompt_key\)\) > 80/);
});

Deno.test("interaction recording validates ownership and rate-limits bond counting", () => {
  assertMatch(sql, /CREATE OR REPLACE FUNCTION public\.record_companion_interaction/);
  assertMatch(sql, /SECURITY DEFINER/);
  assertMatch(sql, /uc\.id = p_companion_id[\s\S]*uc\.user_id = v_user_id[\s\S]*FOR UPDATE/);
  assertMatch(sql, /v_last_interaction_at < v_now - interval '20 seconds'/);
  assertMatch(sql, /CASE WHEN v_counted THEN 1 ELSE 0 END/);
  assertMatch(sql, /REVOKE ALL ON FUNCTION public\.record_companion_interaction[\s\S]*FROM PUBLIC, anon/);
  assertMatch(sql, /GRANT EXECUTE ON FUNCTION public\.record_companion_interaction[\s\S]*TO authenticated/);
  assert(!/GRANT (INSERT|UPDATE|DELETE)/.test(sql));
});
