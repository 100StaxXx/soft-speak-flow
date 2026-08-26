import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PREMADE_COMPANION_ASSET_VERSION,
  PREMADE_COMPANION_PORTRAIT_BUCKET,
  PREMADE_COMPANION_VIDEO_BUCKET,
  GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS,
  GRACEWARD_PREMADE_COMPANION_ELEMENTS,
  GRACEWARD_PREMADE_COMPANION_SPECIES,
  getExpectedPremadeCompanionEvolutionAssets,
  getExpectedPremadeGracewardFormationAssets,
} from "../src/config/premadeCompanionAssets.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "tmp", "higgsfield", "companion-premade");
const outputPath = path.join(outputDir, "manifest.json");
const progressionAssets = getExpectedPremadeCompanionEvolutionAssets();
const formationAssets = getExpectedPremadeGracewardFormationAssets();

const manifest = {
  schemaVersion: 2,
  assetVersion: PREMADE_COMPANION_ASSET_VERSION,
  generatedAt: new Date().toISOString(),
  releaseScope: {
    gracewardSpecies: GRACEWARD_PREMADE_COMPANION_SPECIES,
    gracewardElements: GRACEWARD_PREMADE_COMPANION_ELEMENTS,
    gracewardBoundaryLevels: GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS,
    gracewardMaximumVisualLevel:
      GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS.at(-1) ?? 0,
  },
  contract: {
    portraits: {
      bucket: PREMADE_COMPANION_PORTRAIT_BUCKET,
      format: "webp",
    },
    videos: {
      bucket: PREMADE_COMPANION_VIDEO_BUCKET,
      format: "mp4",
    },
  },
  counts: {
    progressionCombinations: new Set(
      progressionAssets.map((asset) =>
        `${asset.productMode}:${asset.species}:${asset.element}`
      ),
    ).size,
    progressionPortraitAssets: progressionAssets.length,
    progressionVideoAssets: progressionAssets.length,
    gracewardFormationVideoAssets: formationAssets.length,
    gracewardFormationStillAssets: formationAssets.length,
  },
  progressionAssets,
  gracewardFormationAssets: formationAssets,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${outputPath}`);
console.log(
  `Expected ${manifest.counts.progressionPortraitAssets} progression portraits, ${manifest.counts.progressionVideoAssets} progression videos, and ${manifest.counts.gracewardFormationVideoAssets} Graceward formation videos.`,
);
