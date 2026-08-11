import {
  getProgressionTierLabelForLevel,
  getVisualStage,
  isTierBoundaryLevel,
  PROGRESSION_VISUAL_STAGES,
} from "../../../src/config/progression.ts";
import { resolveCompanionImageModel } from "./openaiCompanionImageClient.ts";

export interface VisualIdentityProfile {
  schemaVersion: number;
  spiritAnimal: string;
  coreElement: string;
  favoriteColor: string;
  storyTone: string;
  bodyPlan: string;
  silhouetteAnchors: string[];
  faceAnchors: string[];
  signatureFeatures: string[];
  paletteRules: string[];
  elementManifestation: string[];
  personalityRead: string;
  continuityRules: string[];
}

export interface CompanionLineageAnchor {
  imageUrl: string;
  focalX: number | null;
  focalY: number | null;
  sourceType: string;
  visibility: "hidden_until_reached" | "visible";
}

export interface CompanionVisualAnchors {
  schemaVersion: number;
  level: number;
  sourceImageUrl: string | null;
  capturedAt: string;
  summary: string | null;
  silhouette: string[];
  anatomy: string[];
  face: string[];
  markings: string[];
  palette: string[];
  elementalEffects: string[];
  poseFraming: string[];
  artStyle: string[];
  signatureFeatures: string[];
  mustPreserve: string[];
  safeToEvolve: string[];
}

export interface CompanionImageLineageMetadata {
  schemaVersion: number;
  provider: string;
  model: string;
  pipeline: string;
  promptVersion: string;
  hiddenBoundaryAnchors: Record<string, CompanionLineageAnchor>;
  visualAnchorsByLevel: Record<string, CompanionVisualAnchors>;
  eggDerivedFromBoundary: number | null;
  eggImageUrl: string | null;
  lastReachedBoundaryLevel: number;
  lastReachedBoundaryImageUrl: string | null;
  generationLog?: Record<string, unknown>;
  updatedAt: string;
}

export interface CompanionGenerationMetadata {
  provider: string;
  model: string;
  sourceType:
    | "generation"
    | "edit"
    | "lineage_generation"
    | "reveal"
    | "reuse"
    | "legacy_backfill";
  promptVersion: string;
  boundaryLevel: number;
  portraitRegenerated: boolean;
  reusedFromStage: number | null;
  retryCount: number;
  scores: {
    continuity: number | null;
    difference: number | null;
    anatomy: number | null;
    centering: number | null;
    styleConsistency: number | null;
    compositionConsistency: number | null;
    backgroundCutout: number | null;
    overall: number | null;
  };
  notes: string | null;
}

interface VisualIdentitySeed {
  spiritAnimal: string;
  coreElement: string;
  favoriteColor: string;
  storyTone?: string | null;
}

export const COMPANION_IMAGE_PROMPT_VERSION = "companion_lineage_v4";
export const COMPANION_ART_DIRECTION_VERSION = "cosmiq_collectible_v1";
const DEFAULT_IMAGE_LINEAGE_PROVIDER = "openai";
const DEFAULT_IMAGE_LINEAGE_PIPELINE = "stage1_first_bootstrap_v1";

const getDefaultImageLineageModel = (): string => resolveCompanionImageModel();

const normalizeText = (
  value: string | null | undefined,
  fallback: string,
): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const dedupe = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const lowerIncludes = (value: string, patterns: string[]): boolean => {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
};

const resolveBodyPlan = (spiritAnimal: string): string => {
  if (
    lowerIncludes(spiritAnimal, ["owl", "raven", "phoenix", "eagle", "bird"])
  ) {
    return "avian with a strong wing silhouette, readable head shape, and balanced ground stance";
  }
  if (lowerIncludes(spiritAnimal, ["dragon", "griffin", "pegasus"])) {
    return "mythic quadruped with clear power read, long silhouette lines, and dramatic elevation potential";
  }
  if (lowerIncludes(spiritAnimal, ["leviathan", "serpent", "snake", "eel"])) {
    return "serpentine aquatic body with flowing length, fin or crest accents, and no terrestrial limbs";
  }
  if (lowerIncludes(spiritAnimal, ["deer", "horse", "pegasus"])) {
    return "long-legged noble quadruped with elegant stride and readable chest-to-hip rhythm";
  }
  return "grounded creature silhouette with clear anatomy, readable proportions, and one memorable outline feature";
};

const resolveSignatureFeatures = (
  spiritAnimal: string,
  coreElement: string,
): string[] => {
  const animal = spiritAnimal.toLowerCase();
  const features = [
    `${spiritAnimal} family anatomy must stay recognizable at a glance`,
    `${coreElement} power should feel native to the body rather than pasted on`,
  ];

  if (animal.includes("wolf")) {
    features.push(
      "thick neck ruff, alert ears, and forward-moving predator stance",
    );
  }
  if (animal.includes("fox") || animal.includes("tanuki")) {
    features.push("large expressive ears and a sweeping tail or tail fan");
  }
  if (animal.includes("owl") || animal.includes("raven")) {
    features.push("memorable eyes and a strong facial silhouette");
  }
  if (animal.includes("dragon")) {
    features.push("horn or crown read, long tail, and powerful chest core");
  }
  if (animal.includes("lion")) {
    features.push("broad paws, proud chest, and mane or sunburst framing");
  }
  if (animal.includes("phoenix")) {
    features.push("plumage and flame should feel fused into one form");
  }
  if (animal.includes("griffin")) {
    features.push("beak-led head read with leonine power in the body");
  }
  if (animal.includes("pegasus")) {
    features.push("feathered wings and noble equine posture");
  }
  if (animal.includes("bear")) {
    features.push("heavy shoulders, grounded weight, and powerful paw read");
  }
  if (animal.includes("deer")) {
    features.push("graceful long legs and an antler-ready head silhouette");
  }

  return dedupe(features);
};

const resolveFaceAnchors = (spiritAnimal: string): string[] => {
  const animal = spiritAnimal.toLowerCase();
  const anchors = [
    "keep the same eye logic and emotional read across the whole evolution line",
    "do not randomize facial markings or the placement of major features",
  ];

  if (
    animal.includes("wolf") || animal.includes("fox") ||
    animal.includes("tanuki")
  ) {
    anchors.push("clear muzzle read with expressive ears");
  }
  if (
    animal.includes("owl") || animal.includes("raven") ||
    animal.includes("phoenix")
  ) {
    anchors.push(
      "the eye area must stay iconic and readable even at thumbnail size",
    );
  }
  if (
    animal.includes("dragon") || animal.includes("griffin") ||
    animal.includes("pegasus")
  ) {
    anchors.push(
      "head crest, horn, or beak silhouette must stay lineage-consistent",
    );
  }

  return dedupe(anchors);
};

const resolveSilhouetteAnchors = (spiritAnimal: string): string[] => {
  const animal = spiritAnimal.toLowerCase();
  const anchors = [
    "keep one instantly recognizable family silhouette across all stages",
    "every evolution should read larger and stronger without becoming a different species",
  ];

  if (animal.includes("wolf")) {
    anchors.push("lean quadruped silhouette with ruff and bushy tail");
  }
  if (animal.includes("fox")) {
    anchors.push("large ears and tail fan dominate the silhouette");
  }
  if (animal.includes("owl")) {
    anchors.push("compact body with commanding eye-and-wing silhouette");
  }
  if (animal.includes("raven")) {
    anchors.push("sharp beak profile and intelligent bird silhouette");
  }
  if (animal.includes("dragon")) {
    anchors.push(
      "wings, tail, and horned head must remain part of the main read",
    );
  }
  if (animal.includes("griffin")) {
    anchors.push("hybrid eagle-lion silhouette must stay clear");
  }
  if (animal.includes("pegasus")) {
    anchors.push("equine frame with proud wing spread");
  }
  if (animal.includes("phoenix")) {
    anchors.push("bird silhouette with long elegant trailing flame-feathers");
  }
  if (animal.includes("bear")) {
    anchors.push("heavy body mass and powerful forelimbs");
  }
  if (animal.includes("deer")) {
    anchors.push("long-legged grace with head ornament focus");
  }

  return dedupe(anchors);
};

const resolveTonePersonality = (storyTone: string): string => {
  switch (storyTone) {
    case "soft_gentle":
      return "protective, warm, and calm even when powerful";
    case "emotional_heartfelt":
      return "bond-first, expressive, and emotionally open";
    case "dark_intense":
      return "sharp, intense, and intimidating without losing elegance";
    case "whimsical_playful":
      return "curious, surprising, and slightly mischievous";
    case "epic_adventure":
    default:
      return "heroic, bold, and ready for a world-scale journey";
  }
};

export const buildCompanionFamilyBible = (
  seed: VisualIdentitySeed,
): VisualIdentityProfile => {
  const spiritAnimal = normalizeText(seed.spiritAnimal, "Dragon");
  const coreElement = normalizeText(seed.coreElement, "fire");
  const favoriteColor = normalizeText(seed.favoriteColor, "#FF6B35");
  const storyTone = normalizeText(seed.storyTone, "epic_adventure");

  return {
    schemaVersion: 1,
    spiritAnimal,
    coreElement,
    favoriteColor,
    storyTone,
    bodyPlan: resolveBodyPlan(spiritAnimal),
    silhouetteAnchors: resolveSilhouetteAnchors(spiritAnimal),
    faceAnchors: resolveFaceAnchors(spiritAnimal),
    signatureFeatures: resolveSignatureFeatures(spiritAnimal, coreElement),
    paletteRules: [
      `${favoriteColor} is the identity anchor and should stay visibly present in every stage`,
      "supporting colors can expand, but the palette should still feel like one family",
      "avoid monochrome washouts that erase silhouette readability",
    ],
    elementManifestation: [
      `${coreElement} energy should grow in scale and confidence as the companion evolves`,
      "element placement should feel consistent from one tier to the next",
      "elemental effects should support the body silhouette, not hide it",
    ],
    personalityRead: resolveTonePersonality(storyTone),
    continuityRules: [
      "never redesign this into a different creature family",
      "do not randomize markings, facial structure, or elemental placement",
      "each evolution should feel expensive and meaningful, like a major creature-collecting-game upgrade",
      "preserve the sense that this is the same individual becoming stronger",
    ],
  };
};

export const synthesizeVisualIdentityProfile = (
  existing: unknown,
  seed: VisualIdentitySeed,
): VisualIdentityProfile => {
  const fallback = buildCompanionFamilyBible(seed);
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return fallback;
  }

  const record = existing as Record<string, unknown>;

  return {
    schemaVersion: typeof record.schemaVersion === "number"
      ? record.schemaVersion
      : fallback.schemaVersion,
    spiritAnimal: normalizeText(
      typeof record.spiritAnimal === "string" ? record.spiritAnimal : null,
      fallback.spiritAnimal,
    ),
    coreElement: normalizeText(
      typeof record.coreElement === "string" ? record.coreElement : null,
      fallback.coreElement,
    ),
    favoriteColor: normalizeText(
      typeof record.favoriteColor === "string" ? record.favoriteColor : null,
      fallback.favoriteColor,
    ),
    storyTone: normalizeText(
      typeof record.storyTone === "string" ? record.storyTone : null,
      fallback.storyTone,
    ),
    bodyPlan: normalizeText(
      typeof record.bodyPlan === "string" ? record.bodyPlan : null,
      fallback.bodyPlan,
    ),
    silhouetteAnchors: Array.isArray(record.silhouetteAnchors)
      ? dedupe(record.silhouetteAnchors.map((value) => String(value)))
      : fallback.silhouetteAnchors,
    faceAnchors: Array.isArray(record.faceAnchors)
      ? dedupe(record.faceAnchors.map((value) => String(value)))
      : fallback.faceAnchors,
    signatureFeatures: Array.isArray(record.signatureFeatures)
      ? dedupe(record.signatureFeatures.map((value) => String(value)))
      : fallback.signatureFeatures,
    paletteRules: Array.isArray(record.paletteRules)
      ? dedupe(record.paletteRules.map((value) => String(value)))
      : fallback.paletteRules,
    elementManifestation: Array.isArray(record.elementManifestation)
      ? dedupe(record.elementManifestation.map((value) => String(value)))
      : fallback.elementManifestation,
    personalityRead: normalizeText(
      typeof record.personalityRead === "string"
        ? record.personalityRead
        : null,
      fallback.personalityRead,
    ),
    continuityRules: Array.isArray(record.continuityRules)
      ? dedupe(record.continuityRules.map((value) => String(value)))
      : fallback.continuityRules,
  };
};

export const shouldGeneratePortraitForStage = (level: number): boolean =>
  level === 0 || isTierBoundaryLevel(level);

export const getBoundaryStageForLevel = (level: number): number => {
  if (level <= 0) return 0;

  const reversedStages = [...PROGRESSION_VISUAL_STAGES].reverse();
  return reversedStages.find((stage) => level >= stage.levelStart)
    ?.levelStart ?? 0;
};

const getTierFantasy = (level: number): string => {
  const visualStage = getVisualStage(level);

  switch (visualStage) {
    case 0:
      return "A sealed magical egg. Show lineage hints only through shell shape, markings, aura, and energy. No full creature body visible.";
    case 1:
      return "Starter-form reveal. Cute, readable, iconic, and emotionally immediate. One standout signature feature should already be present.";
    case 2:
      return "A real mid-evolution jump. The creature should look more capable, athletic, and battle-ready while staying clearly in the same family.";
    case 3:
      return "First iconic transformation. Unlock the signature feature fully and make the silhouette feel memorable even at small size.";
    case 4:
      return "Mature guardian fantasy. Strong posture, protection, presence, and authority without losing the species read.";
    case 5:
      return "Final-form equivalent. Powerful, iconic, and complete. This should feel like the strongest species-readable battle silhouette.";
    case 6:
      return "Mythic overclock. The same creature line, but now operating at legendary scale with atmospheric elemental force.";
    case 7:
    default:
      return "Ascended apex. Cosmic or transcendent amplification of the same lineage, not a chaotic redesign.";
  }
};

const getEvolutionDeltaBudget = (
  previousLevel: number,
  nextLevel: number,
): string[] => {
  if (previousLevel <= 0 && nextLevel === 1) {
    return [
      "Biggest emotional payoff in the whole line: egg to full creature reveal",
      "Establish the permanent silhouette anchors clearly",
      "Show only one major signature feature at starter intensity",
    ];
  }

  const previousVisualStage = getVisualStage(previousLevel);
  const nextVisualStage = getVisualStage(nextLevel);

  if (previousVisualStage === nextVisualStage) {
    return [
      "This is not a new portrait tier",
      "Preserve the current appearance exactly",
    ];
  }

  switch (nextVisualStage) {
    case 2:
      return [
        "Increase scale and competence noticeably",
        "Add one major silhouette upgrade",
        "Strengthen elemental effects without hiding anatomy",
      ];
    case 3:
      return [
        "Deliver the first truly iconic silhouette leap",
        "Unlock the core signature feature at full clarity",
        "Shift posture from youthful to confidently powerful",
      ];
    case 4:
      return [
        "Add maturity, authority, and protective grandeur",
        "Deepen armor, mane, crest, wing, or frill presence if species-appropriate",
        "Make the creature feel like a guardian, not just bigger",
      ];
    case 5:
      return [
        "Make this feel like a final-form payoff",
        "Sharpen the silhouette into its definitive battle-ready read",
        "Increase scale, power, and confidence more than ornament density",
      ];
    case 6:
      return [
        "Add mythic atmospheric force without abandoning the original body plan",
        "Use non-biological projections or legendary effects only as amplifiers",
        "Keep the same family silhouette visible beneath the mythic layer",
      ];
    case 7:
    default:
      return [
        "Transcend into an apex form while remaining lineage-readable",
        "Favor regal or cosmic amplification over random complexity",
        "Make the creature feel ultimate, not noisy",
      ];
  }
};

export const buildCompanionArtDirection = (): string[] => [
  `Cosmiq render contract: ${COMPANION_ART_DIRECTION_VERSION}`,
  "premium polished 2D/2.5D fantasy creature-collecting game illustration with clean dark-warm contour lines, softly modeled gradient fills, selective painterly texture, luminous expressive eyes, crisp silhouette edges, and simplified readable forms",
  "keep this same rendering medium, edge finish, material detail, eye treatment, and polish across every egg, companion, state, and evolution tier",
  "do not drift into photorealism, flat vector diagrams, anime-screen or cel-only rendering, sketch art, gritty horror, plastic 3D, or extreme chibi proportions",
  "single companion or egg as the only subject; no extra characters",
  "square 1:1 portrait composition with a neutral eye-level three-quarter-front camera and no extreme perspective or foreshortening",
  "show the complete silhouette; center the visible subject near x=0.50 and y=0.52, filling roughly 68-78% of canvas height",
  "keep all anatomy, wings, horns, tails, fins, aura, glow, and particles inside a 10% safe-area inset; no cropping or edge collisions",
  "use a stable grounded stance or controlled hover appropriate to the species, with the face and eyes unobstructed",
  "animation-ready pose with a clearly readable head, torso, limbs, wings, fins, and tail; avoid tangled overlaps that prevent believable breathing, turning, hopping, or nuzzling motion",
  "keep the facial focal area clean and expressive so eye-contact and touch reactions remain readable at mobile portrait size",
  "use one lighting recipe: soft neutral key from upper-left, gentle cool rim separation, lifted readable midtones, clean eye highlights, and controlled saturated accents",
  "story tone may influence expression and the mood of body-attached aura only; it must not replace the canonical camera, lighting, palette hierarchy, or rendering style",
  "silhouette-first composition with high readability at thumbnail size",
  "true transparent background / alpha canvas; isolated subject-only cutout",
  "no scenic or environmental backdrop, sky, clouds, horizon, landscape, room, floor, frame, border, card, shadow plane, or solid rectangular background",
  "the output must not read as a cropped scene or a sticker sitting on a visible rectangle",
  "aura, glow, and particles may surround the companion but must sit over transparency with no backdrop behind them",
  "no text, logos, or extra characters",
  "lighting should support form readability rather than drown the subject",
];

const buildContinuityChecklist = (profile: VisualIdentityProfile): string[] => [
  `same creature family: ${profile.spiritAnimal}`,
  ...profile.silhouetteAnchors,
  ...profile.faceAnchors,
  ...profile.signatureFeatures,
  ...profile.paletteRules,
  ...profile.elementManifestation,
  ...profile.continuityRules,
];

const normalizeNullableNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeAnchorTextArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? dedupe(
      value
        .map((item) => typeof item === "string" ? item.trim() : "")
        .filter((item) => item.length > 0),
    )
    : [];

const normalizeLineageAnchor = (
  value: unknown,
): CompanionLineageAnchor | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const imageUrl = normalizeText(
    typeof record.imageUrl === "string" ? record.imageUrl : null,
    "",
  );
  if (imageUrl.length === 0) {
    return null;
  }

  return {
    imageUrl,
    focalX: normalizeNullableNumber(record.focalX),
    focalY: normalizeNullableNumber(record.focalY),
    sourceType: normalizeText(
      typeof record.sourceType === "string" ? record.sourceType : null,
      "generation",
    ),
    visibility: record.visibility === "visible"
      ? "visible"
      : "hidden_until_reached",
  };
};

export const coerceCompanionVisualAnchors = (
  value: unknown,
  fallbackLevel = 0,
  fallbackSourceImageUrl: string | null = null,
): CompanionVisualAnchors | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const level =
    typeof record.level === "number" && Number.isFinite(record.level)
      ? Math.max(0, Math.floor(record.level))
      : fallbackLevel;
  const sourceImageUrl = normalizeText(
    typeof record.sourceImageUrl === "string" ? record.sourceImageUrl : null,
    fallbackSourceImageUrl ?? "",
  ) || null;
  const summary = normalizeText(
    typeof record.summary === "string" ? record.summary : null,
    "",
  ) || null;
  const silhouette = normalizeAnchorTextArray(record.silhouette);
  const anatomy = normalizeAnchorTextArray(record.anatomy);
  const face = normalizeAnchorTextArray(record.face);
  const markings = normalizeAnchorTextArray(record.markings);
  const palette = normalizeAnchorTextArray(record.palette);
  const elementalEffects = normalizeAnchorTextArray(record.elementalEffects);
  const poseFraming = normalizeAnchorTextArray(record.poseFraming);
  const artStyle = normalizeAnchorTextArray(record.artStyle);
  const signatureFeatures = normalizeAnchorTextArray(record.signatureFeatures);
  const mustPreserve = normalizeAnchorTextArray(record.mustPreserve);
  const safeToEvolve = normalizeAnchorTextArray(record.safeToEvolve);
  const hasIdentityAnchors = [
    summary,
    ...silhouette,
    ...anatomy,
    ...face,
    ...markings,
    ...palette,
    ...elementalEffects,
    ...signatureFeatures,
    ...mustPreserve,
  ].some((item) => typeof item === "string" && item.length > 0);

  if (!hasIdentityAnchors) {
    return null;
  }

  return {
    schemaVersion: typeof record.schemaVersion === "number"
      ? record.schemaVersion
      : 1,
    level,
    sourceImageUrl,
    capturedAt: normalizeText(
      typeof record.capturedAt === "string" ? record.capturedAt : null,
      new Date().toISOString(),
    ),
    summary,
    silhouette,
    anatomy,
    face,
    markings,
    palette,
    elementalEffects,
    poseFraming,
    artStyle,
    signatureFeatures,
    mustPreserve,
    safeToEvolve,
  };
};

export const coerceImageLineageMetadata = (
  existing: unknown,
): CompanionImageLineageMetadata => {
  const fallback: CompanionImageLineageMetadata = {
    schemaVersion: 1,
    provider: DEFAULT_IMAGE_LINEAGE_PROVIDER,
    model: getDefaultImageLineageModel(),
    pipeline: DEFAULT_IMAGE_LINEAGE_PIPELINE,
    promptVersion: COMPANION_IMAGE_PROMPT_VERSION,
    hiddenBoundaryAnchors: {},
    visualAnchorsByLevel: {},
    eggDerivedFromBoundary: null,
    eggImageUrl: null,
    lastReachedBoundaryLevel: 0,
    lastReachedBoundaryImageUrl: null,
    updatedAt: new Date().toISOString(),
  };

  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return fallback;
  }

  const record = existing as Record<string, unknown>;
  const hiddenBoundaryAnchors = !record.hiddenBoundaryAnchors ||
      typeof record.hiddenBoundaryAnchors !== "object" ||
      Array.isArray(record.hiddenBoundaryAnchors)
    ? {}
    : Object.fromEntries(
      Object.entries(record.hiddenBoundaryAnchors as Record<string, unknown>)
        .map(([level, anchor]) => [level, normalizeLineageAnchor(anchor)])
        .filter((entry): entry is [string, CompanionLineageAnchor] =>
          Boolean(entry[1])
        ),
    );
  const visualAnchorsByLevel = !record.visualAnchorsByLevel ||
      typeof record.visualAnchorsByLevel !== "object" ||
      Array.isArray(record.visualAnchorsByLevel)
    ? {}
    : Object.fromEntries(
      Object.entries(record.visualAnchorsByLevel as Record<string, unknown>)
        .map(([level, anchors]) => [
          level,
          coerceCompanionVisualAnchors(
            anchors,
            Number.isFinite(Number(level)) ? Number(level) : 0,
          ),
        ])
        .filter((entry): entry is [string, CompanionVisualAnchors] =>
          Boolean(entry[1])
        ),
    );

  return {
    schemaVersion: typeof record.schemaVersion === "number"
      ? record.schemaVersion
      : fallback.schemaVersion,
    provider: normalizeText(
      typeof record.provider === "string" ? record.provider : null,
      fallback.provider,
    ),
    model: normalizeText(
      typeof record.model === "string" ? record.model : null,
      fallback.model,
    ),
    pipeline: normalizeText(
      typeof record.pipeline === "string" ? record.pipeline : null,
      fallback.pipeline,
    ),
    promptVersion: normalizeText(
      typeof record.promptVersion === "string" ? record.promptVersion : null,
      fallback.promptVersion,
    ),
    hiddenBoundaryAnchors,
    visualAnchorsByLevel,
    eggDerivedFromBoundary: typeof record.eggDerivedFromBoundary === "number"
      ? record.eggDerivedFromBoundary
      : fallback.eggDerivedFromBoundary,
    eggImageUrl: normalizeText(
      typeof record.eggImageUrl === "string" ? record.eggImageUrl : null,
      "",
    ) || null,
    lastReachedBoundaryLevel:
      typeof record.lastReachedBoundaryLevel === "number"
        ? record.lastReachedBoundaryLevel
        : fallback.lastReachedBoundaryLevel,
    lastReachedBoundaryImageUrl: normalizeText(
      typeof record.lastReachedBoundaryImageUrl === "string"
        ? record.lastReachedBoundaryImageUrl
        : null,
      "",
    ) || null,
    generationLog:
      record.generationLog && typeof record.generationLog === "object" &&
        !Array.isArray(record.generationLog)
        ? record.generationLog as Record<string, unknown>
        : undefined,
    updatedAt: normalizeText(
      typeof record.updatedAt === "string" ? record.updatedAt : null,
      fallback.updatedAt,
    ),
  };
};

export const buildInitialImageLineageMetadata = ({
  eggImageUrl,
  hiddenStageOneImageUrl,
  eggFocalX,
  eggFocalY,
  hiddenStageOneFocalX,
  hiddenStageOneFocalY,
  generationLog,
}: {
  eggImageUrl: string;
  hiddenStageOneImageUrl: string;
  eggFocalX?: number | null;
  eggFocalY?: number | null;
  hiddenStageOneFocalX?: number | null;
  hiddenStageOneFocalY?: number | null;
  generationLog?: Record<string, unknown>;
}): CompanionImageLineageMetadata => ({
  schemaVersion: 1,
  provider: DEFAULT_IMAGE_LINEAGE_PROVIDER,
  model: getDefaultImageLineageModel(),
  pipeline: DEFAULT_IMAGE_LINEAGE_PIPELINE,
  promptVersion: COMPANION_IMAGE_PROMPT_VERSION,
  hiddenBoundaryAnchors: {
    "1": {
      imageUrl: hiddenStageOneImageUrl,
      focalX: normalizeNullableNumber(hiddenStageOneFocalX),
      focalY: normalizeNullableNumber(hiddenStageOneFocalY),
      sourceType: "bootstrap_generation",
      visibility: "hidden_until_reached",
    },
  },
  visualAnchorsByLevel: {},
  eggDerivedFromBoundary: 1,
  eggImageUrl,
  lastReachedBoundaryLevel: 0,
  lastReachedBoundaryImageUrl: eggImageUrl,
  ...(generationLog ? { generationLog } : {}),
  updatedAt: new Date().toISOString(),
});

export const getHiddenBoundaryAnchor = (
  existing: unknown,
  level: number,
): CompanionLineageAnchor | null =>
  coerceImageLineageMetadata(existing).hiddenBoundaryAnchors[String(level)] ??
    null;

export const updateLineageMetadataWithVisualAnchors = ({
  existing,
  level,
  visualAnchors,
}: {
  existing: unknown;
  level: number;
  visualAnchors: CompanionVisualAnchors | null | undefined;
}): CompanionImageLineageMetadata => {
  const metadata = coerceImageLineageMetadata(existing);
  const normalizedAnchors = coerceCompanionVisualAnchors(
    visualAnchors,
    level,
    visualAnchors?.sourceImageUrl ?? null,
  );

  if (!normalizedAnchors) {
    return metadata;
  }

  return {
    ...metadata,
    visualAnchorsByLevel: {
      ...metadata.visualAnchorsByLevel,
      [String(level)]: {
        ...normalizedAnchors,
        level,
      },
    },
    updatedAt: new Date().toISOString(),
  };
};

export const updateLineageMetadataAfterReveal = ({
  existing,
  revealedLevel,
  imageUrl,
  focalX,
  focalY,
}: {
  existing: unknown;
  revealedLevel: number;
  imageUrl: string;
  focalX?: number | null;
  focalY?: number | null;
}): CompanionImageLineageMetadata => {
  const metadata = coerceImageLineageMetadata(existing);
  const levelKey = String(revealedLevel);
  const existingAnchor = metadata.hiddenBoundaryAnchors[levelKey];

  return {
    ...metadata,
    hiddenBoundaryAnchors: {
      ...metadata.hiddenBoundaryAnchors,
      [levelKey]: {
        imageUrl,
        focalX: normalizeNullableNumber(
          focalX ?? existingAnchor?.focalX ?? null,
        ),
        focalY: normalizeNullableNumber(
          focalY ?? existingAnchor?.focalY ?? null,
        ),
        sourceType: existingAnchor?.sourceType ?? "generation",
        visibility: "visible",
      },
    },
    lastReachedBoundaryLevel: revealedLevel,
    lastReachedBoundaryImageUrl: imageUrl,
    updatedAt: new Date().toISOString(),
  };
};

export const updateLineageMetadataAfterBoundaryEvolution = ({
  existing,
  boundaryLevel,
  imageUrl,
  focalX,
  focalY,
}: {
  existing: unknown;
  boundaryLevel: number;
  imageUrl: string;
  focalX?: number | null;
  focalY?: number | null;
}): CompanionImageLineageMetadata => {
  const metadata = coerceImageLineageMetadata(existing);
  return {
    ...metadata,
    promptVersion: COMPANION_IMAGE_PROMPT_VERSION,
    lastReachedBoundaryLevel: boundaryLevel,
    lastReachedBoundaryImageUrl: imageUrl,
    updatedAt: new Date().toISOString(),
    hiddenBoundaryAnchors: boundaryLevel === 1
      ? {
        ...metadata.hiddenBoundaryAnchors,
        "1": {
          imageUrl,
          focalX: normalizeNullableNumber(focalX),
          focalY: normalizeNullableNumber(focalY),
          sourceType: metadata.hiddenBoundaryAnchors["1"]?.sourceType ??
            "generation",
          visibility: "visible",
        },
      }
      : metadata.hiddenBoundaryAnchors,
  };
};

export const buildCompanionGenerationMetadata = ({
  sourceType,
  boundaryLevel,
  portraitRegenerated,
  reusedFromStage = null,
  retryCount = 0,
  scores,
  notes = null,
}: {
  sourceType: CompanionGenerationMetadata["sourceType"];
  boundaryLevel: number;
  portraitRegenerated: boolean;
  reusedFromStage?: number | null;
  retryCount?: number;
  scores?: Partial<CompanionGenerationMetadata["scores"]> | null;
  notes?: string | null;
}): CompanionGenerationMetadata => ({
  provider: DEFAULT_IMAGE_LINEAGE_PROVIDER,
  model: getDefaultImageLineageModel(),
  sourceType,
  promptVersion: COMPANION_IMAGE_PROMPT_VERSION,
  boundaryLevel,
  portraitRegenerated,
  reusedFromStage,
  retryCount,
  scores: {
    continuity: scores?.continuity ?? null,
    difference: scores?.difference ?? null,
    anatomy: scores?.anatomy ?? null,
    centering: scores?.centering ?? null,
    styleConsistency: scores?.styleConsistency ?? null,
    compositionConsistency: scores?.compositionConsistency ?? null,
    backgroundCutout: scores?.backgroundCutout ?? null,
    overall: scores?.overall ?? null,
  },
  notes,
});

export const getEvolutionDifferenceFloor = (
  previousLevel: number,
  nextLevel: number,
): number => {
  if (previousLevel <= 0 && nextLevel === 1) return 6;
  if (nextLevel === 5) return 6;
  if (nextLevel === 13) return 6;
  if (nextLevel === 21) return 5;
  if (nextLevel === 36) return 5;
  if (nextLevel === 56) return 5;
  if (nextLevel === 81) return 4;
  return 0;
};

export const buildAiEggPrompt = (profile: VisualIdentityProfile): string => {
  return [
    "STYLIZED FANTASY CREATURE EGG PORTRAIT",
    "",
    `Egg tier: ${getProgressionTierLabelForLevel(0)}`,
    "Goal: create a custom stage-0 egg that hints at the future companion line without showing the creature's body.",
    "",
    "Family Bible:",
    `- Spirit animal lineage: ${profile.spiritAnimal}`,
    `- Core element: ${profile.coreElement}`,
    `- Favorite color anchor: ${profile.favoriteColor}`,
    `- Story tone mood: ${profile.storyTone}`,
    `- Body plan: ${profile.bodyPlan}`,
    ...profile.silhouetteAnchors.map((item) => `- Silhouette anchor: ${item}`),
    ...profile.signatureFeatures.map((item) =>
      `- Signature feature seed: ${item}`
    ),
    "",
    "Tier Fantasy:",
    `- ${getTierFantasy(0)}`,
    "",
    "Egg-specific rules:",
    "- The shell should feel bespoke to this future lineage, not generic",
    "- Use markings, shape language, aura, cracks, fins, ridges, horns, feathers, or crest motifs only as egg-shell hints",
    "- No visible full creature body or hatchling face",
    "- The shell should imply power sleeping inside",
    "",
    "Art Direction:",
    ...buildCompanionArtDirection().map((item) => `- ${item}`),
    "",
    "Continuity Checklist:",
    ...buildContinuityChecklist(profile).map((item) => `- ${item}`),
    "",
    "Desired feeling: a premium creature-collecting-game egg with strong mystery, lineage hints, and dramatic readability.",
  ].join("\n");
};

export const buildStage1BootstrapPrompt = (
  profile: VisualIdentityProfile,
): string => {
  return [
    "STYLIZED FANTASY COMPANION STARTER FORM",
    "",
    "Goal: create the canonical hidden stage-1 hatchling that defines the entire companion line.",
    "",
    "Family Bible:",
    `- Spirit animal lineage: ${profile.spiritAnimal}`,
    `- Core element: ${profile.coreElement}`,
    `- Favorite color anchor: ${profile.favoriteColor}`,
    `- Story tone mood: ${profile.storyTone}`,
    `- Personality read: ${profile.personalityRead}`,
    `- Body plan: ${profile.bodyPlan}`,
    ...profile.silhouetteAnchors.map((item) => `- Silhouette anchor: ${item}`),
    ...profile.faceAnchors.map((item) => `- Face anchor: ${item}`),
    ...profile.signatureFeatures.map((item) => `- Signature feature: ${item}`),
    "",
    "Tier Fantasy:",
    `- ${getTierFantasy(1)}`,
    "",
    "Starter-form rules:",
    "- This is the hidden true form inside the egg",
    "- Make it cute, iconic, and immediately lovable",
    "- Show one major signature feature clearly, but at starter intensity",
    "- Strong silhouette and facial read matter more than ornament density",
    "",
    "Art Direction:",
    ...buildCompanionArtDirection().map((item) => `- ${item}`),
    "",
    "Continuity Checklist:",
    ...buildContinuityChecklist(profile).map((item) => `- ${item}`),
    "",
    "Desired feeling: the premium starter form of a memorable creature-collecting-game lineage.",
  ].join("\n");
};

export const buildEggFromStage1Prompt = (
  profile: VisualIdentityProfile,
): string => {
  return [
    "TRANSFORM THIS STARTER FORM INTO ITS SEALED MAGICAL EGG",
    "",
    "Goal: create a bespoke stage-0 egg portrait derived from the hidden hatchling reference.",
    "",
    "Family Bible:",
    `- Spirit animal lineage: ${profile.spiritAnimal}`,
    `- Core element: ${profile.coreElement}`,
    `- Favorite color anchor: ${profile.favoriteColor}`,
    `- Story tone mood: ${profile.storyTone}`,
    `- Body plan: ${profile.bodyPlan}`,
    "",
    "Egg rules:",
    "- Preserve the lineage through shell shape language, markings, aura, cracks, ridges, feather hints, horn hints, fin hints, or crest hints",
    "- No visible full creature body",
    "- No visible face, paws, wings, or full silhouette emerging from the shell",
    "- The egg must feel like it contains the referenced hatchling specifically",
    "- Render as an isolated transparent-alpha cutout with no scenic backdrop, sky, clouds, horizon, landscape, floor, frame, card, shadow plane, or solid rectangular background",
    "- Strong mystery and premium readability, with any glow or particles attached to the egg over transparency",
    "",
    "Art Direction:",
    ...buildCompanionArtDirection().map((item) => `- ${item}`),
    "",
    "Continuity Checklist:",
    ...buildContinuityChecklist(profile).map((item) => `- ${item}`),
  ].join("\n");
};

export const buildAiEvolutionSystemPrompt = (nextLevel: number): string => {
  const visualStage = getVisualStage(nextLevel);

  if (visualStage >= 6) {
    return "You design creature evolutions that feel huge, premium, and lineage-consistent. Maximize payoff while keeping species recognition strong.";
  }

  if (visualStage >= 4) {
    return "You design creature evolutions with strong continuity, major silhouette upgrades, and clear family resemblance. Favor bold but coherent transformations.";
  }

  return "You design creature evolutions that feel like major creature-collecting-game upgrades. Preserve family identity while making each boundary evolution noticeably more advanced.";
};

export const buildAiEvolutionPrompt = ({
  profile,
  previousLevel,
  nextLevel,
}: {
  profile: VisualIdentityProfile;
  previousLevel: number;
  nextLevel: number;
}): string => {
  const previousTier = getProgressionTierLabelForLevel(previousLevel);
  const nextTier = getProgressionTierLabelForLevel(nextLevel);
  const boundaryStage = getBoundaryStageForLevel(nextLevel);

  return [
    "STYLIZED FANTASY COMPANION EVOLUTION",
    "",
    `Evolution jump: Level ${previousLevel} (${previousTier}) -> Level ${nextLevel} (${nextTier})`,
    `Portrait tier boundary: ${boundaryStage}`,
    "",
    "Family Bible:",
    `- Spirit animal lineage: ${profile.spiritAnimal}`,
    `- Core element: ${profile.coreElement}`,
    `- Favorite color anchor: ${profile.favoriteColor}`,
    `- Story tone mood: ${profile.storyTone}`,
    `- Personality read: ${profile.personalityRead}`,
    `- Body plan: ${profile.bodyPlan}`,
    ...profile.silhouetteAnchors.map((item) => `- Silhouette anchor: ${item}`),
    ...profile.faceAnchors.map((item) => `- Face anchor: ${item}`),
    ...profile.signatureFeatures.map((item) => `- Signature feature: ${item}`),
    "",
    "Tier Fantasy:",
    `- ${getTierFantasy(nextLevel)}`,
    "",
    "Evolution Delta Budget:",
    ...getEvolutionDeltaBudget(previousLevel, nextLevel).map((item) =>
      `- ${item}`
    ),
    "",
    "Art Direction:",
    ...buildCompanionArtDirection().map((item) => `- ${item}`),
    "",
    "Continuity Checklist:",
    ...buildContinuityChecklist(profile).map((item) => `- ${item}`),
    "",
    "Quality bar:",
    "- This should feel as satisfying as a major Pokemon-style evolution jump",
    "- The new form should be obviously different from the previous portrait at thumbnail size",
    "- It must still be unmistakably the same companion line",
  ].join("\n");
};

const formatAnchorSection = (label: string, values: string[]): string[] =>
  values.length > 0 ? [label, ...values.map((item) => `- ${item}`)] : [];

const describePreviousGenerationMetadata = (metadata: unknown): string[] => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const record = metadata as Record<string, unknown>;
  const notes = typeof record.notes === "string" ? record.notes.trim() : "";
  const sourceType = typeof record.sourceType === "string"
    ? record.sourceType.trim()
    : "";
  const promptVersion = typeof record.promptVersion === "string"
    ? record.promptVersion.trim()
    : "";
  const parts = [
    sourceType ? `source: ${sourceType}` : "",
    promptVersion ? `prompt version: ${promptVersion}` : "",
    notes ? `notes: ${notes}` : "",
  ].filter(Boolean);

  return parts.length > 0
    ? ["Previous generation metadata:", ...parts.map((item) => `- ${item}`)]
    : [];
};

export const buildBoundaryEvolutionGenerationPrompt = ({
  profile,
  previousLevel,
  nextLevel,
  previousAnchors,
  previousGenerationMetadata,
}: {
  profile: VisualIdentityProfile;
  previousLevel: number;
  nextLevel: number;
  previousAnchors?: CompanionVisualAnchors | null;
  previousGenerationMetadata?: unknown;
}): string => {
  const basePrompt = buildAiEvolutionPrompt({
    profile,
    previousLevel,
    nextLevel,
  });
  const previousSummary = previousAnchors?.summary?.trim();

  return [
    basePrompt,
    "",
    "Metadata-first evolution rules:",
    "- Generate a fresh next-stage portrait from this lineage metadata; do not copy the previous pose or exact silhouette",
    "- Treat the previous-form anchors below as identity evidence, not as a composition lock",
    "- Preserve the companion's recognizable family, face logic, markings, palette identity, and signature features",
    "- Evolve scale, maturity, posture, proportions, ornamentation, and elemental expression enough to read as a new tier",
    "- The result must look like a direct evolution of the previous companion, not a sibling, variant, or unrelated redesign",
    "- Previous pose, framing, lighting, or art-style notes are evidence only; the Cosmiq render contract above is authoritative for composition and finish",
    "",
    ...(previousSummary
      ? ["Previous form summary:", `- ${previousSummary}`, ""]
      : []),
    ...formatAnchorSection(
      "Previous silhouette anchors:",
      previousAnchors?.silhouette ?? [],
    ),
    ...formatAnchorSection(
      "Previous anatomy anchors:",
      previousAnchors?.anatomy ?? [],
    ),
    ...formatAnchorSection(
      "Previous face anchors:",
      previousAnchors?.face ?? [],
    ),
    ...formatAnchorSection(
      "Previous marking anchors:",
      previousAnchors?.markings ?? [],
    ),
    ...formatAnchorSection(
      "Previous palette anchors:",
      previousAnchors?.palette ?? [],
    ),
    ...formatAnchorSection(
      "Previous elemental anchors:",
      previousAnchors?.elementalEffects ?? [],
    ),
    ...formatAnchorSection(
      "Previous pose/framing evidence:",
      previousAnchors?.poseFraming ?? [],
    ),
    ...formatAnchorSection(
      "Previous art style evidence:",
      previousAnchors?.artStyle ?? [],
    ),
    ...formatAnchorSection(
      "Previous signature features:",
      previousAnchors?.signatureFeatures ?? [],
    ),
    ...formatAnchorSection(
      "Must preserve:",
      previousAnchors?.mustPreserve ?? [],
    ),
    ...formatAnchorSection(
      "Safe to evolve/change:",
      previousAnchors?.safeToEvolve ?? [],
    ),
    ...describePreviousGenerationMetadata(previousGenerationMetadata),
  ].join("\n");
};
