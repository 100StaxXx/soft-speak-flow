import fs from "node:fs";
import path from "node:path";
import {
  COMPANION_PRESETS,
  type CompanionPresetId,
} from "@/config/companionCatalog";
import {
  REFERENCE_SHEET_DIR,
  buildReferenceSheetFilename,
  buildStage2SheetPrompt,
  coercePresetId,
  ensureDir,
  extractReferenceSheetToSingles,
  parseArgs,
} from "./companion-stage2-preview-utils";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5";
const DEFAULT_QUALITY = "high";
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

interface ResponsesOutputItem {
  type?: string;
  result?: string;
  revised_prompt?: string;
}

interface ResponsesPayload {
  output?: ResponsesOutputItem[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value) {
    throw new Error("Missing OPENAI_API_KEY in the environment.");
  }

  return value;
}

function getReferenceSheetPath(): string {
  const preferred = path.join(REFERENCE_SHEET_DIR, buildReferenceSheetFilename("dragon"));
  if (fs.existsSync(preferred)) return preferred;

  throw new Error(`Missing dragon reference sheet at ${preferred}. Extract the uploaded dragon sheet first.`);
}

function resolveTargetPresetIds(args: Record<string, string>): CompanionPresetId[] {
  if (args.preset) {
    return [coercePresetId(args.preset)];
  }

  return COMPANION_PRESETS
    .map((preset) => preset.id)
    .filter((presetId) => presetId !== "dragon");
}

async function generateSheet(params: {
  apiKey: string;
  model: string;
  quality: string;
  prompt: string;
  referenceImagePath: string;
}): Promise<{ imageBase64: string; revisedPrompt: string | null }> {
  const { apiKey, model, quality, prompt, referenceImagePath } = params;
  const base64Reference = fs.readFileSync(referenceImagePath).toString("base64");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:image/png;base64,${base64Reference}`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "image_generation",
            action: "generate",
            quality,
          },
        ],
      }),
    });

    const payload = await response.json() as ResponsesPayload;

    if (!response.ok) {
      const errorMessage = payload.error?.message || `Request failed with ${response.status}`;
      if (attempt < 3 && RETRYABLE_STATUS.has(response.status)) {
        await delay(4000 * attempt);
        continue;
      }
      throw new Error(errorMessage);
    }

    const imageCall = payload.output?.find((entry) => entry.type === "image_generation_call");
    if (imageCall?.result) {
      return {
        imageBase64: imageCall.result,
        revisedPrompt: imageCall.revised_prompt ?? null,
      };
    }

    if (attempt < 3) {
      await delay(3000 * attempt);
      continue;
    }

    throw new Error("Image generation response did not include an image_generation_call result.");
  }

  throw new Error("Image generation exhausted retries.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = getApiKey();
  const model = args.model || DEFAULT_MODEL;
  const quality = args.quality || DEFAULT_QUALITY;
  const referenceImagePath = getReferenceSheetPath();
  const targetPresetIds = resolveTargetPresetIds(args);

  ensureDir(REFERENCE_SHEET_DIR);

  for (const presetId of targetPresetIds) {
    const outputPath = path.join(REFERENCE_SHEET_DIR, buildReferenceSheetFilename(presetId));
    const shouldSkip = fs.existsSync(outputPath) && args.force !== "true";

    if (shouldSkip) {
      console.log(`Skipping ${presetId}; sheet already exists at ${outputPath}`);
      continue;
    }

    const prompt = buildStage2SheetPrompt(presetId);
    console.log(`Generating ${presetId} stage-2 sheet...`);
    const { imageBase64, revisedPrompt } = await generateSheet({
      apiKey,
      model,
      quality,
      prompt,
      referenceImagePath,
    });

    fs.writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));
    console.log(`Saved sheet -> ${outputPath}`);

    const extracted = await extractReferenceSheetToSingles({
      inputPath: outputPath,
      presetId,
    });
    console.log(`Extracted ${extracted.length} singles for ${presetId}`);

    if (revisedPrompt) {
      const promptPath = outputPath.replace(/\.png$/i, ".revised-prompt.txt");
      fs.writeFileSync(promptPath, `${revisedPrompt}\n`, "utf8");
      console.log(`Saved revised prompt -> ${promptPath}`);
    }

    await delay(1500);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
