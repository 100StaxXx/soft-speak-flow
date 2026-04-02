import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  ensureDir,
  loadEnvFromFiles,
  requireEnv,
  writeJson,
} from "./badge-reward-preview-utils";
import { parseArgs } from "./companion-stage2-preview-utils";
import {
  INITIATE_ASSET_OUTPUT_DIR,
  INITIATE_LOG_DIR,
  INITIATE_STORAGE_BUCKET,
  buildInitiateSheetPlans,
  flattenInitiateSheetPlans,
} from "./companion-initiate-import-utils";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === "true" || "dry-run" in args;
  const sourceRoot = args.source ?? INITIATE_ASSET_OUTPUT_DIR;
  const summaryPath = path.join(INITIATE_LOG_DIR, "companions.initiate.sync.summary.json");
  const plans = buildInitiateSheetPlans({ outputRoot: sourceRoot });
  const assets = flattenInitiateSheetPlans(plans);
  const missingAssets = assets.filter((asset) => !fs.existsSync(asset.outputPath));

  let supabase:
    | ReturnType<typeof createClient>
    | null = null;

  if (!dryRun) {
    if (missingAssets.length > 0) {
      throw new Error(
        `Missing ${missingAssets.length} extracted Initiate assets. Run the import step before syncing.`,
      );
    }

    const env = loadEnvFromFiles();
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("Missing required environment variable: SUPABASE_URL or VITE_SUPABASE_URL");
    }
    const serviceKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

    supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { "x-client-info": "companion-initiate-sync" } },
    });
  }

  const uploadedAssets = [];

  for (const asset of assets) {
    const exists = fs.existsSync(asset.outputPath);
    let publicUrl: string | null = null;

    if (!dryRun && supabase) {
      const buffer = fs.readFileSync(asset.outputPath);
      const { error } = await supabase.storage
        .from(INITIATE_STORAGE_BUCKET)
        .upload(asset.storagePath, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (error) {
        throw new Error(`Failed uploading ${asset.storagePath}: ${error.message}`);
      }

      publicUrl = supabase.storage
        .from(INITIATE_STORAGE_BUCKET)
        .getPublicUrl(asset.storagePath)
        .data.publicUrl;
    }

    uploadedAssets.push({
      presetId: asset.presetId,
      elementId: asset.elementId,
      outputPath: asset.outputPath,
      storagePath: asset.storagePath,
      exists,
      uploaded: !dryRun && exists,
      publicUrl,
    });
  }

  ensureDir(path.dirname(summaryPath));
  writeJson(summaryPath, {
    sourceRoot,
    dryRun,
    bucketName: INITIATE_STORAGE_BUCKET,
    plannedUploads: assets.length,
    missingAssets: missingAssets.map((asset) => ({
      presetId: asset.presetId,
      elementId: asset.elementId,
      outputPath: asset.outputPath,
      storagePath: asset.storagePath,
    })),
    uploadedAssets,
    generatedAt: new Date().toISOString(),
  });

  console.log(`Prepared ${assets.length} Initiate asset uploads for ${INITIATE_STORAGE_BUCKET}.`);
  console.log(`Wrote sync summary -> ${summaryPath}`);
  if (dryRun) {
    console.log("Dry run enabled: no uploads were executed.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
