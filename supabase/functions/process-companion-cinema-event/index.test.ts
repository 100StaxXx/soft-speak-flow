import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleProcessCompanionCinemaEvent, isCosmiqCinemaProductMode } from "./index.ts";
// Include endpoint preparation coverage in the standard function test runner.
import "../../production-baseline/20260920-companion/supabase/functions/_shared/companionHatchScene.test.ts";

Deno.test("cinema entry point preserves the Cosmiq-only product boundary", () => {
  assertEquals(typeof handleProcessCompanionCinemaEvent, "function");
  assertEquals(isCosmiqCinemaProductMode("cosmiq"), true);
  for (const product of ["graceward", null, undefined, ""]) {
    assertEquals(isCosmiqCinemaProductMode(product), false);
  }
});
