function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("Graceward premade hatch selection preserves trusted product identity", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "../../migrations/20260819143000_repair_graceward_premade_product_binding.sql",
      import.meta.url,
    ),
  );

  assert(
    sql.includes("v_account_product_mode IN ('graceward', 'cosmiq')") &&
      sql.includes("NEW.product_mode := v_account_product_mode"),
    "Expected trusted account metadata to own the companion product",
  );
  assert(
    sql.includes("NEW.product_mode IN ('graceward', 'cosmiq')") &&
      sql.indexOf("NEW.product_mode IN ('graceward', 'cosmiq')") <
        sql.indexOf("NEW.preset_id IS NOT NULL"),
    "Expected explicit legacy identity to win before preset inference",
  );
  assert(
    sql.includes("UPDATE public.user_companion AS companion") &&
      sql.includes("FROM auth.users AS account"),
    "Expected already misclassified trusted rows to be repaired",
  );
});
