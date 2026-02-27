import {
  buildSpiritLockPromptBlock,
  buildSpiritLockRetryFeedback,
  evaluateSpiritLockTextCompliance,
  resolveCompanionSpiritLockProfile,
} from "./companionSpiritLock.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("resolves Mechanical Dragon profile case-insensitively", () => {
  const profile = resolveCompanionSpiritLockProfile("mEcHaNiCaL dRaGoN");
  assert(profile !== null, "Expected profile to resolve");
  assert(profile?.canonicalSpecies === "Mechanical Dragon", "Expected Mechanical Dragon profile");
});

Deno.test("does not resolve profile for non-target species", () => {
  const profile = resolveCompanionSpiritLockProfile("Dragon");
  assert(profile === null, "Expected no profile for standard Dragon species");
});

Deno.test("detects forbidden terms and missing anchors", () => {
  const profile = resolveCompanionSpiritLockProfile("Mechanical Dragon");
  assert(profile !== null, "Expected Mechanical Dragon profile");

  const text = "A dragon with warm skin and fur, breathing softly in the moonlight.";
  const compliance = evaluateSpiritLockTextCompliance(text, profile!);

  assert(!compliance.isCompliant, "Expected compliance failure");
  assert(compliance.forbiddenHits.includes("skin"), "Expected skin forbidden hit");
  assert(compliance.forbiddenHits.includes("fur"), "Expected fur forbidden hit");
  assert(compliance.missingAnchors.length > 0, "Expected missing anchors");
});

Deno.test("passes compliance when all mechanical anchors are present", () => {
  const profile = resolveCompanionSpiritLockProfile("Mechanical Dragon");
  assert(profile !== null, "Expected Mechanical Dragon profile");

  const text = [
    "The Mechanical Dragon has metallic scales and articulated joints.",
    "Visible gears and clockwork motifs surround its body.",
    "A blazing energy core powers its movements.",
  ].join(" ");

  const compliance = evaluateSpiritLockTextCompliance(text, profile!);
  assert(compliance.isCompliant, `Expected compliant output, got violations: ${compliance.violations.join("; ")}`);
  assert(compliance.missingAnchors.length === 0, "Expected no missing anchors");
  assert(compliance.forbiddenHits.length === 0, "Expected no forbidden terms");
});

Deno.test("prompt block and retry feedback include expected guidance", () => {
  const profile = resolveCompanionSpiritLockProfile("Mechanical Dragon");
  assert(profile !== null, "Expected Mechanical Dragon profile");

  const promptBlock = buildSpiritLockPromptBlock(profile!, "image");
  assert(promptBlock.includes("HARD LOCK"), "Prompt block should include hard lock marker");
  assert(promptBlock.includes("FORBIDDEN ORGANIC LANGUAGE"), "Prompt block should include forbidden language section");

  const compliance = evaluateSpiritLockTextCompliance("organic flesh dragon", profile!);
  const retryFeedback = buildSpiritLockRetryFeedback(profile!, compliance);
  assert(retryFeedback.includes("compliance failed"), "Retry feedback should include failure marker");
  assert(retryFeedback.includes("forbidden"), "Retry feedback should include forbidden guidance");
});
