import { describe, expect, it } from "vitest";

import {
  collectMentorTraits,
  getMentorRecommendations,
  getMoodTraits,
} from "./mentorRecommendations";

describe("mentorRecommendations", () => {
  const mentors = [
    {
      id: "sage",
      name: "The Sage",
      slug: "sage",
      tags: ["calm", "discipline"],
      themes: ["calm"],
      tone_description: "Calm, wise, and grounded",
      short_title: "Quiet Clarity",
    },
    {
      id: "princess",
      name: "The Princess",
      slug: "princess",
      tags: ["healing", "gentle"],
      themes: ["self_worth"],
      tone_description: "Gentle and deeply supportive",
      short_title: "Soft Discipline",
    },
    {
      id: "rival",
      name: "The Rival",
      slug: "rival",
      tags: ["high_energy"],
      themes: ["confidence"],
      tone_description: "Competitive and intense",
      short_title: "Prove It",
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
    expect(recommendations[0].mentor.name).toBe("The Sage");
    expect(recommendations[0].reasonLabel).toBe("Best for overthinking");
    expect(recommendations[1].mentor.name).toBe("The Princess");
    expect(recommendations[1].reasonLabel).toBe("Good when you want healing");
  });

  it("falls back to trait-based copy when only the secondary trait matches", () => {
    const recommendations = getMentorRecommendations(
      [
        {
          id: "mentor-1",
          name: "The Princess",
          slug: "princess",
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
