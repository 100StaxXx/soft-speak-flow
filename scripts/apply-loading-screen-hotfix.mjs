#!/usr/bin/env node

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const HOTFIX_REASON = "loading_screen_hotfix_2026_05_28";
const DEFAULT_GRANT_DAYS = 14;
const DEFAULT_BACKUP_DIR = path.join(".hotfix-backups", "loading-screen-hotfix-2026-05-28");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

loadDotEnv(".env.local");
loadDotEnv(".env");

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printUsage();
  process.exit(0);
}

const SUPABASE_URL = stripTrailingSlash(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
);
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || readSupabaseProjectRef();
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  readSupabaseApiKeyFromCli("service_role", SUPABASE_PROJECT_REF);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (options.rollback) {
  await rollbackFromBackup(options.rollback, options);
} else {
  const identifiers = await getTargetIdentifiers(options);
  if (identifiers.length === 0) {
    console.error("Provide at least one tester email/user UUID, or pass --file path/to/targets.txt.");
    printUsage();
    process.exit(1);
  }
  await applyHotfix(identifiers, options);
}

async function applyHotfix(identifiers, opts) {
  const grantDays = Number(opts.days ?? DEFAULT_GRANT_DAYS);
  if (!Number.isFinite(grantDays) || grantDays <= 0) {
    throw new Error("--days must be a positive number.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + grantDays * 24 * 60 * 60 * 1000).toISOString();
  const backup = {
    reason: HOTFIX_REASON,
    createdAt: now.toISOString(),
    expiresAt,
    dryRun: Boolean(opts.dryRun),
    targets: [],
  };

  console.log(`Resolving ${identifiers.length} target(s)...`);

  for (const identifier of identifiers) {
    const target = await resolveTarget(identifier, opts);
    const previousEntitlement = await fetchCurrentEntitlement(target.id);
    const nextEntitlement = buildHotfixEntitlement({
      target,
      previousEntitlement,
      now,
      expiresAt,
    });

    backup.targets.push({
      input: identifier,
      userId: target.id,
      email: target.email,
      resolvedFrom: target.resolvedFrom,
      previousEntitlement,
      nextEntitlement,
    });

    if (opts.dryRun) {
      console.log(`[dry-run] ${targetLabel(target)} would receive manual access until ${expiresAt}.`);
      continue;
    }

    const upserted = await upsertEntitlement(nextEntitlement);
    const validation = expectedAccessStateFromEntitlement(upserted);
    console.log(
      `${targetLabel(target)} hotfixed: has_access=${validation.has_access}, subscribed=${validation.subscribed}, expires=${upserted.ends_at}`,
    );
  }

  const backupPath = await writeBackup(backup, opts.backupDir ?? DEFAULT_BACKUP_DIR);
  console.log(`Backup written to ${backupPath}`);

  if (!opts.dryRun) {
    console.log("Ask affected testers to force-quit Cosmiq/TestFlight and relaunch.");
  }
}

async function rollbackFromBackup(backupPath, opts) {
  const raw = await fs.readFile(backupPath, "utf8");
  const backup = JSON.parse(raw);
  if (!Array.isArray(backup.targets)) {
    throw new Error("Backup file is missing a targets array.");
  }

  console.log(`Rolling back ${backup.targets.length} target(s) from ${backupPath}...`);

  for (const target of backup.targets) {
    if (!target.userId) {
      throw new Error(`Backup target is missing userId: ${JSON.stringify(target)}`);
    }

    if (opts.dryRun) {
      console.log(`[dry-run] ${target.email ?? target.userId} would be rolled back.`);
      continue;
    }

    const current = await fetchCurrentEntitlement(target.userId);
    if (!currentHasHotfixMarker(current)) {
      console.warn(`${target.email ?? target.userId} has no ${HOTFIX_REASON} marker; skipping rollback.`);
      continue;
    }

    if (target.previousEntitlement) {
      await upsertEntitlement(stripReadOnlyFields(target.previousEntitlement));
      console.log(`${target.email ?? target.userId} entitlement restored from backup.`);
    } else {
      await deleteEntitlement(target.userId);
      console.log(`${target.email ?? target.userId} hotfix-only entitlement deleted.`);
    }
  }
}

function buildHotfixEntitlement({ target, previousEntitlement, now, expiresAt }) {
  const previousMetadata = isRecord(previousEntitlement?.metadata)
    ? previousEntitlement.metadata
    : {};

  return {
    user_id: target.id,
    source: "manual",
    status: "active",
    plan: "promo",
    is_active: true,
    started_at: previousEntitlement?.started_at ?? now.toISOString(),
    ends_at: expiresAt,
    trial_started_at: previousEntitlement?.trial_started_at ?? null,
    trial_ends_at: previousEntitlement?.trial_ends_at ?? null,
    billing_customer_id: previousEntitlement?.billing_customer_id ?? null,
    billing_subscription_id: previousEntitlement?.billing_subscription_id ?? null,
    metadata: {
      ...previousMetadata,
      [HOTFIX_REASON]: {
        applied_at: now.toISOString(),
        expires_at: expiresAt,
        target_email: target.email ?? null,
        previous_entitlement: previousEntitlement,
      },
    },
  };
}

async function resolveTarget(identifier, opts) {
  const normalized = identifier.trim();
  if (!normalized) throw new Error("Blank target identifier.");

  if (UUID_PATTERN.test(normalized)) {
    const profile = await fetchProfileById(normalized);
    return {
      id: normalized,
      email: profile?.email ?? null,
      resolvedFrom: profile ? "profile_id" : "uuid",
    };
  }

  const profileMatches = await fetchProfilesByEmail(normalized);
  if (profileMatches.length === 1) {
    return {
      id: profileMatches[0].id,
      email: profileMatches[0].email ?? normalized,
      resolvedFrom: "profile_email",
    };
  }
  if (profileMatches.length > 1) {
    throw new Error(`Email ${normalized} matched multiple profiles; use the user UUID instead.`);
  }

  const authUser = await findAuthUserByEmail(normalized, opts);
  if (authUser) {
    return {
      id: authUser.id,
      email: authUser.email ?? normalized,
      resolvedFrom: "auth_email",
    };
  }

  throw new Error(`Could not resolve tester account: ${normalized}`);
}

async function fetchProfileById(userId) {
  const rows = await restRequest(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email`,
  );
  return rows[0] ?? null;
}

async function fetchProfilesByEmail(email) {
  return await restRequest(
    `/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email`,
  );
}

async function findAuthUserByEmail(email, opts) {
  const maxPages = Number(opts.maxAuthPages ?? 20);
  const perPage = Number(opts.authPageSize ?? 1000);

  for (let page = 1; page <= maxPages; page += 1) {
    const body = await authAdminRequest(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
    const users = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : [];
    const match = users.find((user) => user?.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < perPage) return null;
  }

  return null;
}

async function fetchCurrentEntitlement(userId) {
  const rows = await restRequest(
    `/rest/v1/account_entitlements?user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );
  return rows[0] ?? null;
}

async function upsertEntitlement(entitlement) {
  const rows = await restRequest("/rest/v1/account_entitlements?on_conflict=user_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entitlement),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function deleteEntitlement(userId) {
  await restRequest(`/rest/v1/account_entitlements?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

async function writeBackup(backup, backupDir) {
  await fs.mkdir(backupDir, { recursive: true });
  const safeTimestamp = backup.createdAt.replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${HOTFIX_REASON}-${safeTimestamp}.json`);
  await fs.writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
  return backupPath;
}

function expectedAccessStateFromEntitlement(entitlement) {
  const endsAt = entitlement?.ends_at ? new Date(entitlement.ends_at) : null;
  const active = Boolean(
    entitlement?.is_active &&
      entitlement.source === "manual" &&
      (!endsAt || endsAt > new Date()),
  );
  return {
    has_access: active,
    subscribed: active,
  };
}

function currentHasHotfixMarker(entitlement) {
  return Boolean(isRecord(entitlement?.metadata) && entitlement.metadata[HOTFIX_REASON]);
}

function stripReadOnlyFields(entitlement) {
  const {
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...rest
  } = entitlement;
  return rest;
}

async function getTargetIdentifiers(opts) {
  const identifiers = [...opts.positionals];
  if (opts.file) {
    const raw = await fs.readFile(opts.file, "utf8");
    identifiers.push(
      ...raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")),
    );
  }
  return [...new Set(identifiers)];
}

async function restRequest(pathname, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  return await readResponse(response);
}

async function authAdminRequest(pathname, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  return await readResponse(response);
}

async function readResponse(response) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    const message = body?.message || body?.msg || body?.error || text || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body;
}

function parseArgs(args) {
  const parsed = { positionals: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      parsed.positionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === "dryRun" || key === "help") {
      parsed[key] = true;
      continue;
    }

    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined) index += 1;
    parsed[key] = value;
  }

  return parsed;
}

function loadDotEnv(filename) {
  try {
    const raw = fsSync.readFileSync(filename, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional env file.
  }
}

function readSupabaseProjectRef() {
  try {
    const raw = fsSync.readFileSync(path.join("supabase", "config.toml"), "utf8");
    const match = /^project_id\s*=\s*"([^"]+)"/m.exec(raw);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function readSupabaseApiKeyFromCli(keyName, projectRef) {
  if (!projectRef) return "";

  try {
    const raw = execFileSync(
      "supabase",
      ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return "";

    const match = rows.find((row) => row?.name === keyName || row?.type === keyName);
    return match?.api_key || match?.key || match?.value || "";
  } catch {
    return "";
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function targetLabel(target) {
  return target.email ? `${target.email} (${target.id})` : target.id;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printUsage() {
  console.log(`Usage (with SUPABASE_SERVICE_ROLE_KEY already set in your environment):
  node scripts/apply-loading-screen-hotfix.mjs tester@example.com
  node scripts/apply-loading-screen-hotfix.mjs user-uuid-1 user-uuid-2
  node scripts/apply-loading-screen-hotfix.mjs --file affected-testers.txt
  node scripts/apply-loading-screen-hotfix.mjs --dry-run tester@example.com
  node scripts/apply-loading-screen-hotfix.mjs --rollback .hotfix-backups/loading-screen-hotfix-2026-05-28/<backup>.json

Options:
  --days N              Manual access duration. Default: ${DEFAULT_GRANT_DAYS}
  --file PATH           Read tester emails/user UUIDs from a newline-delimited file.
  --backup-dir PATH     Backup output directory. Default: ${DEFAULT_BACKUP_DIR}
  --dry-run             Resolve targets and write no Supabase changes.
  --rollback PATH       Restore/delete entitlement rows from a backup JSON file.
`);
}
