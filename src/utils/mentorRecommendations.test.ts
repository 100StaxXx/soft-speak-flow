import { describe, expect, it } from "vitest";

import {
  collectMentorTraits,
  getMentorRecommendations,
  getMoodTraits,
} from "./mentorRecommendations";

describe("mentorRecommendations", () => {
  const mentors = [
    {
      id: "atlas",
      name: "Atlas",
      slug: "atlas",
      tags: ["tough_love", "discipline"],
      themes: ["calm"],
      tone_description: "Direct, grounded, calm under pressure",
      short_title: "Stoic Builder",
    },
    {
      id: "sienna",
      name: "Sienna",
      slug: "sienna",
      tags: ["healing", "gentle"],
      themes: ["self_worth"],
      tone_description: "Gentle and deeply supportive",
      short_title: "Soft Guide",
    },
    {
      id: "reign",
      name: "Reign",
      slug: "reign",
      tags: ["high_energy"],
      themes: ["confidence"],
      tone_description: "Bold, motivating, and elite",
      short_title: "Performance Queen",
    },
  ];

  it("maps moods to the planned canonical traits", () => {
    expect(getMoodTraits("overthinking")).toEqual(["calm", "healing"]);
    expect(getMoodTraits("focused")).toEqual(["discipline", "calm"]);
    expect(getMoodTraits("unknown")).toEqual([]);
  });

  it("collects mentor traits from metadata and fallback slugs", () => {
    expect(collectMentorTraits(mentors[0])).toEqual(
      expect.arrayContaining(["discipline", "calm"]),
    );
    expect(collectMentorTraits(mentors[1])).toEqual(
      expect.arrayContaining(["healing", "supportive"]),
    );
  });

  it("returns deterministic recommendations with reason labels", () => {
    const recommendations = getMentorRecommendations(mentors, "overthinking", 2);

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0].mentor.name).toBe("Sienna");
    expect(recommendations[0].reasonLabel).toBe("Best for overthinking");
    expect(recommendations[1].mentor.name).toBe("Atlas");
    expect(recommendations[1].reasonLabel).toBe("Strong fit for overthinking");
  });

  it("falls back to trait-based copy when only the secondary trait matches", () => {
    const recommendations = getMentorRecommendations(
      [
        {
          id: "mentor-1",
          name: "Solace",
          slug: "solace",
          tags: ["supportive"],
          themes: [],
          tone_description: "",
        },
      ],
      "unmotivated",
    );

    expect(recommendations[0]?.reasonLabel).toBe("Good when you want support");
  });
});
