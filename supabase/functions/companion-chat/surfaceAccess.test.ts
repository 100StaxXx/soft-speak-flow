import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeCompanionChatSurface,
  surfaceRequiresPremiumAccess,
} from "./surfaceAccess.ts";

Deno.test("defaults to the premium companion surface", () => {
  assertEquals(normalizeCompanionChatSurface(undefined), "companion");
  assertEquals(normalizeCompanionChatSurface(null), "companion");
});

Deno.test("preserves the journeys surface", () => {
  assertEquals(normalizeCompanionChatSurface("journeys"), "journeys");
});

Deno.test("requires premium everywhere except journeys", () => {
  assertEquals(surfaceRequiresPremiumAccess("companion"), true);
  assertEquals(surfaceRequiresPremiumAccess("journeys"), false);
});
