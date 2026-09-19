Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const { normalizeAuthProductMode } = await import("./supabase/functions/auth-gateway/index.ts");
Deno.test("legacy clients default to Cosmiq; explicit Graceward remains isolated", () => {
  for (const value of [undefined, null, "cosmiq"]) {
    if (normalizeAuthProductMode(value) !== "cosmiq") throw new Error("Legacy product regression");
  }
  if (normalizeAuthProductMode("graceward") !== "graceward") throw new Error("Graceward boundary regression");
});
