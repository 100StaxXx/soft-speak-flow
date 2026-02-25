#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ALL_THEMES = [
  "distraction",
  "chaos",
  "stagnation",
  "laziness",
  "anxiety",
  "overthinking",
  "doubt",
  "fear",
  "confusion",
  "vulnerability",
  "imbalance",
];

const ALL_TIERS = ["common", "uncommon", "rare", "epic", "legendary"];
const DEFAULT_TARGET_VARIANTS = 5;
const REQUEST_TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCliArgs(argv) {
  const args = {
    dryRun: false,
    delayMs: 250,
    retries: 2,
    maxCombos: 0,
    targetVariants: DEFAULT_TARGET_VARIANTS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--delay-ms" && next) {
      args.delayMs = Number(next);
      index += 1;
      continue;
    }
    if (token === "--retries" && next) {
      args.retries = Number(next);
      index += 1;
      continue;
    }
    if (token === "--max-combos" && next) {
      args.maxCombos = Number(next);
      index += 1;
      continue;
    }
    if (token === "--target-variants" && next) {
      args.targetVariants = Number(next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error(`Invalid --delay-ms value: ${args.delayMs}`);
  }
  if (!Number.isFinite(args.retries) || args.retries < 0) {
    throw new Error(`Invalid --retries value: ${args.retries}`);
  }
  if (!Number.isFinite(args.maxCombos) || args.maxCombos < 0) {
    throw new Error(`Invalid --max-combos value: ${args.maxCombos}`);
  }
  if (!Number.isFinite(args.targetVariants) || args.targetVariants < 1 || args.targetVariants > 5) {
    throw new Error(`Invalid --target-variants value: ${args.targetVariants}`);
  }

  args.delayMs = Math.floor(args.delayMs);
  args.retries = Math.floor(args.retries);
  args.maxCombos = Math.floor(args.maxCombos);
  args.targetVariants = Math.floor(args.targetVariants);

  return args;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const values = {};

  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Z0-9_]+)=("?)(.*)\2$/i);
    if (!match) continue;

    const [, key, , value] = match;
    values[key] = value;
  }

  return values;
}

function getEnvValue(key, dotenvValues) {
  return process.env[key] || dotenvValues[key] || null;
}

function toTitleCase(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

function isRetryableNetworkError(error) {
  if (!error) return false;
  const code = typeof error === "object" && error !== null ? error.code : null;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return true;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ETIMEDOUT") || message.includes("fetch failed") || message.includes("aborted");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetries(url, options, retries = 2, timeoutMs = REQUEST_TIMEOUT_MS) {
  let attempt = 0;
  while (true) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
      const canRetry = attempt < retries && isRetryableNetworkError(error);
      if (!canRetry) throw error;
      attempt += 1;
      await sleep(250 * (attempt + 1));
    }
  }
}

async function loadExistingVariants({ supabaseUrl, serviceRoleKey, theme, tier }) {
  const endpoint = new URL("/rest/v1/adversary_images", supabaseUrl);
  endpoint.searchParams.set("select", "variant_index");
  endpoint.searchParams.set("theme", `eq.${theme}`);
  endpoint.searchParams.set("tier", `eq.${tier}`);
  endpoint.searchParams.set("order", "variant_index.asc");

  const response = await fetchWithRetries(endpoint, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to query adversary_images (${response.status}): ${raw.slice(0, 300)}`);
  }

  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    parsed = [];
  }

  const indexes = new Set();
  for (const row of Array.isArray(parsed) ? parsed : []) {
    if (typeof row?.variant_index === "number") {
      indexes.add(Math.floor(row.variant_index));
    }
  }
  return indexes;
}

async function invokeTopUp({ supabaseUrl, serviceRoleKey, theme, tier, targetVariants }) {
  const endpoint = new URL("/functions/v1/generate-adversary-image", supabaseUrl);
  const response = await fetchWithRetries(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      theme,
      tier,
      name: `${toTitleCase(theme)} ${toTitleCase(tier)} Adversary`,
      targetVariants,
    }),
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    body: raw.slice(0, 500),
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const dotenvValues = loadDotEnv(path.resolve(process.cwd(), ".env"));

  const supabaseUrl =
    getEnvValue("SUPABASE_URL", dotenvValues) ||
    getEnvValue("VITE_SUPABASE_URL", dotenvValues);
  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY", dotenvValues);

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) in env/.env");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env/.env");
  }

  const combos = [];
  for (const theme of ALL_THEMES) {
    for (const tier of ALL_TIERS) {
      combos.push({ theme, tier });
    }
  }

  const scopedCombos = args.maxCombos > 0 ? combos.slice(0, args.maxCombos) : combos;
  const stats = {
    scanned: 0,
    alreadyFull: 0,
    toppedUp: 0,
    failed: 0,
    generatedVariants: 0,
    missingBefore: 0,
    missingAfter: 0,
  };

  console.log("Adversary image prewarm starting", {
    dryRun: args.dryRun,
    targetVariants: args.targetVariants,
    combos: scopedCombos.length,
    retries: args.retries,
    delayMs: args.delayMs,
  });

  for (const [comboIndex, combo] of scopedCombos.entries()) {
    stats.scanned += 1;
    const { theme, tier } = combo;
    try {
      const before = await loadExistingVariants({
        supabaseUrl,
        serviceRoleKey,
        theme,
        tier,
      });

      const missingBefore = [];
      for (let variant = 0; variant < args.targetVariants; variant += 1) {
        if (!before.has(variant)) missingBefore.push(variant);
      }
      stats.missingBefore += missingBefore.length;

      if (missingBefore.length === 0) {
        stats.alreadyFull += 1;
        console.log(
          `[${comboIndex + 1}/${scopedCombos.length}] ${theme}/${tier}: already full (${before.size} variants)`,
        );
        continue;
      }

      if (args.dryRun) {
        console.log(
          `[${comboIndex + 1}/${scopedCombos.length}] ${theme}/${tier}: missing variants ${missingBefore.join(", ")}`,
        );
        continue;
      }

      let attempt = 0;
      let invoked = false;
      while (attempt <= args.retries && !invoked) {
        const result = await invokeTopUp({
          supabaseUrl,
          serviceRoleKey,
          theme,
          tier,
          targetVariants: args.targetVariants,
        });

        if (result.ok) {
          invoked = true;
          stats.toppedUp += 1;
          const generatedCount =
            typeof result.payload?.generatedVariants === "number"
              ? result.payload.generatedVariants
              : 0;
          stats.generatedVariants += generatedCount;

          console.log(
            `[${comboIndex + 1}/${scopedCombos.length}] ${theme}/${tier}: top-up ok (${generatedCount} generated)`,
          );
          break;
        }

        const canRetry = attempt < args.retries && isRetryableStatus(result.status);
        console.warn(
          `[${comboIndex + 1}/${scopedCombos.length}] ${theme}/${tier}: top-up failed (status ${result.status})`,
          result.payload ?? result.body,
        );

        if (!canRetry) {
          stats.failed += 1;
          break;
        }

        attempt += 1;
        const backoffMs = args.delayMs * (attempt + 1);
        await sleep(backoffMs);
      }

      const after = await loadExistingVariants({
        supabaseUrl,
        serviceRoleKey,
        theme,
        tier,
      });
      const missingAfter = [];
      for (let variant = 0; variant < args.targetVariants; variant += 1) {
        if (!after.has(variant)) missingAfter.push(variant);
      }
      stats.missingAfter += missingAfter.length;

      if (missingAfter.length > 0) {
        console.warn(
          `[${comboIndex + 1}/${scopedCombos.length}] ${theme}/${tier}: still missing ${missingAfter.join(", ")}`,
        );
      }
    } catch (error) {
      stats.failed += 1;
      console.error(
        `[${comboIndex + 1}/${scopedCombos.length}] ${theme}/${tier}: prewarm step failed`,
        error,
      );
    }

    if (args.delayMs > 0 && comboIndex < scopedCombos.length - 1) {
      await sleep(args.delayMs);
    }
  }

  const targetPoolSize = scopedCombos.length * args.targetVariants;
  console.log("Adversary image prewarm summary", {
    targetPoolSize,
    ...stats,
  });
}

main().catch((error) => {
  console.error("Adversary prewarm failed:", error);
  process.exit(1);
});
