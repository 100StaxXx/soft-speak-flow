import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildGracewardFormationMemory,
  resolveGracewardCompanionStoryChapter,
} from "./gracewardCompanionStory.ts";

Deno.test("Graceward story chapters follow the live eight-form progression", () => {
  assertEquals(resolveGracewardCompanionStoryChapter(0).chapterTitle, "The Quiet Spark");
  assertEquals(resolveGracewardCompanionStoryChapter(5).visualStage, 2);
  assertEquals(resolveGracewardCompanionStoryChapter(36).formName, "Flourishing");
  assertEquals(resolveGracewardCompanionStoryChapter(81).chapterTitle, "The Everward Horizon");
  assertEquals(resolveGracewardCompanionStoryChapter(999).visualStage, 7);
});

Deno.test("formation memory connects Guide choices without inventing practice completion", () => {
  const memory = buildGracewardFormationMemory([
    {
      thread_date: "2026-08-09",
      mentor_name: "Ezra",
      focus_label: "Courage",
      companion_answer_label: "A smaller step",
      encouragement_completed_at: "2026-08-09T08:00:00.000Z",
      practice_completed_at: null,
      evening_reflected_at: "2026-08-09T20:00:00.000Z",
    },
  ]);

  assertStringIncludes(memory, "chose “Courage”");
  assertStringIncludes(memory, "Guide's encouragement");
  assertStringIncludes(memory, "evening reflection");
  assertEquals(memory.includes("carried a daily practice into action"), false);
});
