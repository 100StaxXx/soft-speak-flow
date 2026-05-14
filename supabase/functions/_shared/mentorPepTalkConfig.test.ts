import {
  ACTIVE_MENTOR_SLUGS,
  getMentorThemes,
  resolveMentorSlug,
  selectThemeForDate,
} from "./mentorPepTalkConfig.ts";
import {
  LEGACY_MENTOR_ALIASES,
  LEGACY_SUPPORTED_MENTOR_SLUGS,
  resolveSupportedMentorSlug,
  type SupportedMentorSlug,
} from "./mentorRoster.ts";
import { getMentorNarrativeProfile } from "./mentorNarrativeProfiles.ts";
import {
  ELEVENLABS_MENTOR_TTS_MODEL,
  ELEVENLABS_MENTOR_VOICES,
  OPENAI_TUTORIAL_VOICE_MAP,
  resolveMentorVoiceConfig,
  resolveTutorialVoice,
} from "./mentorVoiceConfig.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const EXPECTED_VOICE_IDS: Record<SupportedMentorSlug, string> = {
  sage: "mcuuWJIofmzgKEGk3EMA",
  lyra: "54YYBuRuAG6KJooiOhFI",
  icon: "6p0P6gezgvY1v6xbLzmU",
  charles: "jRAAK67SEFE9m7ci5DhD",
  princess: "uIZsnBL0YK1S5j69bAih",
  operator: "pNInz6obpgDQGcFmaJgB",
  rival: "V33LkP9pVLdcjeB2y5Na",
  reign: "GTQ4ImqrRljZAa9VJX6B",
};

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

Deno.test("mentor pep talk config provides voices for all supported mentors", () => {
  assert(
    ELEVENLABS_MENTOR_TTS_MODEL === "eleven_v3",
    "Expected mentor voices to use ElevenLabs v3",
  );

  for (
    const mentorSlug of [
      ...ACTIVE_MENTOR_SLUGS,
      ...LEGACY_SUPPORTED_MENTOR_SLUGS,
    ]
  ) {
    const voiceConfig = resolveMentorVoiceConfig(mentorSlug);
    assert(
      ELEVENLABS_MENTOR_VOICES[mentorSlug]?.voiceId ===
        EXPECTED_VOICE_IDS[mentorSlug],
      `Expected ${mentorSlug} to use the intended ElevenLabs voice`,
    );
    assert(
      Boolean(voiceConfig?.voiceId),
      `Expected ${mentorSlug} to have a mentor voice config`,
    );
    assert(
      voiceConfig?.voiceId === EXPECTED_VOICE_IDS[mentorSlug],
      `Expected ${mentorSlug} to resolve the intended ElevenLabs voice`,
    );
    assert(
      typeof voiceConfig?.speed === "number" && voiceConfig.speed >= 0.7 &&
        voiceConfig.speed <= 1.2,
      `Expected ${mentorSlug} to have a valid ElevenLabs speech speed`,
    );
    assert(
      typeof OPENAI_TUTORIAL_VOICE_MAP[mentorSlug] === "string" &&
        OPENAI_TUTORIAL_VOICE_MAP[mentorSlug].length > 0,
      `Expected ${mentorSlug} to have a tutorial voice map entry`,
    );
    assert(
      resolveTutorialVoice(mentorSlug) !== "alloy",
      `Expected ${mentorSlug} to have a tutorial voice`,
    );
  }
});

Deno.test("mentor voice config resolves canonical slugs and legacy aliases", () => {
  for (const [mentorSlug, voiceId] of Object.entries(EXPECTED_VOICE_IDS)) {
    assert(
      resolveSupportedMentorSlug(mentorSlug) === mentorSlug,
      `Expected ${mentorSlug} to resolve directly before alias fallback`,
    );
    assert(
      resolveMentorVoiceConfig(mentorSlug)?.voiceId === voiceId,
      `Expected ${mentorSlug} to resolve to ${voiceId}`,
    );
  }

  for (const [alias, canonicalSlug] of Object.entries(LEGACY_MENTOR_ALIASES)) {
    assert(
      resolveSupportedMentorSlug(alias) === canonicalSlug,
      `Expected ${alias} to resolve to ${canonicalSlug}`,
    );
    assert(
      resolveMentorVoiceConfig(alias)?.voiceId ===
        EXPECTED_VOICE_IDS[canonicalSlug],
      `Expected ${alias} to resolve to the ${canonicalSlug} voice`,
    );
  }
});

Deno.test("mentor pep talk config includes Lyra across backend mentor surfaces", () => {
  assert(
    ACTIVE_MENTOR_SLUGS.includes("lyra"),
    "Expected Lyra to be active for backend generation",
  );
  assert(
    resolveMentorSlug("lyra") === "lyra",
    "Expected Lyra to resolve as a supported mentor",
  );

  const themes = getMentorThemes("lyra");
  assert(
    themes.some((theme) => theme.topic_category === "strategy"),
    "Expected Lyra strategy themes",
  );

  const voiceConfig = resolveMentorVoiceConfig("lyra");
  assert(
    Boolean(voiceConfig?.voiceId),
    "Expected Lyra to have a mentor voice config",
  );
  assert(
    voiceConfig?.voiceId === "54YYBuRuAG6KJooiOhFI",
    "Expected Lyra to use her dedicated ElevenLabs voice",
  );
  assert(
    resolveTutorialVoice("lyra") === "nova",
    "Expected Lyra to resolve a tutorial voice",
  );

  const narrativeProfile = getMentorNarrativeProfile("lyra");
  assert(
    narrativeProfile?.storyRole === "synthetic_oracle",
    "Expected Lyra narrative profile",
  );
});

Deno.test("mentor voice config keeps Princess pep talks brisker than default", () => {
  const voiceConfig = resolveMentorVoiceConfig("princess");
  assert(
    voiceConfig?.speed === 1.2,
    "Expected Princess voice speed to use the fastest supported ElevenLabs setting",
  );
});

Deno.test("mentor pep talk config resolves legacy aliases", () => {
  const resolved = resolveMentorSlug("elizabeth");
  assert(resolved === "charles", "Expected elizabeth alias to map to charles");
});

Deno.test("mentor pep talk config uses deterministic theme selection", () => {
  const date = new Date("2026-02-22T00:00:00.000Z");
  const first = selectThemeForDate("sage", date);
  const second = selectThemeForDate("sage", date);

  assert(
    first.theme.topic_category === second.theme.topic_category,
    "Theme should be stable for same date",
  );
  assert(
    first.theme.intensity === second.theme.intensity,
    "Intensity should be stable for same date",
  );
});

Deno.test("mentor pep talk config provides safe fallback for unknown mentors", () => {
  const selected = selectThemeForDate(
    "unknown-mentor",
    new Date("2026-02-22T00:00:00.000Z"),
  );
  assert(
    selected.usedFallbackTheme,
    "Expected fallback theme for unknown mentor",
  );
  assert(
    selected.theme.topic_category === "mindset",
    "Expected fallback topic category",
  );
});
