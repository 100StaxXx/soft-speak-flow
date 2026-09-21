function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("trusted account metadata owns profile and companion product identity", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../migrations/20260819113000_bind_profile_and_companion_product_to_account.sql",
      import.meta.url,
    ),
  );

  assert(
    sql.includes("raw_app_meta_data ->> 'auth_product_mode'") &&
      sql.includes("NEW.product_mode := v_account_product_mode"),
    "Expected companion ownership to come from trusted auth app metadata",
  );
  assert(
    sql.includes("preset_id is no") &&
      sql.includes("NEW.product_mode IN ('graceward', 'cosmiq')") &&
      !sql.includes("A Cosmiq preset companion cannot be attached to a Graceward account"),
    "Expected trusted account identity to survive Graceward premade hatch selection",
  );
  assert(
    sql.includes("CREATE TRIGGER profile_00_normalize_product_mode") &&
      sql.includes("jsonb_set") &&
      sql.includes("'{product_mode}'"),
    "Expected profile product identity to be stamped from trusted auth metadata",
  );
  assert(
    sql.includes("UPDATE public.profiles AS profile") &&
      sql.includes("FROM auth.users AS account") &&
      sql.includes("IS DISTINCT FROM account.raw_app_meta_data"),
    "Expected existing trusted profiles to be backfilled immediately",
  );
  assert(
    sql.includes("REVOKE ALL ON FUNCTION public.normalize_companion_product_mode() FROM PUBLIC") &&
      sql.includes("REVOKE ALL ON FUNCTION public.normalize_profile_product_mode() FROM PUBLIC"),
    "Expected product-binding helpers to stay unavailable to clients",
  );
});

Deno.test("daily encouragement catalogs are unique and queryable per product", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../migrations/20260819120000_scope_daily_pep_talks_by_product.sql",
      import.meta.url,
    ),
  );

  for (const table of ["daily_pep_talks", "pep_talks", "quotes"]) {
    assert(
      sql.includes(`ALTER TABLE public.${table}`) &&
        sql.includes("ADD COLUMN IF NOT EXISTS product_mode"),
      `Expected ${table} to carry a product_mode boundary`,
    );
  }

  assert(
    sql.includes("ON public.daily_pep_talks(product_mode, mentor_slug, for_date)"),
    "Expected daily encouragement uniqueness to include the product",
  );
  assert(
    sql.includes("CHECK (product_mode IN ('graceward', 'cosmiq'))"),
    "Expected content product values to be constrained",
  );
});
