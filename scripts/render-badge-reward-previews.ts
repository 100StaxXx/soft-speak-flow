import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  BADGE_ASSET_DIR,
  REWARD_ASSET_DIR,
  LOG_DIR,
  MANIFEST_DIR,
  type BadgeManifestItem,
  type RewardManifestItem,
  ensureDir,
  loadEnvFromFiles,
  writeJson,
} from "./badge-reward-preview-utils";

type RenderStatus = "generated" | "fallback" | "existing" | "failed";

interface RenderResult {
  kind: "badge" | "reward";
  id: string;
  outputPath: string;
  status: RenderStatus;
  attempts: number;
  message?: string;
}

const BADGE_TIER_GRADIENTS: Record<string, [string, string]> = {
  bronze: ["#b45309", "#f97316"],
  silver: ["#64748b", "#cbd5e1"],
  gold: ["#b45309", "#facc15"],
  platinum: ["#6d28d9", "#a855f7"],
};

const REWARD_RARITY_GRADIENTS: Record<string, [string, string]> = {
  common: ["#475569", "#94a3b8"],
  rare: ["#1d4ed8", "#38bdf8"],
  epic: ["#6d28d9", "#c084fc"],
  legendary: ["#92400e", "#f59e0b"],
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function motifMarkup(seed: string, accentColor: string): string {
  const motif = hashSeed(seed) % 4;

  switch (motif) {
    case 0:
      return `
  <polygon
    points="256,133 287,215 375,215 304,266 332,348 256,294 180,348 208,266 137,215 225,215"
    fill="${accentColor}"
    fill-opacity="0.78"
  />
`.trim();
    case 1:
      return `
  <path
    d="M256 125 L355 225 L256 375 L157 225 Z"
    fill="${accentColor}"
    fill-opacity="0.78"
  />
  <path
    d="M256 161 L318 225 L256 321 L194 225 Z"
    fill="rgba(255,255,255,0.33)"
  />
`.trim();
    case 2:
      return `
  <path
    d="M256 122 C301 150 343 158 372 158 C372 279 327 353 256 390 C185 353 140 279 140 158 C169 158 211 150 256 122 Z"
    fill="${accentColor}"
    fill-opacity="0.76"
  />
  <circle cx="256" cy="235" r="46" fill="rgba(255,255,255,0.28)" />
`.trim();
    default:
      return `
  <circle cx="256" cy="215" r="91" fill="${accentColor}" fill-opacity="0.7" />
  <circle cx="226" cy="190" r="27" fill="rgba(255,255,255,0.36)" />
  <circle cx="292" cy="249" r="17" fill="rgba(255,255,255,0.25)" />
  <circle cx="256" cy="215" r="53" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="8" />
`.trim();
  }
}

function createSymbolicSvg(params: {
  seed: string;
  leftColor: string;
  rightColor: string;
  accentColor: string;
}) {
  const { seed, leftColor, rightColor, accentColor } = params;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${leftColor}" />
      <stop offset="100%" stop-color="${rightColor}" />
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="45%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.65" />
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="96" fill="url(#bg)" />
  <circle cx="256" cy="215" r="140" fill="url(#halo)" />
  <circle cx="256" cy="215" r="99" fill="rgba(255,255,255,0.08)" />
  ${motifMarkup(seed, accentColor)}
</svg>
`.trim();
}

async function writeWebpFromSvg(svgMarkup: string, outputPath: string): Promise<void> {
  const webpBuffer = await sharp(Buffer.from(svgMarkup))
    .webp({ quality: 88, effort: 3 })
    .toBuffer();
  fs.writeFileSync(outputPath, webpBuffer);
}

function normalizeImagePayload(payload: any): string | null {
  const imageUrl = payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof imageUrl === "string" && imageUrl.length > 0) return imageUrl;

  const imageData = payload?.data?.[0]?.b64_json
    || payload?.choices?.[0]?.message?.images?.[0]?.b64_json;
  if (typeof imageData === "string" && imageData.length > 0) {
    return `data:image/png;base64,${imageData}`;
  }

  return null;
}

async function tryAiRender(params: {
  itemKind: "badge" | "reward";
  id: string;
  title: string;
  icon: string;
  promptDetail: string;
  outputPath: string;
  env: Record<string, string>;
}): Promise<boolean> {
  const { itemKind, id, title, icon, promptDetail, outputPath, env } = params;

  if (String(env.BADGE_REWARD_PREVIEW_DISABLE_AI || "").toLowerCase() === "true") {
    return false;
  }

  const apiKey = env.OPENAI_API_KEY || env.BADGE_REWARD_PREVIEW_API_KEY;
  if (!apiKey) return false;

  const baseUrl = env.BADGE_REWARD_PREVIEW_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = env.BADGE_REWARD_PREVIEW_MODEL || "google/gemini-2.5-flash-image-preview";

  const prompt = [
    "Create a square 1:1 symbolic fantasy game badge art.",
    "No text, no numbers, no logos, no watermark.",
    "Single subject icon motif, clean composition, high contrast, vivid cinematic lighting.",
    "Style: polished mobile game collectible thumbnail.",
    `Object theme: ${title}.`,
    `Symbol anchor: ${icon}.`,
    `Additional direction: ${promptDetail}.`,
  ].join(" ");

  for (let attempt = 1; attempt <= 2; attempt++) {
    const requestController = new AbortController();
    const timeout = setTimeout(() => requestController.abort(), 20_000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_size: "1024x1024",
      }),
      signal: requestController.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      if (attempt === 2) {
        console.warn(`[AI:${itemKind}] ${id} failed (${response.status}) after retry.`);
      }
      continue;
    }

    const payload = await response.json();
    const imagePayload = normalizeImagePayload(payload);
    if (!imagePayload) {
      if (attempt === 2) {
        console.warn(`[AI:${itemKind}] ${id} returned no image payload.`);
      }
      continue;
    }

    let rawImageBuffer: Buffer;
    if (imagePayload.startsWith("data:image")) {
      const base64 = imagePayload.split(",")[1] ?? "";
      rawImageBuffer = Buffer.from(base64, "base64");
    } else {
      const imageController = new AbortController();
      const imageTimeout = setTimeout(() => imageController.abort(), 20_000);
      const imageResponse = await fetch(imagePayload, {
        signal: imageController.signal,
      }).finally(() => clearTimeout(imageTimeout));
      if (!imageResponse.ok) {
        if (attempt === 2) {
          console.warn(`[AI:${itemKind}] ${id} image URL download failed (${imageResponse.status}).`);
        }
        continue;
      }
      const arr = await imageResponse.arrayBuffer();
      rawImageBuffer = Buffer.from(arr);
    }

    const webpBuffer = await sharp(rawImageBuffer)
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 92, effort: 6 })
      .toBuffer();

    fs.writeFileSync(outputPath, webpBuffer);
    return true;
  }

  return false;
}

async function renderBadge(
  badge: BadgeManifestItem,
  env: Record<string, string>,
  forceRegenerate: boolean,
): Promise<RenderResult> {
  const outputPath = path.join(BADGE_ASSET_DIR, `${badge.id}.webp`);
  const [leftColor, rightColor] = BADGE_TIER_GRADIENTS[badge.tier] ?? BADGE_TIER_GRADIENTS.silver;
  const accentColor = rightColor;

  try {
    if (!forceRegenerate && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return {
        kind: "badge",
        id: badge.id,
        outputPath,
        status: "existing",
        attempts: 0,
        message: "Reused existing local asset.",
      };
    }

    const aiGenerated = await tryAiRender({
      itemKind: "badge",
      id: badge.id,
      title: badge.title,
      icon: badge.icon,
      promptDetail: `Tier ${badge.tier}; category ${badge.category}.`,
      outputPath,
      env,
    });

    if (aiGenerated) {
      return { kind: "badge", id: badge.id, outputPath, status: "generated", attempts: 1 };
    }

    await writeWebpFromSvg(
      createSymbolicSvg({
        seed: `${badge.id}:${badge.icon}`,
        leftColor,
        rightColor,
        accentColor,
      }),
      outputPath,
    );

    return {
      kind: "badge",
      id: badge.id,
      outputPath,
      status: "fallback",
      attempts: 1,
      message: "AI unavailable or failed; used deterministic fallback renderer.",
    };
  } catch (error) {
    return {
      kind: "badge",
      id: badge.id,
      outputPath,
      status: "failed",
      attempts: 1,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function renderReward(
  reward: RewardManifestItem,
  env: Record<string, string>,
  forceRegenerate: boolean,
): Promise<RenderResult> {
  const outputPath = path.join(REWARD_ASSET_DIR, `${reward.id}.webp`);
  const [leftColor, rightColor] = REWARD_RARITY_GRADIENTS[reward.rarity] ?? REWARD_RARITY_GRADIENTS.common;
  const accentColor = rightColor;

  try {
    if (!forceRegenerate && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return {
        kind: "reward",
        id: reward.id,
        outputPath,
        status: "existing",
        attempts: 0,
        message: "Reused existing local asset.",
      };
    }

    const aiGenerated = await tryAiRender({
      itemKind: "reward",
      id: reward.id,
      title: reward.name,
      icon: reward.icon,
      promptDetail: `Reward type ${reward.reward_type}; rarity ${reward.rarity}; effect keys: ${reward.css_effect_keys.join(", ") || "none"}.`,
      outputPath,
      env,
    });

    if (aiGenerated) {
      return { kind: "reward", id: reward.id, outputPath, status: "generated", attempts: 1 };
    }

    await writeWebpFromSvg(
      createSymbolicSvg({
        seed: `${reward.id}:${reward.icon}:${reward.reward_type}`,
        leftColor,
        rightColor,
        accentColor,
      }),
      outputPath,
    );

    return {
      kind: "reward",
      id: reward.id,
      outputPath,
      status: "fallback",
      attempts: 1,
      message: "AI unavailable or failed; used deterministic fallback renderer.",
    };
  } catch (error) {
    return {
      kind: "reward",
      id: reward.id,
      outputPath,
      status: "failed",
      attempts: 1,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function retryFailures(
  failed: RenderResult[],
  badgesById: Map<string, BadgeManifestItem>,
  rewardsById: Map<string, RewardManifestItem>,
  env: Record<string, string>,
  forceRegenerate: boolean,
): Promise<RenderResult[]> {
  const retried: RenderResult[] = [];

  for (const result of failed) {
    if (result.kind === "badge") {
      const badge = badgesById.get(result.id);
      if (!badge) continue;
      const next = await renderBadge(badge, env, forceRegenerate);
      retried.push({ ...next, attempts: result.attempts + 1 });
      continue;
    }

    const reward = rewardsById.get(result.id);
    if (!reward) continue;
    const next = await renderReward(reward, env, forceRegenerate);
    retried.push({ ...next, attempts: result.attempts + 1 });
  }

  return retried;
}

async function main() {
  const env = loadEnvFromFiles();
  const forceRegenerate = process.argv.includes("--force")
    || String(env.PREVIEWS_FORCE_REGEN || "").toLowerCase() === "true";
  ensureDir(BADGE_ASSET_DIR);
  ensureDir(REWARD_ASSET_DIR);
  ensureDir(LOG_DIR);

  const badgesPath = path.join(MANIFEST_DIR, "badges.manifest.json");
  const rewardsPath = path.join(MANIFEST_DIR, "rewards.manifest.json");
  if (!fs.existsSync(badgesPath) || !fs.existsSync(rewardsPath)) {
    throw new Error("Manifest files missing. Run `npm run previews:manifest` first.");
  }

  const badges = readJson<BadgeManifestItem[]>(badgesPath);
  const rewards = readJson<RewardManifestItem[]>(rewardsPath);
  const badgesById = new Map(badges.map((badge) => [badge.id, badge]));
  const rewardsById = new Map(rewards.map((reward) => [reward.id, reward]));

  const results: RenderResult[] = [];
  for (const badge of badges) {
    results.push(await renderBadge(badge, env, forceRegenerate));
  }
  for (const reward of rewards) {
    results.push(await renderReward(reward, env, forceRegenerate));
  }

  const failedFirstPass = results.filter((result) => result.status === "failed");
  if (failedFirstPass.length > 0) {
    const retried = await retryFailures(failedFirstPass, badgesById, rewardsById, env, forceRegenerate);
    const retriedMap = new Map(retried.map((result) => [`${result.kind}:${result.id}`, result]));
    for (let index = 0; index < results.length; index++) {
      const key = `${results[index].kind}:${results[index].id}`;
      if (retriedMap.has(key)) {
        results[index] = retriedMap.get(key)!;
      }
    }
  }

  const summary = {
    total: results.length,
    existing: results.filter((result) => result.status === "existing").length,
    generated: results.filter((result) => result.status === "generated").length,
    fallback: results.filter((result) => result.status === "fallback").length,
    failed: results.filter((result) => result.status === "failed").length,
    forceRegenerate,
  };

  const output = {
    generatedAt: new Date().toISOString(),
    summary,
    results,
  };

  const outputPath = path.join(LOG_DIR, "render-results.json");
  writeJson(outputPath, output);
  console.log(`Rendered ${summary.total} assets (${summary.existing} existing, ${summary.generated} generated, ${summary.fallback} fallback, ${summary.failed} failed).`);
  console.log(`Log written: ${outputPath}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
