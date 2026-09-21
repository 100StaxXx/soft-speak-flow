import { assert } from "jsr:@std/assert";

const migrationPath = new URL(
  "../../migrations/20260819124500_finalize_queued_graceward_premade_evolutions.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationPath);

Deno.test("Graceward recovery advances only queued, published premade boundaries", () => {
  assert(sql.includes("job.status = 'queued'"));
  assert(sql.includes("companion.product_mode = 'graceward'"));
  assert(sql.includes("companion.current_stage = 0"));
  assert(sql.includes("contract.boundary_level = 1"));
  assert(sql.includes("FROM storage.objects AS portrait"));
  assert(sql.includes("FROM storage.objects AS video"));
});

Deno.test("Graceward recovery atomically records evolution, companion, and job success", () => {
  assert(sql.includes("ON CONFLICT (companion_id, stage) DO UPDATE"));
  assert(sql.includes("animation_status = 'succeeded'"));
  assert(sql.includes("SET current_stage = 1"));
  assert(sql.includes("SET status = 'succeeded'"));
  assert(sql.includes("result_evolution_id = evolution.id"));
});
