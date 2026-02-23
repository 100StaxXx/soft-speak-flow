import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  BADGE_ASSET_DIR,
  REWARD_ASSET_DIR,
  LOG_DIR,
  ensureDir,
  loadEnvFromFiles,
  requireEnv,
  writeJson,
} from "./badge-reward-preview-utils";

const BUCKET_NAME = "badge-reward-previews";
const BADGE_URL_MAP_FILE = path.join(process.cwd(), "src/data/badgePreviewUrls.ts");

function listWebpFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.toLowerCase().endsWith(".webp"))
    .sort((a, b) => a.localeCompare(b));
}

function buildBadgeUrlMapSource(urlMap: Record<string, string>): string {
  const entries = Object.entries(urlMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)},`)
    .join("\n");

  return [
    "/**",
    " * Generated mapping of badge ID -> preview image URL.",
    " *",
    " * Source of truth is maintained in-repo and updated by:",
    " * `tsx scripts/sync-badge-reward-previews.ts`",
    " */",
    "export const BADGE_PREVIEW_URLS: Record<string, string> = {",
    entries,
    "};",
    "",
  ].join("\n");
}

async function ensureBucketExists(supabase: ReturnType<typeof createClient>) {
  const { data: listData, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  if (listData.some((bucket) => bucket.id === BUCKET_NAME)) return;

  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: "5MB",
  });

  if (createError) {
    throw new Error(`Failed to create bucket ${BUCKET_NAME}: ${createError.message}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnvFromFiles();
  const supabaseUrl = requireEnv(env, "VITE_SUPABASE_URL");
  const serviceKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { "x-client-info": "badge-reward-preview-sync" } },
  });

  const badgeFiles = listWebpFiles(BADGE_ASSET_DIR);
  const rewardFiles = listWebpFiles(REWARD_ASSET_DIR);
  if (badgeFiles.length === 0 && rewardFiles.length === 0) {
    throw new Error("No local preview assets found. Run `npm run previews:render` first.");
  }

  if (!dryRun) {
    await ensureBucketExists(supabase);
  }

  const badgeUrlMap: Record<string, string> = {};
  const rewardUpdates: Array<{ id: string; image_url: string }> = [];

  for (const fileName of badgeFiles) {
    const badgeId = fileName.replace(/\.webp$/i, "");
    const localPath = path.join(BADGE_ASSET_DIR, fileName);
    const storagePath = `badges/${fileName}`;
    const buffer = fs.readFileSync(localPath);

    if (!dryRun) {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, { contentType: "image/webp", upsert: true });
      if (error) {
        throw new Error(`Failed uploading badge ${badgeId}: ${error.message}`);
      }
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    badgeUrlMap[badgeId] = data.publicUrl;
  }

  for (const fileName of rewardFiles) {
    const rewardId = fileName.replace(/\.webp$/i, "");
    const localPath = path.join(REWARD_ASSET_DIR, fileName);
    const storagePath = `rewards/${fileName}`;
    const buffer = fs.readFileSync(localPath);

    if (!dryRun) {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, { contentType: "image/webp", upsert: true });
      if (error) {
        throw new Error(`Failed uploading reward ${rewardId}: ${error.message}`);
      }
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    rewardUpdates.push({ id: rewardId, image_url: data.publicUrl });
  }

  if (!dryRun) {
    for (const update of rewardUpdates) {
      const { error } = await supabase
        .from("epic_rewards")
        .update({ image_url: update.image_url })
        .eq("id", update.id);
      if (error) {
        throw new Error(`Failed updating epic_rewards.image_url for ${update.id}: ${error.message}`);
      }
    }
  }

  fs.writeFileSync(BADGE_URL_MAP_FILE, buildBadgeUrlMapSource(badgeUrlMap), "utf8");

  ensureDir(LOG_DIR);
  const summary = {
    bucket: BUCKET_NAME,
    dryRun,
    badgesUploaded: badgeFiles.length,
    rewardsUploaded: rewardFiles.length,
    rewardRowsUpdated: rewardUpdates.length,
    badgeUrlMapFile: BADGE_URL_MAP_FILE,
    generatedAt: new Date().toISOString(),
  };
  writeJson(path.join(LOG_DIR, "sync-results.json"), summary);

  console.log(`Synced previews (${badgeFiles.length} badges, ${rewardFiles.length} rewards).`);
  if (dryRun) {
    console.log("Dry run enabled: no uploads or DB updates were executed.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

