import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCompanionStoryTier } from "./companionStoryProgression.ts";

Deno.test("maps every Cosmiq story checkpoint to the unified progression tier", () => {
  const checkpoints = [0, 1, 5, 13, 21, 36, 56, 81];
  assertEquals(
    checkpoints.map((stage) => resolveCompanionStoryTier(stage).name),
    [
      "Egg",
      "Hatchling",
      "Initiate",
      "Awakened",
      "Guardian",
      "Champion",
      "Mythic",
      "Ascended",
    ],
  );
});

Deno.test("rejects legacy or invalid stages outside the 0–100 level system", () => {
  assertThrows(() => resolveCompanionStoryTier(-1));
  assertThrows(() => resolveCompanionStoryTier(101));
  assertThrows(() => resolveCompanionStoryTier(13.5));
});
