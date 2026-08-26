export interface CompanionSpeciesIdentity {
  id: string;
  canonicalSpecies: string;
  aliases: readonly string[];
  bodyPlan: string;
  requiredFeatures: readonly string[];
  forbiddenMutations: readonly string[];
  motionLanguage: readonly string[];
}

const SPECIES_IDENTITIES: readonly CompanionSpeciesIdentity[] = [
  {
    id: "dragon",
    canonicalSpecies: "Dragon",
    aliases: ["dragon", "western dragon"],
    bodyPlan: "western dragon with exactly four legs, two separate membranous wings, one head, and one long tail",
    requiredFeatures: ["reptilian muzzle", "paired horns", "scaled body", "six-limb dragon silhouette"],
    forbiddenMutations: ["wyvern body plan", "feathers", "fur", "bird beak", "humanoid torso", "extra heads"],
    motionLanguage: ["tail balancing", "wing settling", "curious head tilts", "grounded quadruped steps"],
  },
  {
    id: "mechanicaldragon",
    canonicalSpecies: "Mechanical Dragon",
    aliases: ["mechanical dragon", "clockwork dragon", "mechanicaldragon"],
    bodyPlan: "fully engineered western dragon with exactly four articulated legs, two mechanical wings, one head, and one reinforced tail",
    requiredFeatures: ["metallic scale plates", "articulated joints", "visible gear or clockwork motifs", "engineered energy core"],
    forbiddenMutations: ["organic flesh", "fur", "feathers", "biological tissue", "humanoid torso", "extra heads"],
    motionLanguage: ["servo head tilts", "precise wing calibration", "reactor pulse", "articulated tail balance"],
  },
  {
    id: "wolf",
    canonicalSpecies: "Wolf",
    aliases: ["wolf", "grey wolf"],
    bodyPlan: "natural canine quadruped with exactly four legs, one head, and one bushy tail",
    requiredFeatures: ["long canine muzzle", "erect triangular ears", "thick neck ruff", "digitigrade paws"],
    forbiddenMutations: ["wings", "horns", "scales", "cat muzzle", "human hands", "extra tails"],
    motionLanguage: ["ear swivels", "tail sweeps", "play bows", "alert scenting"],
  },
  {
    id: "fox",
    canonicalSpecies: "Kitsune",
    aliases: ["kitsune", "fox", "fox spirit"],
    bodyPlan: "mystical fox quadruped with exactly four legs, one fox head, and a readable fan of magical fox tails",
    requiredFeatures: ["narrow fox muzzle", "oversized triangular ears", "slender canine frame", "flowing fox-tail fan"],
    forbiddenMutations: ["wings", "cat muzzle", "wolf proportions", "humanoid body", "reptile scales", "bird beak"],
    motionLanguage: ["ear flicks", "tail-fan flourishes", "light-footed pounces", "curious fox head tilts"],
  },
  {
    id: "owl",
    canonicalSpecies: "Owl",
    aliases: ["owl"],
    bodyPlan: "natural owl with exactly two legs, two feathered wings, one head, and a short feathered tail",
    requiredFeatures: ["round facial disk", "hooked owl beak", "forward-facing eyes", "layered owl plumage"],
    forbiddenMutations: ["four legs", "mammal muzzle", "reptile scales", "human face", "extra wings"],
    motionLanguage: ["slow head turns", "blinks", "feather ruffles", "quiet wing stretches"],
  },
  {
    id: "raven",
    canonicalSpecies: "Raven",
    aliases: ["raven"],
    bodyPlan: "natural corvid with exactly two legs, two feathered wings, one head, and a wedge-shaped tail",
    requiredFeatures: ["heavy black beak", "iridescent black feathers", "intelligent dark eyes", "corvid silhouette"],
    forbiddenMutations: ["four legs", "mammal muzzle", "owl facial disk", "reptile scales", "human face"],
    motionLanguage: ["clever head cocks", "short hops", "wing mantles", "object-inspecting pecks"],
  },
  {
    id: "lion",
    canonicalSpecies: "Lion",
    aliases: ["lion"],
    bodyPlan: "natural lion quadruped with exactly four legs, one feline head, and one tufted tail",
    requiredFeatures: ["broad feline muzzle", "rounded ears", "large paws", "mane appropriate to age"],
    forbiddenMutations: ["wings", "bird beak", "canine muzzle", "hooves", "reptile scales", "extra tails"],
    motionLanguage: ["paw kneading", "tail-tip flicks", "shoulder stretches", "calm feline nuzzles"],
  },
  {
    id: "phoenix",
    canonicalSpecies: "Phoenix",
    aliases: ["phoenix", "fire bird"],
    bodyPlan: "mythic avian with exactly two legs, two feathered wings, one beaked head, and long flame-feather tail streamers",
    requiredFeatures: ["bird beak", "layered plumage", "flame crest", "radiant tail feathers"],
    forbiddenMutations: ["four legs", "dragon muzzle", "bat wings", "fur", "human arms", "extra heads"],
    motionLanguage: ["crest flares", "wing fans", "ember shakes", "light hopping steps"],
  },
  {
    id: "pegasus",
    canonicalSpecies: "Pegasus",
    aliases: ["pegasus", "winged horse"],
    bodyPlan: "horse with exactly four equine legs, two separate feathered wings, one horse head, and one flowing tail",
    requiredFeatures: ["equine muzzle", "single-toed hooves", "horse mane", "large feathered wings"],
    forbiddenMutations: ["horn", "claws", "dragon head", "lion paws", "bat wings", "bird forelegs"],
    motionLanguage: ["hoof prances", "mane tosses", "wing stretches", "gentle horse nuzzles"],
  },
  {
    id: "griffin",
    canonicalSpecies: "Griffin",
    aliases: ["griffin", "gryphon"],
    bodyPlan: "classic eagle-lion hybrid with an eagle head and feathered forequarters, four leonine legs, two feathered wings, and leonine hindquarters",
    requiredFeatures: ["eagle beak", "eagle brow and neck feathers", "lion body and paws", "large feathered wings"],
    forbiddenMutations: ["horse body", "human face", "reptile scales", "dragon wings", "all-bird body", "extra limbs"],
    motionLanguage: ["eagle head turns", "wing mantles", "feline tail sweeps", "lion-like forepaw stretches"],
  },
  {
    id: "sphinx",
    canonicalSpecies: "Sphinx",
    aliases: ["sphinx"],
    bodyPlan: "mythic lion with exactly four leonine legs, one natural feline head, two feathered wings, and one tufted lion tail",
    requiredFeatures: ["lion face without a beak", "feline body and paws", "regal feathered wings", "calm knowing eyes"],
    forbiddenMutations: ["human face", "eagle beak", "horse body", "reptile scales", "dragon wings", "extra heads"],
    motionLanguage: ["measured feline blinks", "wing settling", "tail-tip riddling curls", "regal paw placement"],
  },
  {
    id: "leviathan",
    canonicalSpecies: "Leviathan",
    aliases: ["leviathan", "sea serpent"],
    bodyPlan: "long aquatic sea-serpent body with no terrestrial legs, no wings, one head, fins, gill accents, and a continuous swimming tail",
    requiredFeatures: ["serpentine aquatic silhouette", "fin or gill frills", "streamlined head", "continuous tail"],
    forbiddenMutations: ["legs", "feet", "wings", "fur", "horse torso", "humanoid torso", "extra heads"],
    motionLanguage: ["tidal coils", "fin ripples", "curious surface rises", "gentle swimming loops"],
  },
  {
    id: "tanuki",
    canonicalSpecies: "Tanuki",
    aliases: ["tanuki", "raccoon dog"],
    bodyPlan: "Japanese raccoon-dog quadruped with exactly four canine legs, one head, and one plush striped tail",
    requiredFeatures: ["short canine muzzle", "rounded triangular ears", "dark eye mask", "stocky raccoon-dog body"],
    forbiddenMutations: ["wings", "cat body", "raccoon hands", "reptile scales", "multiple tails", "humanoid torso"],
    motionLanguage: ["playful rolls", "sniffing", "tail wags", "mischievous paw pats"],
  },
  {
    id: "buttercat",
    canonicalSpecies: "Buttercat",
    aliases: ["buttercat", "butterfly cat"],
    bodyPlan: "feline quadruped with exactly four cat legs, one cat head, one plush cat tail, and two butterfly wings",
    requiredFeatures: ["cat muzzle, ears, whiskers, and paws", "two patterned butterfly wings", "soft feline fur", "optional delicate antennae"],
    forbiddenMutations: ["insect body", "six legs", "compound eyes", "proboscis", "bird beak", "feathered wings"],
    motionLanguage: ["happy kneading", "butterfly-wing flutters", "tail curls", "playful kitten pounces"],
  },
  {
    id: "lamb",
    canonicalSpecies: "Lamb",
    aliases: ["lamb", "sheep"],
    bodyPlan: "natural woolly sheep quadruped with exactly four cloven-hoof legs, one head, and a short tail",
    requiredFeatures: ["dense wool", "broad ears", "gentle sheep muzzle", "cloven hooves"],
    forbiddenMutations: ["predator teeth", "wings", "paws", "reptile scales", "human face"],
    motionLanguage: ["small hoof steps", "ear flicks", "woolly nuzzles", "gentle settling"],
  },
  {
    id: "stag",
    canonicalSpecies: "Stag",
    aliases: ["stag", "deer", "red stag"],
    bodyPlan: "natural deer quadruped with exactly four long cloven-hoof legs, one deer head, and one short deer tail",
    requiredFeatures: ["long deer muzzle", "large alert ears", "cloven hooves", "age-appropriate symmetrical branching antlers"],
    forbiddenMutations: ["wings", "horse hooves", "predator paws", "fantasy spiral horns", "human face"],
    motionLanguage: ["ear swivels", "measured hoof steps", "head bows", "alert woodland pauses"],
  },
  {
    id: "dove",
    canonicalSpecies: "Dove",
    aliases: ["dove", "white dove"],
    bodyPlan: "natural compact dove with exactly two legs, two feathered wings, one head, and a short fan tail",
    requiredFeatures: ["small pale beak", "round dark eyes", "compact dove body", "clean layered feathers"],
    forbiddenMutations: ["four legs", "raptor talons", "hawk beak", "mammal muzzle", "human face"],
    motionLanguage: ["gentle head bobs", "small hops", "wing settling", "soft feather fluffs"],
  },
  {
    id: "eagle",
    canonicalSpecies: "Eagle",
    aliases: ["eagle"],
    bodyPlan: "natural raptor with exactly two taloned legs, two feathered wings, one head, and a layered feather tail",
    requiredFeatures: ["strong hooked beak", "raptor brow", "layered flight feathers", "natural talons"],
    forbiddenMutations: ["four legs", "mammal muzzle", "reptile scales", "human arms", "extra wings"],
    motionLanguage: ["keen head turns", "wing stretches", "talon repositioning", "feather mantles"],
  },
] as const;

const normalizeSpecies = (value: string | null | undefined): string =>
  typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";

export const resolveCompanionSpeciesIdentity = (
  species: string | null | undefined,
): CompanionSpeciesIdentity | null => {
  const normalized = normalizeSpecies(species);
  if (!normalized) return null;

  return SPECIES_IDENTITIES.find((identity) =>
    identity.aliases.some((alias) => normalizeSpecies(alias) === normalized)
  ) ?? null;
};

export const buildCompanionSpeciesIdentityPromptBlock = (
  identity: CompanionSpeciesIdentity,
): string => `SPECIES IDENTITY LOCK — ${identity.canonicalSpecies.toUpperCase()}
This character may grow, emote, and gain element details, but it must never change animal lineage.

BODY PLAN (non-negotiable):
${identity.bodyPlan}

REQUIRED READS:
${identity.requiredFeatures.map((feature) => `- ${feature}`).join("\n")}

FORBIDDEN MUTATIONS:
${identity.forbiddenMutations.map((feature) => `- ${feature}`).join("\n")}

SPECIES-TRUE MOTION CUES:
${identity.motionLanguage.map((motion) => `- ${motion}`).join("\n")}

Preserve the same individual face, markings, palette, and silhouette anchors from the canonical or previous-stage reference.`;

export const listCompanionSpeciesIdentities = (): readonly CompanionSpeciesIdentity[] =>
  SPECIES_IDENTITIES;

export const GRACEWARD_BIBLICAL_COMPANION_IDS = [
  "lamb",
  "lion",
  "stag",
  "dove",
  "eagle",
  "wolf",
] as const;

export const isGracewardBiblicalCompanionSpecies = (
  species: string | null | undefined,
): boolean => {
  const identity = resolveCompanionSpeciesIdentity(species);
  return Boolean(
    identity && GRACEWARD_BIBLICAL_COMPANION_IDS.includes(
      identity.id as typeof GRACEWARD_BIBLICAL_COMPANION_IDS[number],
    ),
  );
};
