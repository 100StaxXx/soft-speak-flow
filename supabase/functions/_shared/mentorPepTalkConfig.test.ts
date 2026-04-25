import {
  ACTIVE_MENTOR_SLUGS,
  getMentorThemes,
  resolveMentorSlug,
  selectThemeForDate,
} from "./mentorPepTalkConfig.ts";
import { getMentorNarrativeProfile } from "./mentorNarrativeProfiles.ts";
import { resolveMentorVoiceConfig, resolveTutorialVoice } from "./mentorVoiceConfig.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("mentor pep talk config resolves active mentor themes", () => {
  for (const mentorSlug of ACTIVE_MENTOR_SLUGS) {
    const themes = getMentorThemes(mentorSlug);
    assert(themes.length > 0, `Expected themes for ${mentorSlug}`);
    assert(
      themes.every((theme) =>
        typeof theme.topic_category === "string" &&
        theme.topic_category.length > 0 &&
        typeof theme.intensity === "string" &&
        theme.intensity.length > 0 &&
        Array.isArray(theme.triggers) &&
        theme.triggers.length > 0
      ),
      `Expected complete theme entries for ${mentorSlug}`,
    );
  }
});

Deno.test("mentor pep talk config includes Lyra across backend mentor surfaces", () => {
  assert(ACTIVE_MENTOR_SLUGS.includes("lyra"), "Expected Lyra to be active for backend generation");
  assert(resolveMentorSlug("lyra") === "lyra", "Expected Lyra to resolve as a supported mentor");

  const themes = getMentorThemes("lyra");
  assert(themes.some((theme) => theme.topic_category === "strategy"), "Expected Lyra strategy themes");

  const voiceConfig = resolveMentorVoiceConfig("lyra");
  assert(Boolean(voiceConfig?.voiceId), "Expected Lyra to have a mentor voice config");
  assert(
    voiceConfig?.voiceId === "fgDJOgmENIR82PueQrVs",
    "Expected Lyra to use her dedicated ElevenLabs voice",
  );
  assert(resolveTutorialVoice("lyra") === "nova", "Expected Lyra to resolve a tutorial voice");

  const narrativeProfile = getMentorNarrativeProfile("lyra");
  assert(narrativeProfile?.storyRole === "synthetic_oracle", "Expected Lyra narrative profile");
});

Deno.test("mentor pep talk config resolves legacy aliases", () => {
  const resolved = resolveMentorSlug("elizabeth");
  assert(resolved === "charles", "Expected elizabeth alias to map to charles");
});

Deno.test("mentor pep talk config uses deterministic theme selection", () => {
  const date = new Date("2026-02-22T00:00:00.000Z");
  const first = selectThemeForDate("sage", date);
  const second = selectThemeForDate("sage", date);

  assert(first.theme.topic_category === second.theme.topic_category, "Theme should be stable for same date");
  assert(first.theme.intensity === second.theme.intensity, "Intensity should be stable for same date");
});

Deno.test("mentor pep talk config provides safe fallback for unknown mentors", () => {
  const selected = selectThemeForDate("unknown-mentor", new Date("2026-02-22T00:00:00.000Z"));
  assert(selected.usedFallbackTheme, "Expected fallback theme for unknown mentor");
  assert(selected.theme.topic_category === "mindset", "Expected fallback topic category");
});
