import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const sourcePath = new URL("./index.ts", import.meta.url);

Deno.test("journey schedules resolve the trusted account product before selecting guidance", async () => {
  const source = await Deno.readTextFile(sourcePath);

  assert(source.includes("resolveUserProductMode(supabase, auth.userId)"));
  assert(source.includes('productMode === "graceward"'));
  assert(source.includes("COSMIQ PRODUCT BOUNDARY"));
  assert(
    source.includes(
      "Do not add Christian, biblical, prayer, church, pastoral, or Graceward-specific language",
    ),
  );
});

Deno.test("journey schedules retain deterministic fallbacks for provider outages", async () => {
  const source = await Deno.readTextFile(sourcePath);

  assert(source.includes("createFallbackScheduleResponse"));
  assert(
    source.includes("Provider request failed; using deterministic fallback"),
  );
  assert(source.includes('"X-Cosmiq-Plan-Source": "fallback"'));
  assert(
    source.includes("if (isCostGuardrailBlockedError(error)) throw error"),
  );
});
