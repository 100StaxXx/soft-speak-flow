#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

// Validate exactly the configuration Vite will use, including .env.local and
// production overrides. Shell variables still take precedence.
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const releaseEnv = loadEnv("production", projectRoot, "VITE_");

const requiredVariables = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_EXPECTED_SUPABASE_PROJECT_REF",
  "VITE_GOOGLE_MAPS_API_KEY",
  "VITE_NATIVE_REDIRECT_BASE",
  "VITE_REVENUECAT_IOS_API_KEY",
];

const placeholderPattern = /(?:your[-_]|placeholder|replace[-_]?me|changeme)/i;
const missing = [];
const placeholders = [];

for (const name of requiredVariables) {
  const value = releaseEnv[name]?.trim() ?? "";
  if (!value) {
    missing.push(name);
  } else if (placeholderPattern.test(value)) {
    placeholders.push(name);
  }
}

if (missing.length > 0 || placeholders.length > 0) {
  if (missing.length > 0) {
    console.error(`[release:env] Missing: ${missing.join(", ")}`);
  }
  if (placeholders.length > 0) {
    console.error(`[release:env] Placeholder values are not allowed: ${placeholders.join(", ")}`);
  }
  process.exit(1);
}

try {
  const supabaseUrl = new URL(releaseEnv.VITE_SUPABASE_URL);
  const nativeRedirectUrl = new URL(releaseEnv.VITE_NATIVE_REDIRECT_BASE);
  if (
    supabaseUrl.hostname !== "opbfpbbqvuksuvmtmssd.supabase.co" ||
    releaseEnv.VITE_EXPECTED_SUPABASE_PROJECT_REF !== "opbfpbbqvuksuvmtmssd"
  ) {
    throw new Error("wrong Supabase project");
  }
  if (nativeRedirectUrl.origin !== "https://app.cosmiq.quest") {
    throw new Error("wrong native redirect");
  }
} catch {
  console.error("[release:env] Cosmiq release values must use the dedicated Cosmiq Supabase project and redirect origin.");
  process.exit(1);
}

if (!/^appl_[A-Za-z0-9]+$/.test(releaseEnv.VITE_REVENUECAT_IOS_API_KEY)) {
  console.error("[release:env] TestFlight and App Store builds require a RevenueCat Apple/iOS public SDK key starting with appl_; development Test Store keys are not supported.");
  process.exit(1);
}

console.log(`[release:env] ${requiredVariables.length} required release variables are present.`);
