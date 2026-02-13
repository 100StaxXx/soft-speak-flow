import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildJourneyPathPrompt, deriveMilestoneVisualTokens } from "./promptContext.ts";

Deno.test("deriveMilestoneVisualTokens is deterministic per milestone index", () => {
  const first = deriveMilestoneVisualTokens(3);
  const second = deriveMilestoneVisualTokens(3);
  assertEquals(first, second);
});

Deno.test("buildJourneyPathPrompt includes progression tokens and safety constraints", () => {
  const { prompt, visualTokens } = buildJourneyPathPrompt({
    worldContext: {
      worldName: "Aetherwild",
      worldEra: "The Prism Age",
      currentLocation: "Echo Basin",
      nextLocation: "Celestial Gate",
    },
    visualTheme: "epic landscapes, dramatic cliffs, heroic vistas",
    companionType: "fox",
    coreElement: "light",
    themeColor: "violet",
    milestoneIndex: 2,
  });

  assertStringIncludes(prompt, visualTokens.timeOfDay);
  assertStringIncludes(prompt, visualTokens.weatherMood);
  assertStringIncludes(prompt, visualTokens.pathComplexity);
  assertStringIncludes(prompt, visualTokens.chapterAtmosphere);
  assertStringIncludes(prompt, "no text");
  assertStringIncludes(prompt, "no visible characters");
});
