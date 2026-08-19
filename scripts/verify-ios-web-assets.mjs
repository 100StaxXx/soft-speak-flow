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
const distRoot = path.join(projectRoot, "dist");
const iosPublicRoot = path.join(projectRoot, "ios", "App", "App", "public");
const iosAssetsDir = path.join(projectRoot, "ios", "App", "App", "public", "assets");
const iosCapacitorConfigPath = path.join(projectRoot, "ios", "App", "App", "capacitor.config.json");
const generatedBuildRoots = [
  path.join(projectRoot, "ios", "App", "build-cli"),
  path.join(projectRoot, "ios", "App", "build-cli-device-smoke"),
  path.join(projectRoot, "ios", "App", "build-xc"),
];
const INDEX_BUNDLE_PATTERN = /^index-[A-Za-z0-9_-]+\.js$/;
const JAVASCRIPT_BUNDLE_PATTERN = /\.js$/;
const LEGACY_JOURNEY_PATH_CONTRACT_PATTERN =
  /generate-journey-path["']?\s*,\s*\{[\s\S]{0,250}?body:\{[\s\S]{0,250}?userId:/;
const LEGACY_JOURNEY_PATH_ERROR =
  "Missing required parameters: epicId, milestoneIndex, userId";
const EXPECTED_NATIVE_PRODUCT = "Graceward";
const EXPECTED_NATIVE_BUNDLE_ID = "com.darrylgraham.graceward";
const FORBIDDEN_NATIVE_PRODUCT_PATTERNS = [
  /Cosmiq/i,
  /cosmiq:\/\//i,
  /com\.darrylgraham\.revolution/i,
];
const PRODUCT_IDENTITY_FILES = [
  "index.html",
  "manifest.webmanifest",
  "calendar/oauth/callback.html",
  "apple-app-site-association",
  ".well-known/apple-app-site-association",
];

const prefix = "[ios:verify-assets]";

const info = (message) => {
  console.log(`${prefix} ${message}`);
};

const fail = (message) => {
  console.error(`${prefix} ${message}`);
  console.error(`${prefix} Run \`npm run ios:sync\` and retry.`);
  process.exit(1);
};

const parseArgs = (argv) => {
  let targetBuiltAssetsDir = null;
  let skipGeneratedBuildScan = false;
  let scanGeneratedBuilds = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--scan-generated-builds") {
      scanGeneratedBuilds = true;
      continue;
    }

    if (arg === "--skip-generated-build-scan") {
      skipGeneratedBuildScan = true;
      continue;
    }

    if (arg === "--target-built-assets") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        fail("Missing value for --target-built-assets");
      }
      targetBuiltAssetsDir = path.resolve(nextArg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--target-built-assets=")) {
      targetBuiltAssetsDir = path.resolve(arg.slice("--target-built-assets=".length));
      continue;
    }

    fail(`Unsupported argument: ${arg}`);
  }

  return { targetBuiltAssetsDir, skipGeneratedBuildScan, scanGeneratedBuilds };
};

const directoryExists = async (directory) => {
  try {
    const stats = await fs.stat(directory);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
};

const walkDirectories = async (directory, visit) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    await visit(entryPath, entry.name);
    await walkDirectories(entryPath, visit);
  }
};

const findGeneratedBuildAssetDirs = async () => {
  const matches = new Set();

  for (const buildRoot of generatedBuildRoots) {
    if (!await directoryExists(buildRoot)) {
      continue;
    }

    await walkDirectories(buildRoot, async (directory, name) => {
      if (name !== "assets") {
        return;
      }

      const normalizedDirectory = path.normalize(directory);
      const expectedSuffix = path.normalize(path.join("App.app", "public", "assets"));
      if (!normalizedDirectory.endsWith(expectedSuffix)) {
        return;
      }

      matches.add(directory);
    });
  }

  return [...matches].sort();
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

const listJavaScriptBundles = async (directory) => {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Missing assets directory: ${directory}`);
  }

  return entries
    .filter((entry) => entry.isFile() && JAVASCRIPT_BUNDLE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
};

const hashFile = async (filePath) => {
  const fileBuffer = await fs.readFile(filePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
};

const verifyGracewardNativeProductIdentity = async (compareDist = true) => {
  for (const relativePath of PRODUCT_IDENTITY_FILES) {
    const distPath = path.join(distRoot, relativePath);
    const iosPath = path.join(iosPublicRoot, relativePath);

    let distContents;
    let iosContents;
    try {
      iosContents = await fs.readFile(iosPath, "utf8");
      distContents = compareDist
        ? await fs.readFile(distPath, "utf8")
        : iosContents;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`Missing required ${EXPECTED_NATIVE_PRODUCT} identity artifact ${relativePath}: ${message}`);
    }

    if (distContents !== iosContents) {
      fail(`Capacitor iOS identity artifact is stale: ${relativePath}`);
    }

    const forbiddenPattern = FORBIDDEN_NATIVE_PRODUCT_PATTERNS.find((pattern) =>
      pattern.test(distContents)
    );
    if (forbiddenPattern) {
      fail(
        `${relativePath} contains a Cosmiq identifier and cannot be packaged in the ${EXPECTED_NATIVE_PRODUCT} iOS target.`,
      );
    }
  }

  const identityRoot = compareDist ? distRoot : iosPublicRoot;
  const manifest = JSON.parse(
    await fs.readFile(path.join(identityRoot, "manifest.webmanifest"), "utf8"),
  );
  if (manifest.short_name !== EXPECTED_NATIVE_PRODUCT) {
    fail(
      `Expected ${EXPECTED_NATIVE_PRODUCT} manifest, got ${String(manifest.short_name ?? "missing short_name")}.`,
    );
  }

  const association = JSON.parse(
    await fs.readFile(path.join(identityRoot, "apple-app-site-association"), "utf8"),
  );
  const associatedAppIds = association?.applinks?.details?.map((detail) => detail.appID) ?? [];
  const expectedAssociatedAppId = `B6VW78ABTR.${EXPECTED_NATIVE_BUNDLE_ID}`;
  if (
    associatedAppIds.length !== 1
    || associatedAppIds[0] !== expectedAssociatedAppId
  ) {
    fail(
      `Expected only ${expectedAssociatedAppId} in the native association artifact; got ${associatedAppIds.join(", ") || "none"}.`,
    );
  }

  const capacitorConfig = JSON.parse(await fs.readFile(iosCapacitorConfigPath, "utf8"));
  if (
    capacitorConfig.appId !== EXPECTED_NATIVE_BUNDLE_ID
    || capacitorConfig.appName !== EXPECTED_NATIVE_PRODUCT
  ) {
    fail(
      `Capacitor native identity mismatch: expected ${EXPECTED_NATIVE_PRODUCT} (${EXPECTED_NATIVE_BUNDLE_ID}), `
      + `got ${String(capacitorConfig.appName)} (${String(capacitorConfig.appId)}).`,
    );
  }
};

const verifyNoLegacyJourneyPathContract = async (directory, bundles) => {
  const offenders = [];

  for (const bundle of bundles) {
    const bundleContents = await fs.readFile(path.join(directory, bundle), "utf8");
    if (
      LEGACY_JOURNEY_PATH_CONTRACT_PATTERN.test(bundleContents)
      || bundleContents.includes(LEGACY_JOURNEY_PATH_ERROR)
    ) {
      offenders.push(bundle);
    }
  }

  if (offenders.length > 0) {
    fail(
      `Found legacy journey-path request contract in ${directory}: ${offenders.join(", ")}. ` +
      "Rebuild from current source before shipping iOS assets.",
    );
  }
};

const verifyDirectoryMatchesDist = async (
  directory,
  distBundles,
  distJavaScriptBundles,
  label,
  referenceAssetsDir = distAssetsDir,
) => {
  const directoryBundles = await listIndexBundles(directory);
  const directoryJavaScriptBundles = await listJavaScriptBundles(directory);

  if (directoryBundles.length === 0) {
    fail(`No index bundle found in ${label} (${directory})`);
  }

  const missingBundles = distBundles.filter((bundle) => !directoryBundles.includes(bundle));
  if (missingBundles.length > 0) {
    fail(
      `${label} is stale at ${directory}. Missing bundle(s): ${missingBundles.join(", ")}. ` +
      `Found: ${directoryBundles.join(", ")}`,
    );
  }

  const hashMismatches = [];
  for (const bundle of distBundles) {
    const distHash = await hashFile(path.join(referenceAssetsDir, bundle));
    const directoryHash = await hashFile(path.join(directory, bundle));
    if (distHash !== directoryHash) {
      hashMismatches.push(bundle);
    }
  }

  if (hashMismatches.length > 0) {
    fail(`${label} at ${directory} has bundle content mismatch for: ${hashMismatches.join(", ")}`);
  }

  await verifyNoLegacyJourneyPathContract(referenceAssetsDir, distJavaScriptBundles);
  await verifyNoLegacyJourneyPathContract(directory, directoryJavaScriptBundles);
};

const verifyAssets = async () => {
  const {
    targetBuiltAssetsDir,
    skipGeneratedBuildScan,
    scanGeneratedBuilds,
  } = parseArgs(process.argv.slice(2));

  // During an Xcode build the copied Capacitor bundle is the immutable source
  // of truth. The root dist directory may legitimately be replaced by a
  // separate Cosmiq web build while the archive is compiling.
  if (targetBuiltAssetsDir) {
    const iosBundles = await listIndexBundles(iosAssetsDir);
    const iosJavaScriptBundles = await listJavaScriptBundles(iosAssetsDir);
    await verifyNoLegacyJourneyPathContract(iosAssetsDir, iosJavaScriptBundles);
    await verifyGracewardNativeProductIdentity(false);
    await verifyDirectoryMatchesDist(
      targetBuiltAssetsDir,
      iosBundles,
      iosJavaScriptBundles,
      "Xcode target bundled assets",
      iosAssetsDir,
    );
    info(`Verified ${iosBundles.length} staged index bundle(s) in the Xcode target.`);
    return;
  }

  const distBundles = await listIndexBundles(distAssetsDir);
  const distJavaScriptBundles = await listJavaScriptBundles(distAssetsDir);

  if (distBundles.length === 0) {
    fail(`No Vite index bundle found in ${distAssetsDir}`);
  }

  await verifyNoLegacyJourneyPathContract(distAssetsDir, distJavaScriptBundles);
  await verifyDirectoryMatchesDist(iosAssetsDir, distBundles, distJavaScriptBundles, "Capacitor iOS public assets");
  await verifyGracewardNativeProductIdentity();

  const buildAssetDirs = new Set();
  if (scanGeneratedBuilds && !skipGeneratedBuildScan) {
    for (const directory of await findGeneratedBuildAssetDirs()) {
      buildAssetDirs.add(directory);
    }
  }

  if (targetBuiltAssetsDir) {
    buildAssetDirs.add(targetBuiltAssetsDir);
  }

  for (const directory of [...buildAssetDirs].sort()) {
    await verifyDirectoryMatchesDist(
      directory,
      distBundles,
      distJavaScriptBundles,
      `generated iOS app bundle assets`,
    );
  }

  info(`Verified ${distBundles.length} index bundle(s) are synced between dist and iOS public assets.`);
};

verifyAssets().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
