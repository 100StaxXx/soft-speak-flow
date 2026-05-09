#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const MAPS_SCRIPT_MARKER = "maps.googleapis.com/maps/api/js";
const PLACES_LIBRARY_MARKER = "libraries=places";
const PLACEHOLDER = "your-google-maps-browser-key";
const DEFAULT_TARGETS = ["dist", "ios/App/App/public"];

function walkFiles(root) {
  const files = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(?:html|js|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function verifyTarget(target) {
  if (!fs.existsSync(target)) {
    return {
      target,
      ok: false,
      reason: "missing-target",
      filesScanned: 0,
      markerFiles: [],
      hasPlaceholder: false,
    };
  }

  const files = walkFiles(target);
  const markerFiles = [];
  const placesFiles = [];
  let hasPlaceholder = false;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const hasMapsScript = content.includes(MAPS_SCRIPT_MARKER);
    const hasPlacesLibrary = content.includes(PLACES_LIBRARY_MARKER);

    if (hasMapsScript) {
      markerFiles.push(file);
    }
    if (hasMapsScript && hasPlacesLibrary) {
      placesFiles.push(file);
    }
    if (content.includes(PLACEHOLDER)) {
      hasPlaceholder = true;
    }
  }

  return {
    target,
    ok: markerFiles.length > 0 && placesFiles.length > 0 && !hasPlaceholder,
    reason: markerFiles.length === 0
      ? "missing-maps-loader"
      : placesFiles.length === 0
        ? "missing-places-library"
        : hasPlaceholder
          ? "placeholder-key"
          : "ok",
    filesScanned: files.length,
    markerFiles,
    placesFiles,
    hasPlaceholder,
  };
}

const targets = process.argv.slice(2);
const resolvedTargets = targets.length > 0 ? targets : DEFAULT_TARGETS.filter((target) => fs.existsSync(target));

if (resolvedTargets.length === 0) {
  console.error("[maps:verify-autocomplete] No build targets found. Run `npm run build` first.");
  process.exit(1);
}

const results = resolvedTargets.map(verifyTarget);

for (const result of results) {
  if (result.ok) {
    console.log(
      `[maps:verify-autocomplete] ${result.target}: Maps autocomplete loader with Places library present in ${result.placesFiles.length} file(s).`,
    );
  } else if (result.reason === "missing-target") {
    console.error(`[maps:verify-autocomplete] ${result.target}: target directory is missing.`);
  } else if (result.reason === "placeholder-key") {
    console.error(`[maps:verify-autocomplete] ${result.target}: placeholder Maps key was compiled into the build.`);
  } else if (result.reason === "missing-places-library") {
    console.error(
      `[maps:verify-autocomplete] ${result.target}: Maps JavaScript loader found, but libraries=places is missing.`,
    );
  } else {
    console.error(
      `[maps:verify-autocomplete] ${result.target}: Maps autocomplete loader missing after scanning ${result.filesScanned} file(s).`,
    );
  }
}

if (results.some((result) => !result.ok)) {
  console.error(
    "[maps:verify-autocomplete] Set VITE_GOOGLE_MAPS_API_KEY in the build environment before creating a TestFlight build.",
  );
  process.exit(1);
}
