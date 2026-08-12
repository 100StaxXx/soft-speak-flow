function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const migrationUrl = new URL(
  "../../migrations/20260811200000_hybrid_daily_formation.sql",
  import.meta.url,
);

Deno.test("the reviewed catalog expands to ninety category-bound practices", async () => {
  const source = await Deno.readTextFile(migrationUrl);

  assert(
    source.includes("CREATE TABLE public.daily_formation_practice_catalog") &&
      source.includes("FROM generate_series(29, 50)") &&
      source.includes("FROM generate_series(51, 60)") &&
      source.includes("FROM generate_series(61, 72)") &&
      source.includes("'formation-90'"),
    "Expected the expanded reviewed catalog through formation-90",
  );
  assert(
    source.includes("v_catalog.category <> p_category") &&
      source.includes("focus IN ('exercise', 'nutrition')") &&
      source.includes("focus IN ('scripture', 'faith')"),
    "Expected catalog and focus boundaries to be enforced by the database",
  );
});

Deno.test("generated formation persistence is service-only and auditable", async () => {
  const source = await Deno.readTextFile(migrationUrl);

  assert(
    source.includes("practice_source text NOT NULL DEFAULT 'reviewed'") &&
      source.includes("generation_model text") &&
      source.includes("generation_prompt_version text") &&
      source.includes("scripture_reference text"),
    "Expected generated practices to retain source, model, prompt, and Scripture metadata",
  );
  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.prepare_generated_daily_formation_practice") &&
      source.includes("auth.role() IS DISTINCT FROM 'service_role'") &&
      source.includes("TO service_role"),
    "Expected only the validated server path to persist generated practices",
  );
});
