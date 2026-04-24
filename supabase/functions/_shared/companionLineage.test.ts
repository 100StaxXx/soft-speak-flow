import {
  buildCompanionGenerationMetadata,
  buildInitialImageLineageMetadata,
} from "./companionLineage.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function restoreEnv(name: "OPENAI_COMPANION_IMAGE_MODEL" | "OPENAI_IMAGE_MODEL", value: string | undefined) {
  if (typeof value === "string") {
    Deno.env.set(name, value);
  } else {
    Deno.env.delete(name);
  }
}

Deno.test("companion lineage metadata uses the same default image model as the OpenAI client", () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
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

    assert(lineageMetadata.model === "gpt-image-2", `Expected lineage metadata default model to be gpt-image-2, got ${lineageMetadata.model}`);
    assert(generationMetadata.model === "gpt-image-2", `Expected generation metadata default model to be gpt-image-2, got ${generationMetadata.model}`);
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("companion lineage metadata follows OPENAI_COMPANION_IMAGE_MODEL overrides", () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.set("OPENAI_COMPANION_IMAGE_MODEL", "gpt-image-2");
    Deno.env.set("OPENAI_IMAGE_MODEL", "gpt-image-1.5");

    const lineageMetadata = buildInitialImageLineageMetadata({
      eggImageUrl: "https://example.com/egg.png",
      hiddenStageOneImageUrl: "https://example.com/stage-1.png",
    });
    const generationMetadata = buildCompanionGenerationMetadata({
      sourceType: "edit",
      boundaryLevel: 5,
      portraitRegenerated: true,
    });

    assert(lineageMetadata.model === "gpt-image-2", `Expected lineage metadata model override to be gpt-image-2, got ${lineageMetadata.model}`);
    assert(generationMetadata.model === "gpt-image-2", `Expected generation metadata model override to be gpt-image-2, got ${generationMetadata.model}`);
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});
