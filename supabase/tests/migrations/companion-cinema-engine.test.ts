import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

const migrationUrl = new URL(
  "../../migrations/20260819090000_add_companion_cinema_engine.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("companion cinema migration provisions private, personalized one-stage-ahead rendering", () => {
  for (
    const table of [
      "companion_traits",
      "companion_visual_mutations",
      "companion_legacy_achievements",
      "companion_interaction_runs",
      "companion_cinema_limits",
      "companion_cinema_events",
      "companion_cinema_renders",
    ]
  ) {
    assertStringIncludes(sql, `CREATE TABLE IF NOT EXISTS public.${table}`);
  }
  assertStringIncludes(sql, "companion-cinema-private");
  assertStringIncludes(sql, "public.enqueue_cosmiq_cinema_event_internal");
  assertStringIncludes(
    sql,
    "public.refresh_companion_observed_traits_internal",
  );
  assertStringIncludes(sql, "'fal-ai/kling-video/v3/standard/image-to-video'");
  assertStringIncludes(sql, "'native'");
  assertStringIncludes(sql, "max_render_attempts");
  assertStringIncludes(sql, "generate_series(1, 10)");
  assertStringIncludes(
    sql,
    "public.start_companion_cinema_interaction_internal",
  );
  assertStringIncludes(sql, "pg_advisory_xact_lock");
  assertStringIncludes(sql, "companion_interaction_runs_one_active_type_idx");
  assertStringIncludes(sql, "cinema_daily_limit_reached");
  assertStringIncludes(sql, "cinema_monthly_limit_reached");
  assertStringIncludes(sql, "completion_cinema_event_id");
  assertStringIncludes(sql, "provider_task_id = NULL");
  assertStringIncludes(sql, "render_attempt_count = CASE");
  assertStringIncludes(
    sql,
    "v_event_status IN ('failed', 'cancelled', 'superseded')",
  );
  assertStringIncludes(sql, "cleanup-companion-cinema-private-assets");
  assertStringIncludes(sql, "AND product_mode = 'cosmiq'");
  assertStringIncludes(sql, "AND companion.product_mode = 'cosmiq'");
  assert(
    !sql.includes(
      'CREATE POLICY "Service role manages private companion cinema"',
    ),
    "service-role Storage access must rely on BYPASSRLS instead of a storage.objects owner-only migration",
  );
});

Deno.test("companion cinema migration installs finite defaults without escalating existing budgets", () => {
  assertStringIncludes(
    sql,
    "('feature', 'ai_companion_cinema', TRUE, 2500.00",
  );
  assert(
    !sql.includes(
      "monthly_budget_usd = GREATEST(public.cost_guardrail_config.monthly_budget_usd",
    ),
    "migration must not silently raise an operator-managed cost ceiling",
  );
  assertStringIncludes(sql, "('watch', 4, 60)");
  assertStringIncludes(sql, "('hunt', 1, 8)");
  assertStringIncludes(sql, "('forge', 1, 8)");
});

Deno.test("companion cinema migration exposes only safe status metadata to users", () => {
  assertStringIncludes(sql, "public.get_companion_cinema_statuses");
  assertStringIncludes(
    sql,
    "REVOKE ALL ON FUNCTION public.enqueue_cosmiq_cinema_event_internal",
  );
  assertStringIncludes(
    sql,
    "REVOKE ALL ON FUNCTION public.request_next_cosmiq_cinema_event",
  );
  assertStringIncludes(
    sql,
    "REVOKE ALL ON FUNCTION public.register_user_storage_asset",
  );
  assert(
    !sql.includes(
      "GRANT EXECUTE ON FUNCTION public.request_next_cosmiq_cinema_event(UUID) TO authenticated",
    ),
    "rollout-ineligible authenticated users must not be able to fill the cinema queue directly",
  );
  assertStringIncludes(
    sql,
    "WHERE companion.id = event.companion_id",
  );
  assert(
    !sql.includes(
      "GRANT SELECT ON public.companion_cinema_renders TO authenticated",
    ),
    "raw private render candidates must stay service-only",
  );
});
