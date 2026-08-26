import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateSpiritLockTextCompliance, resolveCompanionSpiritLockProfile } from "./companionSpiritLock.ts";
import { buildCompanionStoryFallback } from "./companionStoryFallback.ts";

const serializeStory = (story: ReturnType<typeof buildCompanionStoryFallback>) =>
  [
    story.chapter_title,
    story.intro_line,
    story.main_story,
    story.bond_moment,
    story.life_lesson,
    ...story.lore_expansion,
    story.next_hook,
  ].join(" ");

Deno.test("provider fallback keeps the prologue inside the egg", () => {
  const story = buildCompanionStoryFallback({
    stage: 0,
    userName: "Ari",
    species: "Lion",
    element: "Light",
    chapterTitle: "The Quiet Spark",
    chapterTheme: "a living beginning",
    worldScale: "one intimate place",
    isCosmiqCompanion: false,
  });

  assertEquals(story.chapter_title, "The First Answer");
  assert(story.main_story.includes("does not hatch"));
  assert(story.main_story.includes("no formed creature"));
  assert(!story.main_story.toLowerCase().includes("lion"));
  assert(story.main_story.length >= 100);
  assert(story.main_story.length <= 1500);
  assertEquals(story.lore_expansion.length, 3);
});

Deno.test("provider fallback preserves the Mechanical Dragon hard lock", () => {
  const story = buildCompanionStoryFallback({
    stage: 5,
    userName: "Ari",
    species: "Mechanical Dragon",
    element: "Fire",
    chapterTitle: "The Listening Path",
    chapterTheme: "curiosity shaped by practice",
    worldScale: "a widening path",
    isCosmiqCompanion: true,
  });
  const profile = resolveCompanionSpiritLockProfile("Mechanical Dragon");

  assert(profile);
  const compliance = evaluateSpiritLockTextCompliance(serializeStory(story), profile);
  assertEquals(compliance.isCompliant, true);
  assert(story.main_story.length >= 100);
  assert(story.main_story.length <= 1500);
});
