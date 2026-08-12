import { describe, expect, it } from "vitest";
import {
  buildPostcardDiscoveries,
  buildPostcardLivingNarrativePrompt,
  buildStoryLivingNarrativePrompt,
} from "./livingNarrative";
import type { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import type { CompanionStory } from "@/hooks/useCompanionStory";

const story: CompanionStory = {
  id: "story-1",
  companion_id: "companion-1",
  user_id: "user-1",
  stage: 13,
  chapter_title: "The Glass Signal",
  intro_line: "A bell rang under the ice.",
  main_story: "The observatory opened.",
  bond_moment: "They matched their breathing to the signal.",
  life_lesson: "Attention turns uncertainty into a path.",
  lore_expansion: ["World Truth: Winter glass stores starlight."],
  next_hook: "A fourth note answered beyond the ridge.",
  tone_preference: "epic_adventure",
  generated_at: "2026-08-09T00:00:00.000Z",
};

const postcard: CompanionPostcard = {
  id: "postcard-1",
  user_id: "user-1",
  companion_id: "companion-1",
  epic_id: "epic-1",
  milestone_percent: 50,
  location_name: "The Mirror Sea",
  location_description: "A silver ocean reflecting distant galaxies.",
  image_url: "https://example.com/postcard.png",
  caption: "Greetings from the Mirror Sea",
  generated_at: "2026-08-09T00:00:00.000Z",
  created_at: "2026-08-09T00:00:00.000Z",
  chapter_number: 4,
  chapter_title: "The Silver Answer",
  story_content: "A ripple crossed the sea.",
  clue_text: "The reflected constellation is missing one star.",
  prophecy_line: "When the mirror darkens, follow the absent light.",
  characters_featured: [],
  seeds_planted: [],
  is_finale: false,
  location_revealed: true,
};

describe("living narrative prompt builders", () => {
  it("turns a story into three distinct, consequential choices", () => {
    const prompt = buildStoryLivingNarrativePrompt({
      story,
      companionName: "Kiri",
      chapterLabel: "Awakened",
    });

    expect(prompt.question).toContain("Kiri");
    expect(prompt.options.map((option) => option.key)).toEqual(["wisdom", "bond", "signal"]);
    expect(prompt.options.every((option) => option.memorySummary.length > 20)).toBe(true);
    expect(prompt.options.every((option) => option.sideQuestTitle)).toBe(true);
  });

  it("uses postcard clues and prophecy as interactive choices and discoveries", () => {
    const prompt = buildPostcardLivingNarrativePrompt({ postcard, companionName: "Kiri" });
    const discoveries = buildPostcardDiscoveries(postcard);

    expect(prompt.options.map((option) => option.key)).toEqual(["place", "clue", "prophecy"]);
    expect(discoveries.map((discovery) => discovery.key)).toEqual(["place", "clue", "prophecy"]);
    expect(discoveries[1]?.text).toContain("missing one star");
  });
});
