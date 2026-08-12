import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCosmicPostcardImagePrompt,
  getPostcardSpeciesType,
  type PostcardLocation,
  resolvePostcardTier,
  selectDeterministicPostcardLocation,
} from "./cosmicPostcard.ts";

Deno.test("resolves custom milestone percentages to the nearest completed tier", () => {
  assertEquals(resolvePostcardTier(10), 25);
  assertEquals(resolvePostcardTier(40), 50);
  assertEquals(resolvePostcardTier(70), 75);
  assertEquals(resolvePostcardTier(85), 100);
});

Deno.test("selects a stable compatible location and avoids prior locations", () => {
  const locations: PostcardLocation[] = [
    { name: "Ocean", description: "water", tags: ["aquatic"] },
    { name: "Prairie", description: "grass", tags: ["land"] },
    { name: "Garden", description: "stars", tags: ["all"] },
  ];
  const input = {
    locations: [...locations],
    speciesType: getPostcardSpeciesType("Sea Turtle"),
    seed: "user:epic:companion:40",
    excludedNames: ["Ocean"],
  };

  const first = selectDeterministicPostcardLocation(input);
  const second = selectDeterministicPostcardLocation(input);
  assertEquals(first, second);
  assertEquals(first.name, "Garden");
});

Deno.test("postcard prompt locks identity and prohibits printed artifacts", () => {
  const prompt = buildCosmicPostcardImagePrompt({
    location: {
      name: "Nebula Gardens",
      description: "a violet stellar nursery",
    },
    companion: {
      spiritAnimal: "Fox",
      coreElement: "Fire",
      favoriteColor: "violet",
      eyeColor: "gold",
      furColor: "silver",
    },
  });

  assertMatch(prompt, /One companion only/i);
  assertMatch(prompt, /full body at roughly 35–45%/i);
  assertMatch(prompt, /Text, letters, captions, logos, watermarks/i);
  assertMatch(prompt, /never a redesign or evolution/i);
  assertMatch(prompt, /same production art bible/i);
});
