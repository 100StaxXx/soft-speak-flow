import fs from "node:fs";
import path from "node:path";
import {
  COMPANION_ART_TIER_RANGES,
  COMPANION_ELEMENTS,
  COMPANION_EXPRESSION_MOODS,
  COMPANION_PRESETS,
  buildCompanionExpressiveAssetFilename,
  resolveCompanionStorageArtTier,
  type CompanionArtTier,
  type CompanionElementId,
  type CompanionExpressionMood,
  type CompanionPresetId,
} from "@/config/companionCatalog";

export const PROJECT_ROOT = process.cwd();
export const OUTPUT_ROOT = path.join(PROJECT_ROOT, "output/companion-expressive-previews");
export const MANIFEST_DIR = path.join(OUTPUT_ROOT, "manifests");
export const SINGLE_ASSET_DIR = path.join(OUTPUT_ROOT, "singles");
export const CONTACT_SHEET_DIR = path.join(OUTPUT_ROOT, "contact-sheets");

export const EXPRESSIVE_TIERS = ["t1_hatchling", "t2_initiate"] as const satisfies readonly CompanionArtTier[];
export const EXPRESSIVE_VARIANTS = [1, 2, 3, 4, 5] as const;

const EXPRESSION_DIRECTION: Record<CompanionExpressionMood, string> = {
  excited: "bright-eyed, celebratory, energetic, proud, and lifted",
  happy: "warm, pleased, companionable, and engaged",
  calm: "steady, relaxed, attentive, and quietly alive",
  concerned: "slightly worried, softened, protective, and gently downcast",
  sleepy: "drowsy, cozy, slow-breathing, and end-of-day gentle",
};

const VARIANT_FLAVOR: Record<number, string> = {
  1: "baseline expression, straight read, most neutral camera",
  2: "subtle head angle shift, small asymmetry, same silhouette",
  3: "slightly stronger eye expression, same framing and anatomy",
  4: "micro-pose variation with the same silhouette lock and crop",
  5: "most expressive readable variant while preserving the same model sheet identity",
};

const PRESET_LOOKUP = new Map(COMPANION_PRESETS.map((preset) => [preset.id, preset] as const));
const ELEMENT_LOOKUP = new Map(COMPANION_ELEMENTS.map((element) => [element.id, element] as const));
const TIER_LOOKUP = new Map(COMPANION_ART_TIER_RANGES.map((tier) => [tier.id, tier] as const));

export interface CompanionExpressiveManifestItem {
  id: string;
  presetId: CompanionPresetId;
  presetName: string;
  tier: CompanionArtTier;
  tierLabel: string;
  storageTier: string;
  elementId: CompanionElementId;
  elementName: string;
  mood: CompanionExpressionMood;
  variant: number;
  outputFilename: string;
  outputPath: string;
  contactSheetPath: string;
  prompt: string;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(filePath: string, value: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

export const buildExpressiveSingleOutputPath = ({
  presetId,
  tier,
  elementId,
  mood,
  variant,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  elementId: CompanionElementId;
  mood: CompanionExpressionMood;
  variant: number;
}): string =>
  path.join(
    SINGLE_ASSET_DIR,
    presetId,
    resolveCompanionStorageArtTier(
      tier === "t1_hatchling" || tier === "t2_initiate" ? (tier === "t1_hatchling" ? 1 : 5) : 1,
    ),
    elementId,
    mood,
    buildCompanionExpressiveAssetFilename({
      presetId,
      tier,
      mood,
      variant,
      element: elementId,
    }),
  );

export const buildExpressiveContactSheetPath = ({
  presetId,
  tier,
  elementId,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  elementId: CompanionElementId;
}): string =>
  path.join(
    CONTACT_SHEET_DIR,
    `${presetId}__${resolveCompanionStorageArtTier(tier === "t1_hatchling" ? 1 : 5)}__${elementId}__expressions.png`,
  );

const buildPrompt = ({
  presetId,
  tier,
  elementId,
  mood,
  variant,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  elementId: CompanionElementId;
  mood: CompanionExpressionMood;
  variant: number;
}): string => {
  const preset = PRESET_LOOKUP.get(presetId)!;
  const element = ELEMENT_LOOKUP.get(elementId)!;
  const tierMeta = TIER_LOOKUP.get(tier)!;

  return [
    "Use case: expressive companion portrait variant",
    `Subject: ${preset.displayName} ${tierMeta.label.toLowerCase()} companion`,
    `Identity lock: ${preset.signatureIdentity}; ${preset.anatomyLock}`,
    `Element: ${element.label}; preserve the element palette and ambient effects already established for this asset line.`,
    `Expression target: ${mood}; ${EXPRESSION_DIRECTION[mood]}`,
    `Variant target: v${variant}; ${VARIANT_FLAVOR[variant]}`,
    "Composition: identical crop family, silhouette lock, anatomy lock, and general pose family to the matching base tier portrait.",
    "Constraints: transparent background, readable full-body portrait, no text, no props, no anatomy drift, no framing drift.",
    "Output: one square portrait that reads as the same companion model sheet, just with a distinct emotional beat.",
  ].join("\n");
};

export const buildCompanionExpressiveManifest = (): CompanionExpressiveManifestItem[] =>
  COMPANION_PRESETS.flatMap((preset) =>
    EXPRESSIVE_TIERS.flatMap((tier) =>
      COMPANION_ELEMENTS.flatMap((element) =>
        COMPANION_EXPRESSION_MOODS.flatMap((mood) =>
          EXPRESSIVE_VARIANTS.map((variant) => {
            const outputPath = buildExpressiveSingleOutputPath({
              presetId: preset.id,
              tier,
              elementId: element.id,
              mood,
              variant,
            });

            return {
              id: `${preset.id}__${tier}__${element.id}__${mood}__v${variant}`,
              presetId: preset.id,
              presetName: preset.displayName,
              tier,
              tierLabel: TIER_LOOKUP.get(tier)?.label ?? tier,
              storageTier: resolveCompanionStorageArtTier(tier === "t1_hatchling" ? 1 : 5),
              elementId: element.id,
              elementName: element.label,
              mood,
              variant,
              outputFilename: path.basename(outputPath),
              outputPath,
              contactSheetPath: buildExpressiveContactSheetPath({
                presetId: preset.id,
                tier,
                elementId: element.id,
              }),
              prompt: buildPrompt({
                presetId: preset.id,
                tier,
                elementId: element.id,
                mood,
                variant,
              }),
            } satisfies CompanionExpressiveManifestItem;
          }),
        ),
      ),
    ),
  );

export const buildCompanionExpressivePromptMarkdown = (
  items: CompanionExpressiveManifestItem[],
): string => {
  const lines: string[] = [
    "# Companion Expressive Portrait Prompt Pack",
    "",
    "Tiers: `t1_hatchling`, `t2_initiate`",
    "Moods: `excited`, `happy`, `calm`, `concerned`, `sleepy`",
    "Variants: `v1` to `v5` per mood",
    "",
  ];

  for (const item of items) {
    lines.push(`## ${item.presetName} · ${item.tierLabel} · ${item.elementName} · ${item.mood} · v${item.variant}`);
    lines.push("");
    lines.push("```text");
    lines.push(item.prompt);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
};
