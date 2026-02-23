import path from "node:path";
import { BADGE_CATALOG } from "@/data/badgeCatalog";
import {
  MANIFEST_DIR,
  fetchEpicRewards,
  loadEnvFromFiles,
  toRewardManifestRows,
  writeJson,
} from "./badge-reward-preview-utils";

async function main() {
  const env = loadEnvFromFiles();
  const rewards = await fetchEpicRewards(env);

  const badgesManifest = BADGE_CATALOG.map((badge) => ({
    id: badge.id,
    title: badge.title,
    tier: badge.tier,
    category: badge.category,
    icon: badge.icon,
  })).sort((a, b) => a.id.localeCompare(b.id));

  const rewardsManifest = toRewardManifestRows(rewards).sort((a, b) => a.id.localeCompare(b.id));

  const badgesPath = path.join(MANIFEST_DIR, "badges.manifest.json");
  const rewardsPath = path.join(MANIFEST_DIR, "rewards.manifest.json");

  writeJson(badgesPath, badgesManifest);
  writeJson(rewardsPath, rewardsManifest);

  console.log(`Wrote ${badgesManifest.length} badges -> ${badgesPath}`);
  console.log(`Wrote ${rewardsManifest.length} rewards -> ${rewardsPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

