#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const [command, codeArg, ...rawArgs] = process.argv.slice(2);

if (!command || !codeArg) {
  printUsage();
  process.exit(1);
}

const code = codeArg.trim().toUpperCase();
const options = parseArgs(rawArgs);

switch (command) {
  case "create":
    await createPromoCode(code, options);
    break;
  case "disable":
    await updatePromoCode(code, { is_active: false });
    break;
  case "expire":
    await updatePromoCode(code, { expires_at: new Date().toISOString(), is_active: false });
    break;
  case "cap":
    if (!options.maxRedemptions) {
      console.error("--max-redemptions is required for cap");
      process.exit(1);
    }
    await updatePromoCode(code, { max_redemptions: Number(options.maxRedemptions) });
    break;
  default:
    printUsage();
    process.exit(1);
}

async function createPromoCode(codeValue, optionsValue) {
  if (!optionsValue.expiresAt) {
    throw new Error("create requires --expires-at");
  }

  if (!optionsValue.maxRedemptions) {
    throw new Error("create requires --max-redemptions");
  }

  const payload = {
    code: codeValue,
    is_active: true,
    grant_days: Number(optionsValue.grantDays || 30),
    expires_at: optionsValue.expiresAt,
    max_redemptions: Number(optionsValue.maxRedemptions),
    redeemed_count: 0,
    metadata: {
      source: "script",
      created_at: new Date().toISOString(),
    },
  };

  await insertPromoCode(payload);
}

async function insertPromoCode(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
    method: "POST",
    headers: buildHeaders({
      Prefer: "return=representation,resolution=merge-duplicates",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(body?.message || JSON.stringify(body) || `Request failed with ${response.status}`);
  }

  console.log(JSON.stringify(body, null, 2));
}

async function updatePromoCode(codeValue, updates) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(codeValue)}`, {
    method: "PATCH",
    headers: buildHeaders({
      Prefer: "return=representation",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      ...updates,
      updated_at: new Date().toISOString(),
    }),
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(body?.message || JSON.stringify(body) || `Request failed with ${response.status}`);
  }

  console.log(JSON.stringify(body, null, 2));
}

function buildHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = args[index + 1];
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function printUsage() {
  console.log(`Usage:
  node scripts/manage-promo-codes.mjs create CODE --expires-at 2026-12-31T00:00:00Z --max-redemptions 100 [--grant-days 30]
  node scripts/manage-promo-codes.mjs disable CODE
  node scripts/manage-promo-codes.mjs expire CODE
  node scripts/manage-promo-codes.mjs cap CODE --max-redemptions 10`);
}
