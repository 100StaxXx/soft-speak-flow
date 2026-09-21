import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  characterAlignmentToWords,
  forcedAlignmentToWords,
} from "./elevenLabsAlignment.ts";

Deno.test("characterAlignmentToWords groups characters and keeps punctuation", () => {
  const characters = [..."Grace, today."];
  const starts = characters.map((_, index) => index * 0.1);
  const ends = characters.map((_, index) => (index + 1) * 0.1);

  assertEquals(
    characterAlignmentToWords({
      characters,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    }),
    [
      { word: "Grace,", start: 0, end: 0.6000000000000001 },
      { word: "today.", start: 0.7000000000000001, end: 1.3 },
    ],
  );
});

Deno.test("characterAlignmentToWords rejects incomplete alignment arrays", () => {
  assertEquals(characterAlignmentToWords({
    characters: ["H", "i"],
    character_start_times_seconds: [0],
    character_end_times_seconds: [0.1, 0.2],
  }), []);
});

Deno.test("forcedAlignmentToWords normalizes ElevenLabs word rows", () => {
  assertEquals(forcedAlignmentToWords({
    words: [
      { text: " Be", start: 0, end: 0.25, loss: 0.01 },
      { text: "still.", start: 0.25, end: 0.8, loss: 0.02 },
    ],
  }), [
    { word: "Be", start: 0, end: 0.25 },
    { word: "still.", start: 0.25, end: 0.8 },
  ]);
});
