import { describe, expect, it } from "vitest";

import { ACTIVE_MENTOR_SLUGS } from "@/lib/mentorRoster";
import { personalityTemplates } from "./useMentorPersonality";

describe("personalityTemplates", () => {
  it("provides microcopy for every active mentor", () => {
    for (const slug of ACTIVE_MENTOR_SLUGS) {
      const template = personalityTemplates[slug];

      expect(template, `missing template for ${slug}`).toBeDefined();
      expect(template.buttonText?.("Start")).toBeTruthy();
      expect(template.emptyState?.("today")).toBeTruthy();
      expect(template.encouragement?.()).toBeTruthy();
      expect(template.nudge?.()).toBeTruthy();
    }
  });

  it("gives Lyra signal-oriented microcopy instead of falling back to Sage", () => {
    expect(personalityTemplates.lyra?.nudge?.()).toContain("signal");
    expect(personalityTemplates.lyra?.encouragement?.()).toContain("pattern");
  });
});
