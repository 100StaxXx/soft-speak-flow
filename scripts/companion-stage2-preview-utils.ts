import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  COMPANION_ELEMENTS,
  COMPANION_PRESETS,
  LEGACY_COMPANION_PRESETS,
  getCompanionStageName,
  type CompanionElementId,
  type CompanionPresetId,
} from "@/config/companionCatalog";

export const PROJECT_ROOT = process.cwd();
export const OUTPUT_ROOT = path.join(PROJECT_ROOT, "output/companion-stage2-previews");
export const MANIFEST_DIR = path.join(OUTPUT_ROOT, "manifests");
export const REFERENCE_SHEET_DIR = path.join(OUTPUT_ROOT, "reference-sheets");
export const SINGLE_ASSET_DIR = path.join(OUTPUT_ROOT, "singles");
export const CONTACT_SHEET_DIR = path.join(OUTPUT_ROOT, "contact-sheets");
export const REVIEW_INDEX_PATH = path.join(OUTPUT_ROOT, "index.html");

export const STAGE2 = 2 as const;
export const STAGE2_NAME = getCompanionStageName(STAGE2);
export const PANEL_COLUMNS = 3;
export const PANEL_ROWS = 2;

export const ELEMENT_PANEL_ORDER: readonly CompanionElementId[] = [
  "fire",
  "ice",
  "storm",
  "nature",
  "void",
  "light",
] as const;

const REVIEW_OUTPUT_SLUGS: Partial<Record<CompanionPresetId, string>> = {
  fox: "kitsune",
};

export interface CompanionStage2ManifestItem {
  id: string;
  presetId: CompanionPresetId;
  presetName: string;
  stage: typeof STAGE2;
  stageName: string;
  elementId: CompanionElementId;
  elementName: string;
  outputFilename: string;
  outputPath: string;
  contactSheetPath: string;
  styleReferenceLabel: string;
  styleReferencePath: string;
  signatureIdentity: string;
  anatomyLock: string;
  poseGuidance: string;
  prompt: string;
  constraints: string[];
}

export const SPECIES_POSE_GUIDANCE: Record<CompanionPresetId, string> = {
  dragon: "Seated young dragon with a curled tail, open baby wings, and a proud but gentle expression.",
  wolf: "Young wolf pup in a grounded seated pose with alert ears, forward paws, and a strong neck ruff silhouette.",
  fox: "Mystical seated kitsune pup with oversized ears, a graceful tail fan, fox-fire wisps, and a nimble playful posture.",
  owl: "Young owl perched in a compact upright pose with folded or slightly lifted wings and a readable facial disk.",
  lion: "Seated lion cub with broad paws, a small mane hint, and a calm regal expression.",
  phoenix: "Young phoenix perched in a compact avian pose with a flame crest, soft ember tail streamers, and radiant wing shape.",
  pegasus: "Young pegasus foal in a centered seated or tucked pose with feathered wings visible and no horn.",
  griffin: "Young griffin seated proudly with an eagle head, feathered forequarters, and leonine hindquarters kept fully readable.",
  sphinx: "Young sphinx in a poised seated lion pose with feathered wings visible and a calm, wise expression.",
  raven: "Young raven in a compact perched pose with a sleek hooked beak, intelligent eyes, and folded wings.",
  leviathan: "Coiled young leviathan rising from a centered base shape, fully aquatic and serpentine with no legs.",
  mechanicaldragon: "Young mechanical dragon seated with plated alloy scales, articulated wing struts, and a glowing engineered core.",
  tanuki: "Round tanuki pup in a cozy seated pose with a dark eye mask, plush striped tail, and playful posture.",
  buttercat: "Seated kitten with lifted butterfly wings, plush tail, and whimsical cat-first readability.",
};

export const ELEMENT_RENDER_GUIDANCE: Record<CompanionElementId, string> = {
  fire: "Warm ember reds and oranges, flame halo, sparks, scorched glow, molten light, and clear warm shifts in fur/feather/scale coloration.",
  ice: "Fully glacial; cold blue to cyan palette, crystalline frost, ice shards, snow drift, frozen mist, luminous frozen highlights, and fur/feather/scale coloration shifted into icy blue tones with no liquid splash or wave motifs.",
  storm: "Lightning forks, charged clouds, electric rim light, slate-violet sky energy, tempest atmosphere, and body coloration pushed toward stormy indigo and electric violet.",
  nature: "Verdant greens, living leaves, mossy warmth, soft flowers, sunlit plant growth, grounded organic calm, and body coloration shifted toward leaf-green and natural tones.",
  void: "Deep violet cosmic shadow, nebula particles, astral glow, dark contrast, floating arcane energy, and body coloration deepened into rich purple-black cosmic hues.",
  light: "Radiant gold and ivory, halo bloom, celestial dust, sunburst warmth, soft divine luminance, and body coloration brightened into creamy gold and warm light-infused tones.",
};

const PRESET_LOOKUP = new Map(
  [...COMPANION_PRESETS, ...LEGACY_COMPANION_PRESETS].map((preset) => [preset.id, preset] as const),
);
const ELEMENT_LOOKUP = new Map(COMPANION_ELEMENTS.map((element) => [element.id, element] as const));

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

export function coercePresetId(value: string | undefined): CompanionPresetId {
  if (!value || !PRESET_LOOKUP.has(value as CompanionPresetId)) {
    throw new Error(`Unknown preset id: ${value ?? "<missing>"}`);
  }

  return value as CompanionPresetId;
}

export function getPreset(presetId: CompanionPresetId) {
  return PRESET_LOOKUP.get(presetId)!;
}

export function getElement(elementId: CompanionElementId) {
  return ELEMENT_LOOKUP.get(elementId)!;
}

export function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;

    const raw = current.slice(2);
    const eqIndex = raw.indexOf("=");
    if (eqIndex >= 0) {
      result[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[raw] = "true";
      continue;
    }

    result[raw] = next;
    index += 1;
  }

  return result;
}

export function buildSingleOutputFilename(presetId: CompanionPresetId, elementId: CompanionElementId): string {
  const reviewSlug = REVIEW_OUTPUT_SLUGS[presetId] ?? presetId;
  return `${reviewSlug}__stage${STAGE2}__${elementId}.png`;
}

export function buildSingleOutputPath(presetId: CompanionPresetId, elementId: CompanionElementId): string {
  const reviewSlug = REVIEW_OUTPUT_SLUGS[presetId] ?? presetId;
  return path.join(SINGLE_ASSET_DIR, reviewSlug, buildSingleOutputFilename(presetId, elementId));
}

export function buildSingleOutputDir(presetId: CompanionPresetId): string {
  const reviewSlug = REVIEW_OUTPUT_SLUGS[presetId] ?? presetId;
  return path.join(SINGLE_ASSET_DIR, reviewSlug);
}

export function buildContactSheetFilename(presetId: CompanionPresetId): string {
  const reviewSlug = REVIEW_OUTPUT_SLUGS[presetId] ?? presetId;
  return `${reviewSlug}__stage${STAGE2}__contact-sheet.png`;
}

export function buildContactSheetPath(presetId: CompanionPresetId): string {
  return path.join(CONTACT_SHEET_DIR, buildContactSheetFilename(presetId));
}

export function buildReferenceSheetFilename(presetId: CompanionPresetId, extension = ".png"): string {
  const reviewSlug = REVIEW_OUTPUT_SLUGS[presetId] ?? presetId;
  return `${reviewSlug}__stage${STAGE2}__reference-sheet${extension}`;
}

export function buildReferenceSheetPath(presetId: CompanionPresetId, extension = ".png"): string {
  return path.join(REFERENCE_SHEET_DIR, buildReferenceSheetFilename(presetId, extension));
}

function buildPrompt(presetId: CompanionPresetId, elementId: CompanionElementId): string {
  const preset = getPreset(presetId);
  const element = getElement(elementId);

  return [
    "Use case: illustration-story",
    "Asset type: mobile companion stage-2 review render",
    `Primary request: Create a single fantasy companion portrait for the ${preset.displayName} species at stage 2 (${STAGE2_NAME}), matching the uploaded six-panel dragon standard for quality, maturity, lighting richness, palette intensity, and premium mobile-game art polish.`,
    "Input images: The uploaded dragon six-panel sheet is the style and rendering reference only.",
    "Scene/backdrop: Element-driven magical backdrop with enough atmosphere to sell the element, while keeping the creature cleanly readable and easy to isolate later.",
    `Subject: ${preset.displayName} youngling companion; ${preset.signatureIdentity}; ${SPECIES_POSE_GUIDANCE[presetId]}`,
    "Style/medium: Polished fantasy illustration with a cute creature-collector mascot feel, painterly but crisp, large expressive eyes, rounded appealing shapes, premium collectible art, no text.",
    "Composition/framing: Centered portrait, similar scale to the dragon standard, full body visible, species-specific pose allowed, keep signature anatomy fully visible.",
    "Lighting/mood: Cinematic elemental glow, rich contrast, soft rim light, expressive but readable mood.",
    `Color palette: ${element.label}; ${ELEMENT_RENDER_GUIDANCE[elementId]}`,
    "Element behavior: The creature's fur, feathers, scales, or skin should visibly shift color with the chosen element rather than staying neutral while only the background changes.",
    `Constraints: Preserve anatomy lock exactly: ${preset.anatomyLock}. Keep it clearly stage 2 / youngling. No rider, no armor, no props, no extra creatures, no watermark, no text, no cropped anatomy.`,
    "Avoid: anatomy drift, generic dragon features on non-dragons, duplicated limbs, clipped wings, clipped tails, human facial structure, muddy silhouettes, over-busy backgrounds.",
  ].join("\n");
}

export function buildStage2Manifest(): CompanionStage2ManifestItem[] {
  return COMPANION_PRESETS.flatMap((preset) =>
    ELEMENT_PANEL_ORDER.map((elementId) => {
      const element = getElement(elementId);
      const outputPath = buildSingleOutputPath(preset.id, elementId);
      return {
        id: `${preset.id}__stage${STAGE2}__${elementId}`,
        presetId: preset.id,
        presetName: preset.displayName,
        stage: STAGE2,
        stageName: STAGE2_NAME,
        elementId,
        elementName: element.label,
        outputFilename: path.basename(outputPath),
        outputPath,
        contactSheetPath: buildContactSheetPath(preset.id),
        styleReferenceLabel: "Dragon six-panel stage-2 standard",
        styleReferencePath: buildReferenceSheetPath("dragon"),
        signatureIdentity: preset.signatureIdentity,
        anatomyLock: preset.anatomyLock,
        poseGuidance: SPECIES_POSE_GUIDANCE[preset.id],
        prompt: buildPrompt(preset.id, elementId),
        constraints: [
          `stage ${STAGE2} only`,
          "match dragon standard maturity closely",
          "species-specific pose allowed",
          "centered portrait framing",
          "no text or watermark",
          "ice must read fully glacial",
        ],
      } satisfies CompanionStage2ManifestItem;
    }),
  );
}

export function buildStage2PromptMarkdown(items: CompanionStage2ManifestItem[]): string {
  const groups = new Map<CompanionPresetId, CompanionStage2ManifestItem[]>();

  for (const item of items) {
    const current = groups.get(item.presetId) ?? [];
    current.push(item);
    groups.set(item.presetId, current);
  }

  const lines: string[] = [
    "# Companion Stage-2 Prompt Pack",
    "",
    "Reference standard: uploaded six-panel dragon sheet",
    "",
    `Stage target: \`${STAGE2}\` (${STAGE2_NAME})`,
    "",
    "Elements: `fire`, `ice`, `storm`, `nature`, `void`, `light`",
    "",
  ];

  for (const preset of COMPANION_PRESETS) {
    const itemsForPreset = groups.get(preset.id) ?? [];
    lines.push(`## ${preset.displayName}`);
    lines.push("");
    lines.push(`- Signature identity: ${preset.signatureIdentity}`);
    lines.push(`- Anatomy lock: ${preset.anatomyLock}`);
    lines.push(`- Pose guidance: ${SPECIES_POSE_GUIDANCE[preset.id]}`);
    lines.push("");

    for (const item of itemsForPreset) {
      lines.push(`### ${item.elementName}`);
      lines.push("");
      lines.push("```text");
      lines.push(item.prompt);
      lines.push("```");
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function buildStage2SheetPrompt(presetId: CompanionPresetId): string {
  const preset = getPreset(presetId);

  const panelDirections = ELEMENT_PANEL_ORDER.map((elementId, index) => {
    const element = getElement(elementId);
    return `${index + 1}. ${element.label}: ${ELEMENT_RENDER_GUIDANCE[elementId]}`;
  }).join("\n");

  return [
    "Create a single square fantasy illustration laid out as a clean 2x3 grid of six full-bleed panels.",
    "Use the uploaded six-panel dragon reference image for rendering quality, age target, panel layout, lighting richness, palette intensity, and premium mobile-game collectible polish only.",
    `The subject in all six panels is the ${preset.displayName} species at stage 2 (${STAGE2_NAME}).`,
    `Species identity: ${preset.signatureIdentity}.`,
    `Anatomy lock: ${preset.anatomyLock}.`,
    `Pose guidance: ${SPECIES_POSE_GUIDANCE[presetId]}`,
    "Keep the same youngling age, the same approximate framing, and the same core pose/composition across all six panels so only the elemental treatment changes.",
    "The creature's fur, feathers, scales, or skin must visibly change color with each element, not just the background and effects.",
    "The overall feel should read like a premium cute creature-collector mascot, with broad appeal, expressive eyes, and polished fantasy game rendering.",
    "Do not make this creature look like a dragon unless the species is dragon.",
    "No text, no labels, no watermark, no logo, no props, no rider, no border ornaments.",
    "Panel order must be exact:",
    panelDirections,
    "Ice must be fully glacial: crystalline frost, frozen mist, snow drift, ice shards, cold cyan-blue highlights, and absolutely no liquid waves or splash motifs.",
    "Each panel should have a distinct elemental backdrop and color treatment, while preserving the same creature identity and anatomy.",
  ].join("\n");
}

export function getSliceBounds(total: number, segments: number, index: number) {
  const start = Math.round((total * index) / segments);
  const end = Math.round((total * (index + 1)) / segments);
  return {
    start,
    size: end - start,
  };
}

export async function extractReferenceSheetToSingles(params: {
  inputPath: string;
  presetId: CompanionPresetId;
  stage?: number;
}): Promise<string[]> {
  const { inputPath, presetId, stage = STAGE2 } = params;

  if (stage !== STAGE2) {
    throw new Error(`This extractor is locked to stage ${STAGE2} reference sheets.`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read dimensions from input file: ${inputPath}`);
  }

  ensureDir(buildSingleOutputDir(presetId));

  const outputPaths: string[] = [];

  for (let index = 0; index < ELEMENT_PANEL_ORDER.length; index += 1) {
    const row = Math.floor(index / PANEL_COLUMNS);
    const column = index % PANEL_COLUMNS;
    const xBounds = getSliceBounds(metadata.width, PANEL_COLUMNS, column);
    const yBounds = getSliceBounds(metadata.height, PANEL_ROWS, row);
    const elementId = ELEMENT_PANEL_ORDER[index];
    const outputPath = buildSingleOutputPath(presetId, elementId);

    await image
      .clone()
      .extract({
        left: xBounds.start,
        top: yBounds.start,
        width: xBounds.size,
        height: yBounds.size,
      })
      .png()
      .toFile(outputPath);

    outputPaths.push(outputPath);
  }

  return outputPaths;
}
