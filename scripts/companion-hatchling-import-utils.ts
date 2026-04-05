import path from "node:path";
import {
  buildCompanionPresetAssetPath,
  type CompanionElementId,
  type CompanionPresetId,
} from "@/config/companionCatalog";
import { ELEMENT_PANEL_ORDER } from "./companion-stage2-preview-utils";

export const PROJECT_ROOT = process.cwd();
export const DEFAULT_HATCHLING_SOURCE_DIR = "/Users/macbookair/Documents/Cosmiq Companion Images/Hatchlings";
export const HATCHLING_IMPORT_ROOT = path.join(PROJECT_ROOT, "output", "companion-hatchling-import");
export const HATCHLING_ASSET_OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "companion-presets");
export const HATCHLING_MANIFEST_DIR = path.join(HATCHLING_IMPORT_ROOT, "manifests");
export const HATCHLING_LOG_DIR = path.join(HATCHLING_IMPORT_ROOT, "logs");
export const HATCHLING_ART_TIER = "t1_hatchling" as const;
export const HATCHLING_VISUAL_STATE = "normal" as const;

export interface HatchlingSheetSource {
  presetId: CompanionPresetId;
  sourceFilename: string;
}

export interface HatchlingPlannedAsset {
  presetId: CompanionPresetId;
  elementId: CompanionElementId;
  panelIndex: number;
  row: number;
  column: number;
  sourceFilename: string;
  sourcePath: string;
  storagePath: string;
  outputPath: string;
  outputFilename: string;
}

export interface HatchlingSheetPlan {
  presetId: CompanionPresetId;
  sourceFilename: string;
  sourcePath: string;
  assets: HatchlingPlannedAsset[];
}

const HATCHLING_SHEET_SOURCES: readonly HatchlingSheetSource[] = [
  { presetId: "dragon", sourceFilename: "HatchlingDragon.png" },
  { presetId: "wolf", sourceFilename: "HatchlingWolf.png" },
  { presetId: "fox", sourceFilename: "HatchlingKitsune.png" },
  { presetId: "owl", sourceFilename: "HatchlingOwl.png" },
  { presetId: "lion", sourceFilename: "HatchlingLion.png" },
  { presetId: "phoenix", sourceFilename: "HatchlingPhoenix.png" },
  { presetId: "pegasus", sourceFilename: "HatchlingPegasus.png" },
  { presetId: "griffin", sourceFilename: "HatchlingGriffin.png" },
  { presetId: "sphinx", sourceFilename: "HatchlingSphinx.png" },
  { presetId: "leviathan", sourceFilename: "HatchlingLeviathan.png" },
  { presetId: "mechanicaldragon", sourceFilename: "HatchlingMechanicalDragon.png" },
  { presetId: "tanuki", sourceFilename: "HatchlingTanuki.png" },
  { presetId: "buttercat", sourceFilename: "HatchlingButtercat.png" },
] as const;

export const getHatchlingSheetSources = (): readonly HatchlingSheetSource[] =>
  HATCHLING_SHEET_SOURCES;

export const buildHatchlingSheetPlans = ({
  sourceDir = DEFAULT_HATCHLING_SOURCE_DIR,
  outputRoot = HATCHLING_ASSET_OUTPUT_DIR,
}: {
  sourceDir?: string;
  outputRoot?: string;
} = {}): HatchlingSheetPlan[] =>
  HATCHLING_SHEET_SOURCES.map((sheet) => {
    const sourcePath = path.join(sourceDir, sheet.sourceFilename);
    const assets = ELEMENT_PANEL_ORDER.map((elementId, panelIndex) => {
      const storagePath = buildCompanionPresetAssetPath({
        presetId: sheet.presetId,
        tier: HATCHLING_ART_TIER,
        state: HATCHLING_VISUAL_STATE,
        element: elementId,
      });

      return {
        presetId: sheet.presetId,
        elementId,
        panelIndex,
        row: Math.floor(panelIndex / 3),
        column: panelIndex % 3,
        sourceFilename: sheet.sourceFilename,
        sourcePath,
        storagePath,
        outputPath: path.join(outputRoot, storagePath),
        outputFilename: path.basename(storagePath),
      } satisfies HatchlingPlannedAsset;
    });

    return {
      presetId: sheet.presetId,
      sourceFilename: sheet.sourceFilename,
      sourcePath,
      assets,
    } satisfies HatchlingSheetPlan;
  });

export const flattenHatchlingSheetPlans = (plans: readonly HatchlingSheetPlan[]): HatchlingPlannedAsset[] =>
  plans.flatMap((sheet) => sheet.assets);

export const countHatchlingPlannedAssets = (plans: readonly HatchlingSheetPlan[]): number =>
  flattenHatchlingSheetPlans(plans).length;
