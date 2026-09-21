import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleProcessCompanionCinemaEvent, isCosmiqCinemaProductMode } from "./index.ts";
// Include endpoint preparation coverage in the standard function test runner.
import "../../production-baseline/20260920-companion/supabase/functions/_shared/companionHatchScene.test.ts";

Deno.test("cinema deployment preserves internal-authenticated gateway configuration", async () => {
  const config = await Deno.readTextFile(new URL("../../config.toml", import.meta.url));
  const section = config.split("[functions.process-companion-cinema-event]")[1]?.split("[")[0];
  assertEquals(section?.includes("verify_jwt = false"), true);
});

Deno.test("cinema entry point preserves the Cosmiq-only product boundary", () => {
  assertEquals(typeof handleProcessCompanionCinemaEvent, "function");
  assertEquals(isCosmiqCinemaProductMode("cosmiq"), true);
  for (const product of ["graceward", null, undefined, ""]) {
    assertEquals(isCosmiqCinemaProductMode(product), false);
  }
});
