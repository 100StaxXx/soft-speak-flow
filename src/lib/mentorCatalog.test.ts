import { describe, expect, it } from "vitest";

import { buildBrowseMentorCatalog, type MentorBrowseEntry } from "./mentorCatalog";

const ACTIVE_MENTORS: MentorBrowseEntry[] = [
  {
    id: "sage-id",
    name: "The Sage",
    slug: "sage",
    archetype: "Calm clarity",
    short_title: "Quiet Clarity",
    tone_description: "Calm and clear",
    style_description: "Reflective and grounded",
    target_user: "Overwhelmed thinkers",
    signature_line: "Peace comes before progress.",
    primary_color: "#8F7DD6",
    avatar_url: null,
    themes: ["clarity"],
    availability: "active",
  },
  {
    id: "lyra-id",
    name: "Lyra",
    slug: "lyra",
    archetype: "Guide",
    short_title: null,
    tone_description: null,
    style_description: null,
    target_user: null,
    signature_line: null,
    primary_color: "#A855F7",
    avatar_url: null,
    themes: [],
    availability: "active",
  },
  {
    id: "operator-id",
    name: "The Operator",
    slug: "operator",
    archetype: "Precision",
    short_title: "Elite Execution",
    tone_description: "Controlled and exact",
    style_description: "Systems-first pressure",
    target_user: "Builders",
    signature_line: "Your current system lacks structure.",
    primary_color: "#0EA5E9",
    avatar_url: null,
    themes: ["execution"],
    availability: "active",
  },
];

describe("mentorCatalog", () => {
  it("treats Lyra as an active mentor and only appends The Guy as upcoming", () => {
    const result = buildBrowseMentorCatalog(ACTIVE_MENTORS);

    expect(result.map((mentor) => mentor.slug)).toEqual(["sage", "lyra", "operator", "the-guy"]);

    expect(result.find((mentor) => mentor.slug === "lyra")).toMatchObject({
      availability: "active",
      short_title: "Synthetic Oracle",
      signature_line: "The pattern is already there. I will help you see it.",
      themes: ["signal", "clarity", "future-facing"],
    });

    expect(result.filter((mentor) => mentor.availability === "upcoming_unlockable")).toEqual([
      expect.objectContaining({
        slug: "the-guy",
        name: "The Guy",
        availability: "upcoming_unlockable",
      }),
    ]);
  });

  it("does not append The Guy as upcoming when he is already active", () => {
    const result = buildBrowseMentorCatalog([
      ...ACTIVE_MENTORS,
      {
        id: "the-guy-id",
        name: "The Guy",
        slug: "the-guy",
        archetype: "Field commander",
        short_title: "Field Commander",
        tone_description: "Direct and tactical",
        style_description: "Mission-first coaching",
        target_user: "People who want decisive pressure",
        signature_line: "You need a plan and the will to execute it.",
        primary_color: "#C26B3C",
        avatar_url: null,
        themes: ["discipline"],
        availability: "active",
      },
    ]);

    expect(result.filter((mentor) => mentor.slug === "the-guy")).toEqual([
      expect.objectContaining({
        id: "the-guy-id",
        availability: "active",
      }),
    ]);
  });
});
