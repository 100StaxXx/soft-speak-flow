#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCliArgs(argv) {
  const args = {
    batchSize: 20,
    delayMs: 300,
    maxRows: 0,
    retries: 2,
    retryDelayMs: 1200,
    fromDate: null,
    toDate: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--batch-size" && next) {
      args.batchSize = Number(next);
      i += 1;
      continue;
    }
    if (token === "--delay-ms" && next) {
      args.delayMs = Number(next);
      i += 1;
      continue;
    }
    if (token === "--max-rows" && next) {
      args.maxRows = Number(next);
      i += 1;
      continue;
    }
    if (token === "--retries" && next) {
      args.retries = Number(next);
      i += 1;
      continue;
    }
    if (token === "--retry-delay-ms" && next) {
      args.retryDelayMs = Number(next);
      i += 1;
      continue;
    }
    if (token === "--from-date" && next) {
      args.fromDate = next;
      i += 1;
      continue;
    }
    if (token === "--to-date" && next) {
      args.toDate = next;
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  const numericFields = [
    ["batchSize", args.batchSize],
    ["delayMs", args.delayMs],
    ["maxRows", args.maxRows],
    ["retries", args.retries],
    ["retryDelayMs", args.retryDelayMs],
  ];

  for (const [name, value] of numericFields) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid value for ${name}: ${value}`);
    }
  }

  if (args.batchSize <= 0) {
    throw new Error("--batch-size must be > 0");
  }

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

function getEnvValue(key, dotenv) {
  return process.env[key] || dotenv[key] || null;
}

function isMissingTranscript(transcript) {
  if (transcript == null) return true;
  return Array.isArray(transcript) && transcript.length === 0;
}

function isRetryableFailure(result) {
  if (result.errorType === "network") return true;
  if (typeof result.status !== "number") return false;
  return result.status === 429 || (result.status >= 500 && result.status < 600);
}

async function fetchMissingRows({ supabaseUrl, serviceKey, apiKey, batchSize, offset, fromDate, toDate }) {
  const endpoint = new URL("/rest/v1/daily_pep_talks", supabaseUrl);
  endpoint.searchParams.set("select", "id,mentor_slug,for_date,audio_url,transcript");
  endpoint.searchParams.set("audio_url", "not.is.null");
  endpoint.searchParams.set("or", "(transcript.is.null,transcript.eq.[])");
  endpoint.searchParams.set("order", "for_date.asc,created_at.asc");
  endpoint.searchParams.set("limit", String(batchSize));
  endpoint.searchParams.set("offset", String(offset));

  if (fromDate) {
    endpoint.searchParams.set("for_date", `gte.${fromDate}`);
  }
  if (toDate) {
    endpoint.searchParams.set("for_date", `lte.${toDate}`);
  }

  const response = await fetch(endpoint, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Failed loading candidates (${response.status}): ${raw.slice(0, 500)}`);
  }

  const rows = JSON.parse(raw);
  return Array.isArray(rows) ? rows.filter((row) => isMissingTranscript(row.transcript)) : [];
}

async function invokeTranscriptSync({ supabaseUrl, serviceKey, apiKey, pepTalkId }) {
  const response = await fetch(new URL("/functions/v1/sync-daily-pep-talk-transcript", supabaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ id: pepTalkId }),
  });

  const raw = await response.text();
  const body = raw ? raw.slice(0, 600) : "";

  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    body,
  };
}

function classifySyncResult(result) {
  if (!result.ok) {
    return {
      outcome: "failed",
      reason: `HTTP ${result.status}`,
    };
  }

  const transcript = Array.isArray(result.payload?.transcript) ? result.payload.transcript : [];
  if (transcript.length > 0) {
    return { outcome: "synced", reason: null };
  }

  const warning = typeof result.payload?.warning === "string" ? result.payload.warning : null;
  const reason = warning || "Sync succeeded but transcript is still empty";
  return { outcome: "skipped", reason };
}

function formatUsage() {
  return [
    "Usage: node scripts/backfill-missing-pep-talk-transcripts.mjs [options]",
    "",
    "Options:",
    "  --batch-size <n>       Rows loaded per DB page (default: 20)",
    "  --delay-ms <n>         Delay between sync calls (default: 300)",
    "  --max-rows <n>         Stop after processing N rows (0 = all, default: 0)",
    "  --retries <n>          Retries for retryable failures (default: 2)",
    "  --retry-delay-ms <n>   Initial retry delay in ms (default: 1200)",
    "  --from-date <YYYY-MM-DD>  Optional lower date bound",
    "  --to-date <YYYY-MM-DD>    Optional upper date bound",
    "  --dry-run              Print candidates without invoking sync",
  ].join("\n");
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const dotenv = loadDotEnv(path.resolve(process.cwd(), ".env"));

  const supabaseUrl =
    getEnvValue("SUPABASE_URL", dotenv) ||
    getEnvValue("VITE_SUPABASE_URL", dotenv);
  const serviceKey =
    getEnvValue("SUPABASE_SERVICE_ROLE_KEY", dotenv) ||
    getEnvValue("VITE_SUPABASE_SERVICE_ROLE_KEY", dotenv);
  const apiKey =
    getEnvValue("SUPABASE_ANON_KEY", dotenv) ||
    getEnvValue("VITE_SUPABASE_ANON_KEY", dotenv) ||
    getEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY", dotenv);

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) in env/.env");
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env/.env");
  }
  if (!apiKey) {
    throw new Error("Missing SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in env/.env");
  }

  const counters = {
    scanned: 0,
    attempted: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
  };
  const failures = [];
  let offset = 0;

  console.log("Starting transcript backfill", {
    supabaseUrl,
    batchSize: args.batchSize,
    delayMs: args.delayMs,
    maxRows: args.maxRows,
    retries: args.retries,
    retryDelayMs: args.retryDelayMs,
    fromDate: args.fromDate,
    toDate: args.toDate,
    dryRun: args.dryRun,
  });

  while (true) {
    const rows = await fetchMissingRows({
      supabaseUrl,
      serviceKey,
      apiKey,
      batchSize: args.batchSize,
      offset,
      fromDate: args.fromDate,
      toDate: args.toDate,
    });

    if (rows.length === 0) {
      break;
    }

    offset += rows.length;

    for (const row of rows) {
      if (args.maxRows > 0 && counters.scanned >= args.maxRows) {
        console.log("Reached max row cap, stopping.");
        console.log("Backfill summary", counters);
        if (failures.length > 0) {
          console.log("Failure samples", failures.slice(0, 20));
        }
        return;
      }

      counters.scanned += 1;

      if (args.dryRun) {
        counters.skipped += 1;
        console.log(`[dry-run] candidate ${row.id} (${row.mentor_slug} ${row.for_date})`);
        continue;
      }

      counters.attempted += 1;
      let attempt = 0;
      let lastResult = null;

      while (attempt <= args.retries) {
        attempt += 1;
        try {
          lastResult = await invokeTranscriptSync({
            supabaseUrl,
            serviceKey,
            apiKey,
            pepTalkId: row.id,
          });
        } catch (error) {
          lastResult = {
            ok: false,
            status: null,
            payload: null,
            body: error instanceof Error ? error.message : String(error),
            errorType: "network",
          };
        }

        if (!lastResult.ok && isRetryableFailure(lastResult) && attempt <= args.retries) {
          const backoff = args.retryDelayMs * (2 ** (attempt - 1));
          await sleep(backoff);
          continue;
        }

        break;
      }

      if (!lastResult) {
        counters.failed += 1;
        failures.push({
          id: row.id,
          mentor_slug: row.mentor_slug,
          for_date: row.for_date,
          reason: "No result",
        });
      } else {
        const classification = classifySyncResult(lastResult);
        if (classification.outcome === "synced") {
          counters.synced += 1;
        } else if (classification.outcome === "skipped") {
          counters.skipped += 1;
        } else {
          counters.failed += 1;
        }

        if (classification.outcome === "failed") {
          failures.push({
            id: row.id,
            mentor_slug: row.mentor_slug,
            for_date: row.for_date,
            status: lastResult.status,
            body: lastResult.body,
            reason: classification.reason,
          });
        }

        console.log("sync result", {
          id: row.id,
          mentor_slug: row.mentor_slug,
          for_date: row.for_date,
          attemptCount: attempt,
          outcome: classification.outcome,
          status: lastResult.status,
          reason: classification.reason,
        });
      }

      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }
  }

  console.log("Backfill summary", counters);
  if (failures.length > 0) {
    console.log("Failure samples", failures.slice(0, 20));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  console.error(formatUsage());
  process.exitCode = 1;
});
