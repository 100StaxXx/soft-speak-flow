import { describe, expect, it } from "vitest";

import { getMentorVoiceConfig, mentorVoices } from "./mentorVoices";

describe("mentorVoices", () => {
  it("provides voice configs for the active mentor lineup", () => {
    for (const slug of ["sage", "lyra", "icon", "charles", "princess", "operator", "rival"]) {
      expect(mentorVoices[slug]).toBeDefined();
      expect(mentorVoices[slug]?.voiceId).toBeTruthy();
      expect(mentorVoices[slug]?.mentorSlug).toBe(slug);
    }
  });

  it("resolves legacy slugs to the renamed mentor voice config", () => {
    expect(getMentorVoiceConfig("atlas")?.mentorSlug).toBe("sage");
    expect(getMentorVoiceConfig("elizabeth")?.mentorSlug).toBe("charles");
    expect(getMentorVoiceConfig("stryker")?.mentorSlug).toBe("operator");
  });
});
