#!/usr/bin/env node

const requiredVariables = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_GOOGLE_WEB_CLIENT_ID",
  "VITE_GOOGLE_IOS_CLIENT_ID",
  "VITE_GOOGLE_MAPS_API_KEY",
  "VITE_NATIVE_REDIRECT_BASE",
  "VITE_REVENUECAT_IOS_API_KEY",
];

const placeholderPattern = /(?:your[-_]|placeholder|replace[-_]?me|changeme)/i;
const missing = [];
const placeholders = [];

for (const name of requiredVariables) {
  const value = process.env[name]?.trim() ?? "";
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
  new URL(process.env.VITE_SUPABASE_URL);
  new URL(process.env.VITE_NATIVE_REDIRECT_BASE);
} catch {
  console.error("[release:env] Supabase and native redirect values must be valid URLs.");
  process.exit(1);
}

console.log(`[release:env] ${requiredVariables.length} required release variables are present.`);
