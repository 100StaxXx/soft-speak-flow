import {
  STAGE1_COVERAGE_TARGETS,
  STAGE1_HUE_CONSTRAINTS,
  buildStageOneColorPlacementGuidance,
  buildStageOnePalette,
  formatStageOnePaletteInstructions,
} from "./stage1Palette.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("Stage1 palette keeps deterministic aggressive hue diversity", () => {
  const palette = buildStageOnePalette({
    companionId: "companion-abc",
    favoriteColor: "#00AA66",
    coreElement: "earth",
  });

  assert(palette.distinctHueGroups >= 4, "Expected at least 4 distinct hue groups");
  assert(palette.hasWarmHue, "Expected warm hue presence");
  assert(palette.hasCoolHue, "Expected cool hue presence");
  assert(
    palette.hueDistances.anchorElement >= STAGE1_HUE_CONSTRAINTS.minAnchorElementDistance,
    "Expected anchor-element hue distance to satisfy aggressive minimum",
  );
  assert(
    palette.hueDistances.anchorContrast >= STAGE1_HUE_CONSTRAINTS.minAnchorContrastDistance,
    "Expected anchor-contrast hue distance to satisfy aggressive minimum",
  );
});

Deno.test("Stage1 palette keeps warm/cool presence independent of anchor family", () => {
  const warmAnchorPalette = buildStageOnePalette({
    companionId: "companion-warm",
    favoriteColor: "#F97316",
    coreElement: "fire",
  });
  const coolAnchorPalette = buildStageOnePalette({
    companionId: "companion-cool",
    favoriteColor: "#2563EB",
    coreElement: "water",
  });

  assert(warmAnchorPalette.hasWarmHue, "Expected warm hue in warm-anchor palette");
  assert(warmAnchorPalette.hasCoolHue, "Expected cool hue in warm-anchor palette");
  assert(coolAnchorPalette.hasWarmHue, "Expected warm hue in cool-anchor palette");
  assert(coolAnchorPalette.hasCoolHue, "Expected cool hue in cool-anchor palette");
});

Deno.test("Stage1 aggressive coverage targets are wired", () => {
  assert(STAGE1_COVERAGE_TARGETS.anchor === "28-36%", "Unexpected anchor target ratio");
  assert(STAGE1_COVERAGE_TARGETS.elementAccent === "22-26%", "Unexpected element target ratio");
  assert(STAGE1_COVERAGE_TARGETS.contrastAccent === "18-22%", "Unexpected contrast target ratio");
  assert(STAGE1_COVERAGE_TARGETS.secondaryAccent === "14-18%", "Unexpected secondary target ratio");
  assert(STAGE1_COVERAGE_TARGETS.neutralBalance === "8-12%", "Unexpected neutral target ratio");
});

Deno.test("Stage1 prompt guidance includes creature+scene mapping and anti-wash language", () => {
  const guidance = buildStageOneColorPlacementGuidance();

  assert(guidance.includes("CREATURE ZONE MAPPING (MANDATORY)"), "Expected creature-zone mapping guidance");
  assert(guidance.includes("SCENE ZONE MAPPING (MANDATORY)"), "Expected scene-zone mapping guidance");
  assert(
    guidance.includes(
      "Do not wash creature and environment with anchor hue; preserve separable hue families in midtones and shadows.",
    ),
    "Expected explicit anti-wash wording",
  );
  assert(!guidance.includes("Fur/scales/feathers"), "Did not expect Stage1 fur lock phrasing");
});

Deno.test("Stage1 palette instructions reflect aggressive ratio targets", () => {
  const palette = buildStageOnePalette({
    companionId: "companion-ratios",
    favoriteColor: "#7C3AED",
    coreElement: "shadow",
  });
  const instructions = formatStageOnePaletteInstructions(palette);

  assert(instructions.includes("anchor: 28-36%"), "Expected anchor ratio in instructions");
  assert(instructions.includes("element_accent: 22-26%"), "Expected element ratio in instructions");
  assert(instructions.includes("contrast_accent: 18-22%"), "Expected contrast ratio in instructions");
  assert(instructions.includes("secondary_accent: 14-18%"), "Expected secondary ratio in instructions");
  assert(instructions.includes("neutral_balance: 8-12%"), "Expected neutral ratio in instructions");
});
