import { describe, expect, it } from "vitest";
import { generateMentorExplanation } from "./mentorExplanation";

const mentor = {
  id: "mentor-1",
  slug: "atlas",
  name: "Atlas",
  short_title: "Stoic Strategist",
  tone_description: "Direct and calm",
  target_user: "users who need structure",
  themes: ["discipline", "focus"],
};

describe("generateMentorExplanation", () => {
  it("uses current questionnaire keys (focus_area + guidance_tone + mentor_energy)", () => {
    const result = generateMentorExplanation(mentor, {
      focus_area: "discipline",
      guidance_tone: "supportive",
      mentor_energy: "masculine_preference",
    });

    expect(result.paragraph).toContain("You're focused on building discipline");
    expect(result.paragraph).toContain("prefer supportive growth");
    expect(result.paragraph).toContain("asked for masculine mentor energy");
  });

  it("keeps backward compatibility with legacy keys", () => {
    const result = generateMentorExplanation(mentor, {
      growth_focus: "discipline",
      guidance_style: "direct",
    });

    expect(result.paragraph).toContain("You're focused on building discipline");
    expect(result.paragraph).toContain("prefer straightforward guidance");
  });

  it("falls back when growth/guidance tags are missing", () => {
    const result = generateMentorExplanation(mentor, {});
    expect(result.paragraph).toContain("Atlas is direct and calm and is best for users who need structure.");
  });
});
