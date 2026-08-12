import {
  buildAiEvolutionPrompt,
  buildBoundaryEvolutionGenerationPrompt,
  buildCompanionFamilyBible,
  buildCompanionGenerationMetadata,
  buildEggFromStage1Prompt,
  buildInitialImageLineageMetadata,
  buildStage1BootstrapPrompt,
  coerceCompanionVisualAnchors,
  shouldGeneratePortraitForStage,
  updateLineageMetadataWithVisualAnchors,
  type VisualIdentityProfile,
} from "./companionLineage.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function restoreEnv(
  name: "OPENAI_COMPANION_IMAGE_MODEL" | "OPENAI_IMAGE_MODEL",
  value: string | undefined,
) {
  if (typeof value === "string") {
    Deno.env.set(name, value);
  } else {
    Deno.env.delete(name);
  }
}

Deno.test("companion lineage metadata uses the same default image model as the OpenAI client", () => {
  const originalCompanionImageModel = Deno.env.get(
    "OPENAI_COMPANION_IMAGE_MODEL",
  );
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.delete("OPENAI_COMPANION_IMAGE_MODEL");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const lineageMetadata = buildInitialImageLineageMetadata({
      eggImageUrl: "https://example.com/egg.png",
      hiddenStageOneImageUrl: "https://example.com/stage-1.png",
    });
    const generationMetadata = buildCompanionGenerationMetadata({
      sourceType: "generation",
      boundaryLevel: 1,
      portraitRegenerated: true,
    });

    assert(
      lineageMetadata.model === "gpt-image-1-mini",
      `Expected lineage metadata default model to be gpt-image-1-mini, got ${lineageMetadata.model}`,
    );
    assert(
      generationMetadata.model === "gpt-image-1-mini",
      `Expected generation metadata default model to be gpt-image-1-mini, got ${generationMetadata.model}`,
    );
  } finally {
    restoreEnv(
      "OPENAI_COMPANION_IMAGE_MODEL",
      originalCompanionImageModel ?? undefined,
    );
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("companion lineage metadata follows OPENAI_COMPANION_IMAGE_MODEL overrides", () => {
  const originalCompanionImageModel = Deno.env.get(
    "OPENAI_COMPANION_IMAGE_MODEL",
  );
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.set("OPENAI_COMPANION_IMAGE_MODEL", "gpt-image-1-mini");
    Deno.env.set("OPENAI_IMAGE_MODEL", "gpt-image-1.5");

    const lineageMetadata = buildInitialImageLineageMetadata({
      eggImageUrl: "https://example.com/egg.png",
      hiddenStageOneImageUrl: "https://example.com/stage-1.png",
    });
    const generationMetadata = buildCompanionGenerationMetadata({
      sourceType: "lineage_generation",
      boundaryLevel: 5,
      portraitRegenerated: true,
    });

    assert(
      lineageMetadata.model === "gpt-image-1-mini",
      `Expected lineage metadata model override to be gpt-image-1-mini, got ${lineageMetadata.model}`,
    );
    assert(
      generationMetadata.model === "gpt-image-1-mini",
      `Expected generation metadata model override to be gpt-image-1-mini, got ${generationMetadata.model}`,
    );
  } finally {
    restoreEnv(
      "OPENAI_COMPANION_IMAGE_MODEL",
      originalCompanionImageModel ?? undefined,
    );
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("future companion image prompts ask for transparent cutout output", () => {
  const profile: VisualIdentityProfile = {
    schemaVersion: 1,
    spiritAnimal: "Wolf",
    coreElement: "Fire",
    favoriteColor: "#FF6B35",
    storyTone: "epic_adventure",
    bodyPlan: "grounded quadruped with strong silhouette",
    silhouetteAnchors: ["alert ears"],
    faceAnchors: ["bright eyes"],
    signatureFeatures: ["ember ruff"],
    paletteRules: ["warm orange anchor"],
    elementManifestation: ["embers around paws"],
    personalityRead: "brave and loyal",
    continuityRules: ["keep wolf family readable"],
  };

  const prompts = [
    buildStage1BootstrapPrompt(profile),
    buildEggFromStage1Prompt(profile),
    buildAiEvolutionPrompt({
      profile,
      previousLevel: 1,
      nextLevel: 5,
    }),
  ];

  for (const prompt of prompts) {
    assert(
      prompt.includes("transparent") && prompt.includes("background"),
      "Expected companion prompt to request transparent background output",
    );
    assert(
      prompt.includes("no scenic") || prompt.includes("No scenic"),
      "Expected companion prompt to reject scenic backdrops",
    );
    assert(
      prompt.includes("2D anime") && prompt.includes("soft cel shading"),
      "Expected companion prompt to preserve the Graceward animated art bible",
    );
    assert(
      prompt.includes("not chibi") &&
        prompt.includes(
          "specific existing game, anime, mascot, or copyrighted character",
        ),
      "Expected companion prompt to reject chibi distortion and franchise imitation",
    );
  }
});

Deno.test("visual anchors persist in lineage metadata by level", () => {
  const lineageMetadata = buildInitialImageLineageMetadata({
    eggImageUrl: "https://example.com/egg.png",
    hiddenStageOneImageUrl: "https://example.com/stage-1.png",
  });

  const updated = updateLineageMetadataWithVisualAnchors({
    existing: lineageMetadata,
    level: 5,
    visualAnchors: {
      schemaVersion: 1,
      level: 5,
      sourceImageUrl: "https://example.com/stage-5.png",
      capturedAt: "2026-05-01T00:00:00.000Z",
      summary: "sleek wolf guardian with blue flame ruff",
      silhouette: ["sleek wolf guardian"],
      anatomy: ["quadruped wolf anatomy"],
      face: ["bright eyes"],
      markings: ["crescent forehead mark"],
      palette: ["blue silver palette"],
      elementalEffects: ["blue flame ruff"],
      poseFraming: ["centered cutout"],
      artStyle: ["premium creature art"],
      signatureFeatures: ["flame ruff"],
      mustPreserve: ["crescent forehead mark"],
      safeToEvolve: ["pose", "scale"],
    },
  });

  assert(
    updated.visualAnchorsByLevel["5"]?.summary ===
      "sleek wolf guardian with blue flame ruff",
    "Expected visual anchors to persist under the captured level",
  );
});

Deno.test("empty visual anchors are rejected before persistence", () => {
  const emptyAnchors = {
    schemaVersion: 1,
    level: 5,
    sourceImageUrl: "https://example.com/stage-5.png",
    capturedAt: "2026-05-01T00:00:00.000Z",
    summary: " ",
    silhouette: [" "],
    anatomy: [],
    face: [],
    markings: [],
    palette: [],
    elementalEffects: [],
    poseFraming: ["centered cutout"],
    artStyle: ["transparent fantasy cutout"],
    signatureFeatures: [],
    mustPreserve: [],
    safeToEvolve: ["pose"],
  };

  assert(
    coerceCompanionVisualAnchors(emptyAnchors, 5) === null,
    "Expected non-identity anchor output to be rejected",
  );

  const lineageMetadata = buildInitialImageLineageMetadata({
    eggImageUrl: "https://example.com/egg.png",
    hiddenStageOneImageUrl: "https://example.com/stage-1.png",
  });
  const updated = updateLineageMetadataWithVisualAnchors({
    existing: lineageMetadata,
    level: 5,
    visualAnchors: emptyAnchors,
  });

  assert(
    updated.visualAnchorsByLevel["5"] === undefined,
    "Expected empty visual anchors to avoid lineage persistence",
  );
});

Deno.test("boundary prompt preserves extracted identity anchors for reference-image evolution", () => {
  const profile: VisualIdentityProfile = {
    schemaVersion: 1,
    spiritAnimal: "Wolf",
    coreElement: "Water",
    favoriteColor: "#00AAFF",
    storyTone: "epic_adventure",
    bodyPlan: "grounded quadruped with strong silhouette",
    silhouetteAnchors: ["alert ears"],
    faceAnchors: ["bright eyes"],
    signatureFeatures: ["water ruff"],
    paletteRules: ["blue anchor"],
    elementManifestation: ["water around paws"],
    personalityRead: "brave and loyal",
    continuityRules: ["keep wolf family readable"],
  };

  const prompt = buildBoundaryEvolutionGenerationPrompt({
    profile,
    previousLevel: 1,
    nextLevel: 5,
    previousAnchors: {
      schemaVersion: 1,
      level: 1,
      sourceImageUrl: "https://example.com/stage-1.png",
      capturedAt: "2026-05-01T00:00:00.000Z",
      summary: "small wolf hatchling with a water ruff",
      silhouette: ["small wolf silhouette"],
      anatomy: ["four legs"],
      face: ["bright eyes"],
      markings: ["crescent forehead mark"],
      palette: ["blue and silver"],
      elementalEffects: ["water ruff"],
      poseFraming: ["centered"],
      artStyle: ["transparent fantasy cutout"],
      signatureFeatures: ["water ruff"],
      mustPreserve: ["crescent forehead mark"],
      safeToEvolve: ["pose", "body scale"],
    },
  });

  assert(
    prompt.includes("Reference-image evolution rules") &&
      prompt.includes("previous approved portrait"),
    "Expected direct reference-image evolution instructions",
  );
  assert(
    prompt.includes("small wolf hatchling with a water ruff") &&
      prompt.includes("crescent forehead mark"),
    "Expected prompt to include previous visual anchors",
  );
  assert(
    prompt.includes("same individual"),
    "Expected the prompt to prohibit sibling-style redesigns",
  );
});

Deno.test("Christian companion forms receive explicit natural anatomy anchors", () => {
  const expectedAnchors: Record<string, string[]> = {
    Lamb: ["wool", "cloven hooves", "broad ear"],
    Lion: ["mane", "broad paws", "feline"],
    Stag: ["antlers", "cloven hooves", "deer"],
    Dove: ["small pale beak", "folded wings", "dove"],
    Eagle: ["hooked beak", "talon", "raptor"],
    Wolf: ["ruff", "bushy tail", "canine"],
  };

  for (const [spiritAnimal, expectedTerms] of Object.entries(expectedAnchors)) {
    const profile = buildCompanionFamilyBible({
      spiritAnimal,
      coreElement: "earth",
      favoriteColor: "#6B7C59",
      storyTone: "soft_gentle",
    });
    const identityText = [
      profile.bodyPlan,
      ...profile.silhouetteAnchors,
      ...profile.faceAnchors,
      ...profile.signatureFeatures,
    ].join(" ").toLowerCase();

    for (const expectedTerm of expectedTerms) {
      assert(
        identityText.includes(expectedTerm.toLowerCase()),
        `Expected ${spiritAnimal} identity rules to include ${expectedTerm}`,
      );
    }
    assert(
      profile.elementManifestation.some((rule) =>
        rule.includes("never divine, magical")
      ),
      `Expected ${spiritAnimal} visual-nature rules to stay creation-grounded`,
    );
  }
});

Deno.test("non-boundary levels remain non-portrait stages", () => {
  assert(
    shouldGeneratePortraitForStage(5),
    "Expected visual boundary levels to generate portraits",
  );
  assert(
    !shouldGeneratePortraitForStage(6),
    "Expected non-boundary levels to reuse the current portrait",
  );
});
