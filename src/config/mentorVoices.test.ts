import { describe, expect, it } from "vitest";

import { getMentorVoiceConfig, mentorVoices } from "./mentorVoices";

describe("mentorVoices", () => {
  it("provides voice configs for the active mentor lineup", () => {
    expect(Object.keys(mentorVoices)).toEqual([
      "sage",
      "lyra",
      "icon",
      "charles",
      "princess",
      "operator",
      "rival",
    ]);

    for (const slug of ["sage", "lyra", "icon", "charles", "princess", "operator", "rival"]) {
      expect(mentorVoices[slug]).toBeDefined();
      expect(mentorVoices[slug]?.voiceId).toBeTruthy();
      expect(mentorVoices[slug]?.mentorSlug).toBe(slug);
    }

    expect(mentorVoices.charles.voiceId).toBe("7iAGWaZOtZujCYrDewVi");
    expect(mentorVoices.lyra.voiceId).toBe("fgDJOgmENIR82PueQrVs");
  });

  it("rejects unsupported mentor voice lookups", () => {
    expect(getMentorVoiceConfig("legacy-alpha")).toBeNull();
    expect(getMentorVoiceConfig("legacy-beta")).toBeNull();
    expect(getMentorVoiceConfig("placeholder")).toBeNull();
    expect(getMentorVoiceConfig("retired-guide")).toBeNull();
  });
});
