import { assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260810150000_create_daily_mission_threads.sql",
  import.meta.url,
);

Deno.test("daily mission threads are user-owned, task-bound, and private", async () => {
  const sql = await Deno.readTextFile(migrationUrl);

  assertMatch(sql, /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/i);
  assertMatch(sql, /primary_task_id uuid REFERENCES public\.daily_tasks\(id\) ON DELETE SET NULL/i);
  assertMatch(sql, /UNIQUE \(user_id, mission_date\)/i);
  assertMatch(sql, /ALTER TABLE public\.daily_mission_threads ENABLE ROW LEVEL SECURITY/i);
  assertMatch(sql, /FOR SELECT\s+USING \(auth\.uid\(\) = user_id\)/i);
  assertMatch(sql, /FOR INSERT[\s\S]*WITH CHECK \([\s\S]*auth\.uid\(\) = user_id/i);
  assertMatch(sql, /WHERE task\.id = primary_task_id AND task\.user_id = auth\.uid\(\)/i);
  assertMatch(sql, /FOR DELETE\s+USING \(auth\.uid\(\) = user_id\)/i);
});
