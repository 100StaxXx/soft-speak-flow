import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  getExpectedPremadeCompanionEvolutionAssets,
  getExpectedPremadeGracewardFormationAssets,
  type PremadeCompanionProductMode,
} from "../src/config/premadeCompanionAssets.ts";
import {
  loadEnvFromFiles,
  requireEnv,
} from "./badge-reward-preview-utils.ts";

const parseValueArg = (name: string): string | null => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
};

const dryRun = process.argv.includes("--dry-run");
const allowPartial = process.argv.includes("--allow-partial");
const productArg = parseValueArg("--product");
if (productArg && productArg !== "graceward" && productArg !== "cosmiq") {
  throw new Error(`Unsupported --product value: ${productArg}`);
}
const productFilter = productArg as PremadeCompanionProductMode | null;
const sourceRoot = path.resolve(
  parseValueArg("--source") ?? path.join(process.cwd(), "output", "companion-premade"),
);
const expectedTransitions = getExpectedPremadeCompanionEvolutionAssets()
  .filter((asset) => !productFilter || asset.productMode === productFilter);
const expectedProgressionFiles = expectedTransitions.flatMap((asset) => [
  {
    kind: "portrait" as const,
    bucket: asset.portraitBucket,
    storagePath: asset.portraitStoragePath,
    sourcePath: path.join(sourceRoot, asset.portraitStoragePath),
    contentType: "image/webp",
  },
  {
    kind: "video" as const,
    bucket: asset.videoBucket,
    storagePath: asset.videoStoragePath,
    sourcePath: path.join(sourceRoot, asset.videoStoragePath),
    contentType: "video/mp4",
  },
]);
const expectedFormationFiles = productFilter === "cosmiq"
  ? []
  : getExpectedPremadeGracewardFormationAssets().flatMap((asset) => [
    {
      kind: "formation-still" as const,
      bucket: asset.stillBucket,
      storagePath: asset.stillStoragePath,
      sourcePath: path.join(sourceRoot, asset.stillStoragePath),
      contentType: "image/jpeg",
    },
    {
      kind: "formation-video" as const,
      bucket: asset.videoBucket,
      storagePath: asset.videoStoragePath,
      sourcePath: path.join(sourceRoot, asset.videoStoragePath),
      contentType: "video/mp4",
    },
  ]);
const expectedFiles = [...expectedProgressionFiles, ...expectedFormationFiles];
const missingFiles = expectedFiles.filter((asset) =>
  !fs.existsSync(asset.sourcePath) || fs.statSync(asset.sourcePath).size === 0
);

if (missingFiles.length > 0 && !allowPartial) {
  throw new Error(
    `Premade companion pack is incomplete: ${missingFiles.length} of ${expectedFiles.length} files are missing. Re-run with --allow-partial only while filling the Higgsfield backlog.`,
  );
}

const uploadableFiles = expectedFiles.filter((asset) =>
  fs.existsSync(asset.sourcePath) && fs.statSync(asset.sourcePath).size > 0
);

let supabase: ReturnType<typeof createClient> | null = null;
if (!dryRun) {
  const env = loadEnvFromFiles();
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "Missing required environment variable: SUPABASE_URL or VITE_SUPABASE_URL",
    );
  }
  const serviceKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { "x-client-info": "premade-companion-asset-sync" } },
  });
}

for (const [index, asset] of uploadableFiles.entries()) {
  if (supabase) {
    const { error } = await supabase.storage
      .from(asset.bucket)
      .upload(asset.storagePath, fs.readFileSync(asset.sourcePath), {
        contentType: asset.contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (error) {
      throw new Error(
        `Failed uploading ${asset.bucket}/${asset.storagePath}: ${error.message}`,
      );
    }
  }

  if ((index + 1) % 25 === 0 || index + 1 === uploadableFiles.length) {
    console.log(
      `${dryRun ? "Validated" : "Uploaded"} ${index + 1}/${uploadableFiles.length} files.`,
    );
  }
}

console.log(
  `${dryRun ? "Dry run complete" : "Premade companion sync complete"}: ${uploadableFiles.length} ready, ${missingFiles.length} missing, ${expectedFiles.length} expected.`,
);
