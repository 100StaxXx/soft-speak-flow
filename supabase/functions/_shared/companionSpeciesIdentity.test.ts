import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCompanionSpeciesIdentityPromptBlock,
  isGracewardBiblicalCompanionSpecies,
  listCompanionSpeciesIdentities,
  resolveCompanionSpeciesIdentity,
} from "./companionSpeciesIdentity.ts";

Deno.test("covers every Graceward companion lineage with a unique identity", () => {
  const identities = listCompanionSpeciesIdentities();
  assertEquals(identities.length, 18);
  assertEquals(new Set(identities.map((identity) => identity.id)).size, identities.length);
});

Deno.test("recognizes only the active Graceward biblical-symbolic roster", () => {
  for (const species of ["Lamb", "Lion", "Stag", "Dove", "Eagle", "Wolf"]) {
    assertEquals(isGracewardBiblicalCompanionSpecies(species), true);
  }
  for (const legacySpecies of ["Dragon", "Phoenix", "Buttercat"]) {
    assertEquals(isGracewardBiblicalCompanionSpecies(legacySpecies), false);
  }
});

Deno.test("keeps commonly confused hybrid animals anatomically distinct", () => {
  const pegasus = resolveCompanionSpeciesIdentity("Pegasus");
  const griffin = resolveCompanionSpeciesIdentity("gryphon");
  const sphinx = resolveCompanionSpeciesIdentity("Sphinx");
  const leviathan = resolveCompanionSpeciesIdentity("Sea Serpent");

  assertStringIncludes(pegasus?.bodyPlan ?? "", "horse");
  assertStringIncludes(pegasus?.forbiddenMutations.join(" ") ?? "", "horn");
  assertStringIncludes(griffin?.bodyPlan ?? "", "eagle head");
  assertStringIncludes(sphinx?.requiredFeatures.join(" ") ?? "", "without a beak");
  assertStringIncludes(leviathan?.bodyPlan ?? "", "no terrestrial legs");
});

Deno.test("builds a strict image prompt that allows growth without species drift", () => {
  const identity = resolveCompanionSpeciesIdentity("Buttercat");
  const prompt = buildCompanionSpeciesIdentityPromptBlock(identity!);

  assertStringIncludes(prompt, "must never change animal lineage");
  assertStringIncludes(prompt, "exactly four cat legs");
  assertStringIncludes(prompt, "six legs");
  assertStringIncludes(prompt, "butterfly-wing flutters");
});
