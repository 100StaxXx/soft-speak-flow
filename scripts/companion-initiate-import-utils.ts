import path from "node:path";
import {
  buildCompanionPresetAssetPath,
  type CompanionElementId,
  type CompanionPresetId,
} from "@/config/companionCatalog";
import { ELEMENT_PANEL_ORDER } from "./companion-stage2-preview-utils";

export const PROJECT_ROOT = process.cwd();
export const DEFAULT_INITIATE_SOURCE_DIR = "/Users/macbookair/Documents/Initiate";
export const INITIATE_IMPORT_ROOT = path.join(PROJECT_ROOT, "output", "companion-initiate-import");
export const INITIATE_ASSET_OUTPUT_DIR = path.join(INITIATE_IMPORT_ROOT, "assets");
export const INITIATE_MANIFEST_DIR = path.join(INITIATE_IMPORT_ROOT, "manifests");
export const INITIATE_LOG_DIR = path.join(INITIATE_IMPORT_ROOT, "logs");
export const INITIATE_ART_TIER = "t2_initiate" as const;
export const INITIATE_VISUAL_STATE = "normal" as const;
export const INITIATE_STORAGE_BUCKET = "companion-presets";

export interface InitiateSheetSource {
  presetId: CompanionPresetId;
  sourceFilename: string;
}

export interface InitiatePlannedAsset {
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

export interface InitiateSheetPlan {
  presetId: CompanionPresetId;
  sourceFilename: string;
  sourcePath: string;
  assets: InitiatePlannedAsset[];
}

const INITIATE_SHEET_SOURCES: readonly InitiateSheetSource[] = [
  { presetId: "dragon", sourceFilename: "DragonInitiate.png" },
  { presetId: "wolf", sourceFilename: "WolfInitiate.png" },
  { presetId: "fox", sourceFilename: "KitsuneInitiate.png" },
  { presetId: "owl", sourceFilename: "OwlInitiate.png" },
  { presetId: "lion", sourceFilename: "LionInitiate.png" },
  { presetId: "phoenix", sourceFilename: "PhoenixInitiate.png" },
  { presetId: "pegasus", sourceFilename: "PegasusInitiate.png" },
  { presetId: "griffin", sourceFilename: "GriffinInitiate.png" },
  { presetId: "sphinx", sourceFilename: "SphinxInitiate.png" },
  { presetId: "leviathan", sourceFilename: "LeviathanInitiate.png" },
  { presetId: "mechanicaldragon", sourceFilename: "MechanicalDragonInitiate.png" },
  { presetId: "tanuki", sourceFilename: "TanukiInitiate.png" },
  { presetId: "buttercat", sourceFilename: "ButtercatInitiate.png" },
] as const;

export const getInitiateSheetSources = (): readonly InitiateSheetSource[] =>
  INITIATE_SHEET_SOURCES;

export const buildInitiateSheetPlans = ({
  sourceDir = DEFAULT_INITIATE_SOURCE_DIR,
  outputRoot = INITIATE_ASSET_OUTPUT_DIR,
}: {
  sourceDir?: string;
  outputRoot?: string;
} = {}): InitiateSheetPlan[] =>
  INITIATE_SHEET_SOURCES.map((sheet) => {
    const sourcePath = path.join(sourceDir, sheet.sourceFilename);
    const assets = ELEMENT_PANEL_ORDER.map((elementId, panelIndex) => {
      const storagePath = buildCompanionPresetAssetPath({
        presetId: sheet.presetId,
        tier: INITIATE_ART_TIER,
        state: INITIATE_VISUAL_STATE,
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
      } satisfies InitiatePlannedAsset;
    });

    return {
      presetId: sheet.presetId,
      sourceFilename: sheet.sourceFilename,
      sourcePath,
      assets,
    } satisfies InitiateSheetPlan;
  });

export const flattenInitiateSheetPlans = (plans: readonly InitiateSheetPlan[]): InitiatePlannedAsset[] =>
  plans.flatMap((sheet) => sheet.assets);

export const countInitiatePlannedAssets = (plans: readonly InitiateSheetPlan[]): number =>
  flattenInitiateSheetPlans(plans).length;
