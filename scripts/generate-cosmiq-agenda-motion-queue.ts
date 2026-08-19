import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COSMIQ_AGENDA_CATEGORIES,
  COSMIQ_AGENDA_MOTION_RECIPES,
  getExpectedCosmiqAgendaMotionAssets,
  type CosmiqAgendaCategory,
  type CosmiqAgendaEventType,
} from "../src/config/cosmiqAgendaMotion.ts";
import {
  COSMIQ_PRODUCTION_ELEMENTS,
  COSMIQ_PRODUCTION_SPECIES,
  type CosmiqProductionElement,
  type CosmiqProductionSpecies,
} from "../src/config/cosmiqProductionCatalog.ts";
import { COMPANION_PRESETS } from "../src/config/companionCatalog.ts";
import {
  PREMADE_COMPANION_BOUNDARY_LEVELS,
  getPremadeCompanionEvolutionAssetDescriptor,
} from "../src/config/premadeCompanionAssets.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queueDir = path.join(repoRoot, "tmp", "higgsfield", "cosmiq-agenda-motion");
const outputRoot = path.join(repoRoot, "output", "companion-premade");
const queuePath = path.join(queueDir, "queue.json");

const stageAssetFolderByBoundary = {
  1: "t1_youth",
  5: "t2_guardian",
  13: "t3_awakened",
  21: "t4_guardian",
  36: "t5_champion",
  56: "t6_mythic",
  81: "t7_ascended",
} as const satisfies Record<(typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number], string>;

const elementDirection: Record<CosmiqProductionElement, string> = {
  fire: "restrained ember sparks, warm copper highlights, and a soft flame-shaped aura",
  ice: "restrained frost motes, cool crystal highlights, and a soft glacial aura",
  storm: "restrained electric motes, silver-blue lightning highlights, and a soft wind-charged aura",
  nature: "restrained leaf motes, moss-green highlights, and a soft living-vine aura",
  void: "restrained violet star motes, deep indigo highlights, and a soft nebula-like aura",
  light: "restrained golden motes, warm ivory highlights, and a soft dawn-like halo",
};

const categoryAction: Record<CosmiqAgendaCategory, readonly string[]> = {
  Mind: [
    "three small star-points form a gentle focus puzzle; the companion studies them and nudges the center point into place",
    "a small constellation diagram appears; the companion follows its path with alert eyes until it resolves into a calm orbit",
    "three floating geometric lights rearrange; the companion concentrates, selects the correct one, and settles into attentive stillness",
  ],
  Body: [
    "the companion rises, makes one confident full-body stretch, and plants into a ready stance",
    "a soft energy ring travels from paws to crown; the companion takes one grounded step forward and steadies",
    "the companion performs a compact warm-up shake, moves its shoulders, wings, fins, or body naturally, and assumes a focused ready pose",
  ],
  Soul: [
    "the companion closes its eyes for one peaceful breath as a soft heart-like light blooms and fades around it",
    "a gentle ring of light expands with the companion's slow breath; it opens its eyes calm and centered",
    "the companion bows toward a small luminous mote, receives its warm glow, and returns to serene stillness",
  ],
};

const universalAction: Record<Exclude<CosmiqAgendaEventType, "task-start" | "task-complete">, readonly string[]> = {
  ambient: [
    "the companion breathes naturally, blinks, and makes a tiny curious head movement before returning to rest",
    "the companion notices a drifting mote, tracks it with its eyes, and settles back into the exact resting pose",
    "the companion makes a subtle stretch with gentle secondary motion, then relaxes into centered stillness",
  ],
  encourage: [
    "the companion notices the viewer, leans forward with quiet confidence, and gives one warm encouraging gesture",
    "the companion gathers a small glow between its paws, wings, fins, or body and sends it forward as a gentle pulse of encouragement",
  ],
  "welcome-back": [
    "the companion wakes brightly, recognizes the returning viewer, and greets them with one delighted but restrained gesture",
    "the companion looks up in recognition as its aura brightens, circles once around it, and returns to a welcoming pose",
  ],
  milestone: [
    "the companion lifts proudly as a restrained halo of stars forms behind it, then lands in a confident hero pose",
    "the companion celebrates with one elegant species-appropriate flourish while a brief ring of light expands behind it",
  ],
};

const companionDefinitionBySpecies = new Map(
  COMPANION_PRESETS.map((preset) => [preset.id, preset] as const),
);

const getSpeciesIdentity = (species: CosmiqProductionSpecies): string => {
  const preset = companionDefinitionBySpecies.get(species);
  if (!preset) throw new Error(`Missing production companion definition: ${species}`);

  return `the exact same ${preset.displayName}: ${preset.signatureIdentity}. Keep this anatomy locked: ${preset.anatomyLock}`;
};

const getKnownPortraitSource = (
  species: CosmiqProductionSpecies,
  element: CosmiqProductionElement,
  boundaryLevel: (typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number],
): string | null => {
  const tier = stageAssetFolderByBoundary[boundaryLevel];
  const filename = `${species}__${tier}__normal__${element}.png`;
  const bundledPath = boundaryLevel === 5
    ? path.join(repoRoot, "tmp", "cosmiq-stage-sources", "t2", species, filename)
    : path.join(repoRoot, "public", "companion-presets", species, tier, "normal", filename);

  return fs.existsSync(bundledPath) ? bundledPath : null;
};

const getProductionPortraitPath = (
  species: CosmiqProductionSpecies,
  element: CosmiqProductionElement,
  boundaryLevel: (typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number],
): string => {
  const descriptor = getPremadeCompanionEvolutionAssetDescriptor({
    productMode: "cosmiq",
    species,
    element,
    boundaryLevel,
  });
  if (!descriptor) throw new Error(`Missing portrait contract: ${species}/${element}/level-${boundaryLevel}`);
  return path.join(outputRoot, descriptor.portraitStoragePath);
};

const getPortraitSource = (
  species: CosmiqProductionSpecies,
  element: CosmiqProductionElement,
  boundaryLevel: (typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number],
): string =>
  getKnownPortraitSource(species, element, boundaryLevel)
  ?? getProductionPortraitPath(species, element, boundaryLevel);

const basePrompt = ({
  species,
  element,
}: {
  species: CosmiqProductionSpecies;
  element: CosmiqProductionElement;
}) =>
  `Use the supplied portrait as the exact character identity, age, anatomy, elemental styling, background, composition, and camera reference. Preserve ${getSpeciesIdentity(species)}. ${elementDirection[element]} express the ${element} element without obscuring the companion.`;

const agendaPrompt = ({
  species,
  element,
  eventType,
  category,
  variant,
}: {
  species: CosmiqProductionSpecies;
  element: CosmiqProductionElement;
  eventType: CosmiqAgendaEventType;
  category: CosmiqAgendaCategory | null;
  variant: number;
}): string => {
  const action = category
    ? categoryAction[category][variant - 1]
    : universalAction[eventType as keyof typeof universalAction][variant - 1];
  const outcome = eventType === "task-complete"
    ? "The action resolves into a brief, satisfying reward pulse before"
    : "After the action,";

  return `Five-second square Cosmiq ${eventType} companion animation. ${basePrompt({ species, element })} ${action}. ${outcome} the companion returns naturally to the exact original centered resting pose. Premium painted fantasy-game motion, one continuous shot, fixed camera, subtle secondary motion. No text, letters, logos, humans, extra creatures, duplicate limbs, anatomy changes, age changes, morphing, cuts, camera movement, or audio.`;
};

const categoryIndex = (category: CosmiqAgendaCategory | null): number =>
  category ? COSMIQ_AGENDA_CATEGORIES.indexOf(category) : 0;

const agendaRecipeRank = ({
  eventType,
  category,
  variant,
}: {
  eventType: CosmiqAgendaEventType;
  category: CosmiqAgendaCategory | null;
  variant: number;
}): number => {
  if (variant === 1) {
    if (eventType === "task-start") return categoryIndex(category) * 10;
    if (eventType === "task-complete") return 30 + categoryIndex(category) * 10;
    if (eventType === "ambient") return 70;
    if (eventType === "encourage") return 80;
    if (eventType === "welcome-back") return 90;
    return 100;
  }

  const eventRank: Record<CosmiqAgendaEventType, number> = {
    "task-start": 0,
    "task-complete": 100,
    ambient: 200,
    encourage: 300,
    "welcome-back": 400,
    milestone: 500,
  };
  return 200 + eventRank[eventType] + categoryIndex(category) * 10 + (variant - 2);
};

const agendaPriority = ({
  boundaryLevel,
  eventType,
  category,
  variant,
}: {
  boundaryLevel: number;
  eventType: CosmiqAgendaEventType;
  category: CosmiqAgendaCategory | null;
  variant: number;
}): number => {
  const stageIndex = PREMADE_COMPANION_BOUNDARY_LEVELS.indexOf(
    boundaryLevel as (typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number],
  );
  return boundaryLevel === 1
    ? agendaRecipeRank({ eventType, category, variant })
    : 2_000 + Math.max(stageIndex, 0) * 1_000
      + agendaRecipeRank({ eventType, category, variant });
};

const getCombinationIndex = (
  species: CosmiqProductionSpecies,
  element: CosmiqProductionElement,
): number =>
  COSMIQ_PRODUCTION_SPECIES.indexOf(species) * COSMIQ_PRODUCTION_ELEMENTS.length
  + COSMIQ_PRODUCTION_ELEMENTS.indexOf(element);

const getInputStatus = (
  outputVideoPath: string,
  sourceImages: readonly string[],
): "complete" | "pending" | "blocked_source" => {
  if (fs.existsSync(outputVideoPath)) return "complete";
  return sourceImages.every((sourcePath) => fs.existsSync(sourcePath))
    ? "pending"
    : "blocked_source";
};

const agendaJobs = getExpectedCosmiqAgendaMotionAssets().map((asset) => {
  const outputVideoPath = path.join(outputRoot, asset.videoStoragePath);
  const outputStillPath = path.join(outputRoot, asset.stillStoragePath);
  const sourceImages = [getPortraitSource(asset.species, asset.element, asset.boundaryLevel)];
  return {
    id: [
      "agenda",
      asset.species,
      asset.element,
      `level-${asset.boundaryLevel}`,
      asset.eventType,
      asset.category?.toLowerCase() ?? "universal",
      asset.variant,
    ].join("__"),
    kind: "agenda" as const,
    priority: agendaPriority(asset),
    combinationIndex: getCombinationIndex(asset.species, asset.element),
    model: "Seedance 2.0 Unlimited",
    resolution: "720p",
    durationSeconds: 5,
    aspectRatio: "1:1",
    promptEnhancement: false,
    species: asset.species,
    element: asset.element,
    boundaryLevel: asset.boundaryLevel,
    eventType: asset.eventType,
    category: asset.category,
    variant: asset.variant,
    sourceImages,
    prompt: agendaPrompt(asset),
    outputVideoPath,
    outputStillPath,
    createsPortraitPath: null,
    status: getInputStatus(outputVideoPath, sourceImages),
  };
});

const evolutionJobs = COSMIQ_PRODUCTION_SPECIES.flatMap((species) =>
  COSMIQ_PRODUCTION_ELEMENTS.flatMap((element) =>
    PREMADE_COMPANION_BOUNDARY_LEVELS.map((boundaryLevel, boundaryIndex) => {
      const descriptor = getPremadeCompanionEvolutionAssetDescriptor({
        productMode: "cosmiq",
        species,
        element,
        boundaryLevel,
      });
      if (!descriptor) throw new Error(`Missing evolution contract: ${species}/${element}/level-${boundaryLevel}`);

      const outputVideoPath = path.join(outputRoot, descriptor.videoStoragePath);
      const targetPortraitPath = getProductionPortraitPath(species, element, boundaryLevel);
      const knownTargetSource = getKnownPortraitSource(species, element, boundaryLevel);
      const sourceImages = boundaryLevel === 1
        ? [
            path.join(repoRoot, "public", "companion-eggs", "v2", `egg__t0_egg__normal__${element}.webp`),
            getPortraitSource(species, element, boundaryLevel),
          ]
        : [
            getPortraitSource(
              species,
              element,
              descriptor.previousBoundaryLevel as (typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number],
            ),
            ...(knownTargetSource ? [knownTargetSource] : []),
          ];
      const prompt = boundaryLevel === 1
        ? `Five-second square Cosmiq hatch reveal. Reference image 1 is the exact elemental egg first frame and reference image 2 is the exact Level 1 companion final frame. The egg glows, opens in a controlled burst of ${elementDirection[element]}, and reveals ${getSpeciesIdentity(species)}. End perfectly aligned to reference image 2 and hold. Premium painted fantasy-game motion, one continuous shot, fixed camera, restrained particles. No text, logos, humans, extra creatures, duplicate limbs, anatomy changes, cuts, camera movement, or audio.`
        : knownTargetSource
          ? `Five-second square Cosmiq evolution. Reference image 1 is the exact starting companion and reference image 2 is the exact evolved final companion. A controlled cocoon of ${elementDirection[element]} envelops the companion and reveals the stronger evolved form. Preserve ${getSpeciesIdentity(species)} and transition anatomy smoothly without hybrids or duplicates. End perfectly aligned to reference image 2 and hold. Premium painted fantasy-game motion, one continuous shot, fixed camera. No text, logos, humans, extra creatures, duplicate limbs, cuts, camera movement, or audio.`
          : `Five-second square Cosmiq evolution from Level ${descriptor.previousBoundaryLevel} to Level ${boundaryLevel}. Use the supplied portrait as the exact starting companion, identity, elemental styling, composition, and camera reference. A controlled cocoon of ${elementDirection[element]} envelops the companion and reveals a visibly older, stronger, more majestic version of ${getSpeciesIdentity(species)}. Keep its colors, markings, face, and core silhouette recognizable; increase maturity and detail without changing species or creating hybrids. End on a clean, centered, motionless hero portrait suitable to extract as the exact Level ${boundaryLevel} reference frame. Premium painted fantasy-game motion, one continuous shot, fixed camera. No text, logos, humans, extra creatures, duplicate limbs, cuts, camera movement, or audio.`;

      return {
        id: `evolution__${species}__${element}__level-${descriptor.previousBoundaryLevel}-to-${boundaryLevel}`,
        kind: "evolution" as const,
        priority: boundaryLevel === 1 ? 60 : 110 + (boundaryIndex - 1) * 10,
        combinationIndex: getCombinationIndex(species, element),
        model: "Seedance 2.0 Unlimited",
        resolution: "720p",
        durationSeconds: 5,
        aspectRatio: "1:1",
        promptEnhancement: false,
        species,
        element,
        previousBoundaryLevel: descriptor.previousBoundaryLevel,
        boundaryLevel,
        sourceImages,
        prompt,
        outputVideoPath,
        outputStillPath: null,
        createsPortraitPath: knownTargetSource ? null : targetPortraitPath,
        status: getInputStatus(outputVideoPath, sourceImages),
      };
    }),
  ),
);

const jobs = [...agendaJobs, ...evolutionJobs].sort((left, right) =>
  left.priority - right.priority
  || left.combinationIndex - right.combinationIndex
  || left.id.localeCompare(right.id),
);
const blockedJobs = jobs.filter((job) => job.status === "blocked_source");
const missingSources = [...new Set(
  blockedJobs.flatMap((job) => job.sourceImages).filter((sourcePath) => !fs.existsSync(sourcePath)),
)];
const nextRunnableJob = jobs.find((job) => job.status === "pending") ?? null;

const queue = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  productionContract: {
    model: "Seedance 2.0 Unlimited",
    resolution: "720p",
    durationSeconds: 5,
    aspectRatio: "1:1",
    promptEnhancement: false,
    concurrency: 1,
    ordering: "coverage-first across all species/element combinations",
  },
  scope: {
    species: COSMIQ_PRODUCTION_SPECIES,
    elements: COSMIQ_PRODUCTION_ELEMENTS,
    combinations: COSMIQ_PRODUCTION_SPECIES.length * COSMIQ_PRODUCTION_ELEMENTS.length,
    boundaryLevels: PREMADE_COMPANION_BOUNDARY_LEVELS,
    agendaRecipesPerStage: COSMIQ_AGENDA_MOTION_RECIPES.length,
  },
  counts: {
    agenda: agendaJobs.length,
    evolution: evolutionJobs.length,
    total: jobs.length,
    complete: jobs.filter((job) => job.status === "complete").length,
    pending: jobs.filter((job) => job.status === "pending").length,
    blockedSource: blockedJobs.length,
  },
  nextRunnableJobId: nextRunnableJob?.id ?? null,
  missingSources,
  jobs,
};

fs.mkdirSync(queueDir, { recursive: true });
fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);

console.log(`Wrote ${queuePath}`);
console.log(
  `${queue.counts.total} jobs: ${queue.counts.agenda} agenda reactions + ${queue.counts.evolution} hatch/evolution videos.`,
);
console.log(
  `${queue.counts.complete} complete; ${queue.counts.pending} runnable; ${queue.counts.blockedSource} waiting for an evolution portrait.`,
);
console.log(`Next runnable job: ${queue.nextRunnableJobId ?? "none"}`);
if (missingSources.length > 0) {
  console.warn(
    `${missingSources.length} generated portrait inputs are not present yet; their jobs are explicitly blocked until the preceding evolution output is extracted.`,
  );
}
