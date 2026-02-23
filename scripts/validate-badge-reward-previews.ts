import fs from "node:fs";
import path from "node:path";
import { BADGE_CATALOG } from "@/data/badgeCatalog";
import {
  BADGE_ASSET_DIR,
  REWARD_ASSET_DIR,
  LOG_DIR,
  ensureDir,
  fetchEpicRewards,
  loadEnvFromFiles,
  writeJson,
} from "./badge-reward-preview-utils";

function listWebpIds(dirPath: string): Set<string> {
  if (!fs.existsSync(dirPath)) return new Set<string>();
  const ids = fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.toLowerCase().endsWith(".webp"))
    .map((fileName) => fileName.replace(/\.webp$/i, ""));
  return new Set(ids);
}

async function main() {
  const env = loadEnvFromFiles();
  const errors: string[] = [];
  const warnings: string[] = [];

  const badgeLocalIds = listWebpIds(BADGE_ASSET_DIR);
  const rewardLocalIds = listWebpIds(REWARD_ASSET_DIR);

  for (const badge of BADGE_CATALOG) {
    if (!badge.icon || badge.icon.trim().length === 0) {
      errors.push(`Badge ${badge.id} is missing icon fallback.`);
    }

    if (!badgeLocalIds.has(badge.id)) {
      errors.push(`Missing local badge preview asset: ${badge.id}.webp`);
    }

    if (badge.image_url && !/^https?:\/\//.test(badge.image_url)) {
      warnings.push(`Badge ${badge.id} has non-http image_url (${badge.image_url}).`);
    }
  }

  const rewards = await fetchEpicRewards(env);
  for (const reward of rewards) {
    const hasRemote = typeof reward.image_url === "string" && reward.image_url.length > 0;
    const hasLocal = rewardLocalIds.has(reward.id);
    if (!hasRemote && !hasLocal) {
      errors.push(`Reward ${reward.id} has no image_url and no local fallback asset.`);
    }
  }

  const rewardIds = new Set(rewards.map((reward) => reward.id));
  for (const localId of rewardLocalIds) {
    if (!rewardIds.has(localId)) {
      warnings.push(`Local reward preview ${localId}.webp has no matching epic_rewards row.`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    badgeCount: BADGE_CATALOG.length,
    rewardCount: rewards.length,
    localBadgeAssets: badgeLocalIds.size,
    localRewardAssets: rewardLocalIds.size,
    errors,
    warnings,
  };

  ensureDir(LOG_DIR);
  writeJson(path.join(LOG_DIR, "validation-results.json"), summary);

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[warn] ${warning}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[error] ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validation passed (${summary.badgeCount} badges, ${summary.rewardCount} rewards).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

