import { describe, expect, it } from "vitest";

import {
  ACTIVE_MENTOR_SLUGS,
  LEGACY_MENTOR_ALIASES,
  LEGACY_ONLY_MENTOR_SLUGS,
} from "@/lib/mentorRoster";
import { ELEVENLABS_MENTOR_VOICES } from "../../supabase/functions/_shared/mentorVoiceConfig.ts";
import { getMentorVoiceConfig, mentorVoices } from "./mentorVoices";

describe("mentorVoices", () => {
  it("matches backend voice IDs for every active and legacy supported mentor", () => {
    for (const slug of [...ACTIVE_MENTOR_SLUGS, ...LEGACY_ONLY_MENTOR_SLUGS]) {
      expect(mentorVoices[slug]).toBeDefined();
      expect(mentorVoices[slug]?.voiceId).toBe(
        ELEVENLABS_MENTOR_VOICES[slug]?.voiceId,
      );
      expect(mentorVoices[slug]?.mentorSlug).toBe(slug);
    }
  });

  it("resolves legacy slugs to the canonical backend voice config", () => {
    for (
      const [legacySlug, canonicalSlug] of Object.entries(LEGACY_MENTOR_ALIASES)
    ) {
      expect(getMentorVoiceConfig(legacySlug)?.mentorSlug).toBe(canonicalSlug);
      expect(getMentorVoiceConfig(legacySlug)?.voiceId).toBe(
        ELEVENLABS_MENTOR_VOICES[canonicalSlug]?.voiceId,
      );
    }
  });
});
