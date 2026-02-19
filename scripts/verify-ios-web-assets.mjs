#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const distAssetsDir = path.join(projectRoot, "dist", "assets");
const iosAssetsDir = path.join(projectRoot, "ios", "App", "App", "public", "assets");
const INDEX_BUNDLE_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;

const prefix = "[ios:verify-assets]";

const info = (message) => {
  console.log(`${prefix} ${message}`);
};

const fail = (message) => {
  console.error(`${prefix} ${message}`);
  console.error(`${prefix} Run \`npm run build && npm run ios:sync\` and retry.`);
  process.exit(1);
};

const listIndexBundles = async (directory) => {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Missing assets directory: ${directory}`);
  }

  return entries
    .filter((entry) => entry.isFile() && INDEX_BUNDLE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
};

const hashFile = async (filePath) => {
  const fileBuffer = await fs.readFile(filePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
};

const verifyAssets = async () => {
  const distBundles = await listIndexBundles(distAssetsDir);
  const iosBundles = await listIndexBundles(iosAssetsDir);

  if (distBundles.length === 0) {
    fail(`No Vite index bundle found in ${distAssetsDir}`);
  }

  if (iosBundles.length === 0) {
    fail(`No Capacitor index bundle found in ${iosAssetsDir}`);
  }

  const missingInIos = distBundles.filter((bundle) => !iosBundles.includes(bundle));
  if (missingInIos.length > 0) {
    fail(
      `iOS assets are stale. Missing bundle(s): ${missingInIos.join(", ")}. Found in iOS: ${iosBundles.join(", ")}`,
    );
  }

  const hashMismatches = [];
  for (const bundle of distBundles) {
    const distHash = await hashFile(path.join(distAssetsDir, bundle));
    const iosHash = await hashFile(path.join(iosAssetsDir, bundle));
    if (distHash !== iosHash) {
      hashMismatches.push(bundle);
    }
  }

  if (hashMismatches.length > 0) {
    fail(`Bundle content mismatch for: ${hashMismatches.join(", ")}`);
  }

  info(`Verified ${distBundles.length} index bundle(s) are synced between dist and iOS public assets.`);
};

verifyAssets().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
