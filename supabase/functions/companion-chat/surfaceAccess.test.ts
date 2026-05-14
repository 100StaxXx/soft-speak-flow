import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeCompanionChatSurface } from "./surfaceAccess.ts";

Deno.test("defaults to the companion surface", () => {
  assertEquals(normalizeCompanionChatSurface(undefined), "companion");
  assertEquals(normalizeCompanionChatSurface(null), "companion");
});

Deno.test("preserves the journeys surface", () => {
  assertEquals(normalizeCompanionChatSurface("journeys"), "journeys");
});
