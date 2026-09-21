export interface SpiritLockAnchorRule {
  id: string;
  description: string;
  patterns: RegExp[];
}

export interface SpiritLockProfile {
  id: string;
  canonicalSpecies: string;
  speciesMatches: string[];
  requiredAnchors: SpiritLockAnchorRule[];
  forbiddenTerms: string[];
}

export interface SpiritLockComplianceResult {
  isCompliant: boolean;
  forbiddenHits: string[];
  missingAnchors: string[];
  matchedAnchors: string[];
  violations: string[];
}

const normalizeComparable = (value: string | null | undefined): string =>
  typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MECHANICAL_DRAGON_PROFILE: SpiritLockProfile = {
  id: "mechanical_dragon_hard_lock_v1",
  canonicalSpecies: "Mechanical Dragon",
  speciesMatches: ["mechanical dragon"],
  requiredAnchors: [
    {
      id: "metallic_scales",
      description: "Metallic scales or plated alloy scale armor",
      patterns: [
        /\bmetallic scales?\b/i,
        /\bmetal(?:-| )plated scales?\b/i,
        /\balloy scales?\b/i,
        /\bsteel scales?\b/i,
        /\bchrome scales?\b/i,
      ],
    },
    {
      id: "articulated_joints",
      description: "Articulated mechanical joints and engineered limb movement",
      patterns: [
        /\barticulated joints?\b/i,
        /\bhinged joints?\b/i,
        /\bservo joints?\b/i,
        /\bpiston joints?\b/i,
        /\bjointed limbs?\b/i,
        /\bmechanical joints?\b/i,
      ],
    },
    {
      id: "gear_clockwork_motifs",
      description: "Gear, cog, or clockwork motifs visible in form or aura",
      patterns: [
        /\bclockwork\b/i,
        /\bgear(?:s|work)?\b/i,
        /\bcog(?:s|wheel|wheels)?\b/i,
        /\bmechanism(?:s)?\b/i,
      ],
    },
    {
      id: "engineered_energy_core",
      description: "Engineered internal energy source (core/reactor/arc drive)",
      patterns: [
        /\benergy core\b/i,
        /\bpower core\b/i,
        /\breactor core\b/i,
        /\barc core\b/i,
        /\bfusion core\b/i,
        /\bengine core\b/i,
      ],
    },
  ],
  forbiddenTerms: [
    "flesh",
    "fleshy",
    "skin",
    "fur",
    "hide",
    "hair",
    "feather",
    "feathers",
    "tissue",
    "muscle",
    "sinew",
    "blood",
    "vein",
    "organ",
    "organic",
    "biological",
  ],
};

const SPIRIT_LOCK_PROFILES: SpiritLockProfile[] = [MECHANICAL_DRAGON_PROFILE];

export const resolveCompanionSpiritLockProfile = (
  species: string | null | undefined,
): SpiritLockProfile | null => {
  const normalizedSpecies = normalizeComparable(species);
  if (!normalizedSpecies) return null;

  return (
    SPIRIT_LOCK_PROFILES.find((profile) =>
      profile.speciesMatches.some((match) => normalizeComparable(match) === normalizedSpecies)
    ) ?? null
  );
};

export const buildSpiritLockPromptBlock = (
  profile: SpiritLockProfile,
  channel: "image" | "card" | "story" | "notification" | "generic" = "generic",
): string => {
  const forbidden = profile.forbiddenTerms.join(", ");
  const requiredLines = profile.requiredAnchors
    .map((anchor) => `- ${anchor.description}`)
    .join("\n");

  return `SPIRIT-LOCK (${profile.canonicalSpecies}) [${channel.toUpperCase()} - HARD LOCK]
This companion must remain mechanically engineered in every output.

MANDATORY ANCHORS (all required):
${requiredLines}

FORBIDDEN ORGANIC LANGUAGE (never use):
${forbidden}

If uncertain, prioritize engineered/mechanical interpretations and reject organic descriptions.`;
};

export const evaluateSpiritLockTextCompliance = (
  text: string | null | undefined,
  profile: SpiritLockProfile,
): SpiritLockComplianceResult => {
  const rawText = typeof text === "string" ? text : "";
  const normalizedText = normalizeComparable(rawText);

  const forbiddenHits = profile.forbiddenTerms.filter((term) =>
    new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(rawText),
  );

  const matchedAnchors = profile.requiredAnchors
    .filter((anchor) => anchor.patterns.some((pattern) => pattern.test(rawText) || pattern.test(normalizedText)))
    .map((anchor) => anchor.id);

  const missingAnchors = profile.requiredAnchors
    .filter((anchor) => !matchedAnchors.includes(anchor.id))
    .map((anchor) => anchor.id);

  const violations: string[] = [];
  if (forbiddenHits.length > 0) {
    violations.push(`Forbidden terms found: ${forbiddenHits.join(", ")}`);
  }
  if (missingAnchors.length > 0) {
    violations.push(`Missing required anchors: ${missingAnchors.join(", ")}`);
  }

  return {
    isCompliant: violations.length === 0,
    forbiddenHits,
    missingAnchors,
    matchedAnchors,
    violations,
  };
};

export const buildSpiritLockRetryFeedback = (
  profile: SpiritLockProfile,
  compliance: SpiritLockComplianceResult,
): string => {
  const lines = [`[SpiritLock Retry] ${profile.canonicalSpecies} compliance failed.`];
  if (compliance.forbiddenHits.length > 0) {
    lines.push(`Remove forbidden organic language: ${compliance.forbiddenHits.join(", ")}`);
  }
  if (compliance.missingAnchors.length > 0) {
    lines.push(`Explicitly include missing anchors: ${compliance.missingAnchors.join(", ")}`);
  }
  lines.push("Regenerate with strict mechanical identity preservation.");
  return lines.join("\n");
};
