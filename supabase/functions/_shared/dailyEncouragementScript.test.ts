import { validateChristianGuidanceOutput } from "./christianGuidancePolicy.ts";
import { buildLocalDailyEncouragementScript } from "./dailyEncouragementScript.ts";
import { ACTIVE_MENTOR_SLUGS, getMentorThemes } from "./mentorPepTalkConfig.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("authored daily encouragement fallback is safe and complete for every Guide theme", () => {
  for (const mentorSlug of ACTIVE_MENTOR_SLUGS) {
    for (const theme of getMentorThemes(mentorSlug)) {
      const script = buildLocalDailyEncouragementScript({
        mentorSlug,
        category: theme.topic_category,
        intensity: theme.intensity,
        emotionalTriggers: theme.triggers,
      });
      const safety = validateChristianGuidanceOutput(script);
      const sentenceCount = script.split(/[.!?]+\s*/).filter(Boolean).length;

      assert(safety.safe, `Expected safe fallback for ${mentorSlug}/${theme.topic_category}: ${safety.reason}`);
      assert(sentenceCount >= 8 && sentenceCount <= 12, `Expected 8-12 sentences, got ${sentenceCount}`);
      assert(script.includes("God’s grace"), "Expected the fallback to remain explicitly Christian");
    }
  }
});
