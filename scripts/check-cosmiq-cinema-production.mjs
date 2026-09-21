#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || true];
  }),
);

const linkedProjectFile = resolve(root, "supabase/.temp/project-ref");
const linkedProjectRef = existsSync(linkedProjectFile)
  ? readFileSync(linkedProjectFile, "utf8").trim()
  : "";
const requestedProjectRef = String(
  args.get("--project-ref") ?? process.env.SUPABASE_PROJECT_REF ??
    linkedProjectRef,
).trim();

if (!requestedProjectRef) {
  throw new Error(
    "No Supabase project is linked. Link the intended project or pass --project-ref=<ref>.",
  );
}
if (linkedProjectRef && linkedProjectRef !== requestedProjectRef) {
  throw new Error(
    `Linked project ${linkedProjectRef} does not match requested project ${requestedProjectRef}.`,
  );
}

const runSupabase = (commandArgs) => {
  const result = spawnSync("supabase", commandArgs, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `supabase ${commandArgs.join(" ")} failed: ${
        result.stderr.trim() || result.stdout.trim()
      }`,
    );
  }
  return result.stdout;
};

const migrationOutput = runSupabase(["migration", "list", "--linked"]);
const remoteMigrations = new Set();
for (const line of migrationOutput.split("\n")) {
  const match = line.match(/^\s*(\d{14})?\s*\|\s*(\d{14})?/);
  if (match?.[2]) remoteMigrations.add(match[2]);
}

const functions = JSON.parse(runSupabase([
  "functions",
  "list",
  "--project-ref",
  requestedProjectRef,
  "--output",
  "json",
]));
const activeFunctions = new Set(
  functions
    .filter((entry) => entry.status === "ACTIVE")
    .map((entry) => entry.slug ?? entry.name),
);
// Supabase returns secret digests in the `value` field. Deliberately discard
// everything except names so this check cannot leak secret material.
const secretNames = new Set(
  JSON.parse(runSupabase([
    "secrets",
    "list",
    "--project-ref",
    requestedProjectRef,
    "--output",
    "json",
  ])).map((entry) => entry.name),
);

const requiredMigrations = [
  "20260812100000",
  "20260819090000",
  "20260819113000",
];
const requiredFunctions = [
  "process-companion-cinema-event",
  "cleanup-companion-cinema-private-assets",
  "manage-companion-cinema-interaction",
  "generate-companion-evolution",
  "process-companion-evolution-job",
  "reset-companion",
];
const requiredFunctionNames = new Set(requiredFunctions);
const cinemaReleaseFloor = Date.parse("2026-08-19T00:00:00.000Z");
const staleActiveFunctions = functions
  .filter((entry) =>
    requiredFunctionNames.has(entry.slug ?? entry.name) &&
    entry.status === "ACTIVE" &&
    Number(entry.updated_at) < cinemaReleaseFloor
  )
  .map((entry) => entry.slug ?? entry.name);
const requiredSecrets = [
  "OPENAI_API_KEY",
  "FAL_KEY",
  "INTERNAL_FUNCTION_SECRET",
  "COSMIQ_CINEMA_ENABLED",
  "COSMIQ_CINEMA_ROLLOUT_PERCENT",
  "COSMIQ_CINEMA_CANARY_USER_IDS",
  "COSMIQ_CINEMA_IMAGE_MODEL",
  "COSMIQ_CINEMA_VIDEO_MODEL",
  "COSMIQ_CINEMA_PRIVATE_RETENTION_HOURS",
  "COST_ALERT_WEBHOOK_URL",
];
const requiredMigrationFiles = [
  "supabase/migrations/20260812100000_add_explicit_companion_product_mode.sql",
  "supabase/migrations/20260819090000_add_companion_cinema_engine.sql",
  "supabase/migrations/20260819113000_bind_profile_and_companion_product_to_account.sql",
];

const missing = (required, actual) =>
  required.filter((name) => !actual.has(name));
const gates = {
  reviewedMigrationFilesPresent: requiredMigrationFiles.every((path) =>
    existsSync(resolve(root, path))
  ),
  missingRemoteMigrations: missing(requiredMigrations, remoteMigrations),
  missingActiveFunctions: missing(requiredFunctions, activeFunctions),
  staleActiveFunctions,
  missingSecretNames: missing(requiredSecrets, secretNames),
};
const ready = gates.reviewedMigrationFilesPresent &&
  gates.missingRemoteMigrations.length === 0 &&
  gates.missingActiveFunctions.length === 0 &&
  gates.staleActiveFunctions.length === 0 &&
  gates.missingSecretNames.length === 0;

process.stdout.write(`${
  JSON.stringify(
    {
      projectRef: requestedProjectRef,
      readyForPaidCanary: ready,
      gates,
      valueChecksRequired: [
        "COSMIQ_CINEMA_ENABLED must remain false through deployment, then become true only for the paid canary",
        "COSMIQ_CINEMA_ROLLOUT_PERCENT must be 0 during canary",
        "COSMIQ_CINEMA_CANARY_USER_IDS must contain only reviewed Cosmiq users",
        "The image and video models must match the reviewed Standard configuration",
      ],
      note: ready
        ? "Automated infrastructure preflight passed. Paid provider and human visual QA gates remain."
        : "Production is fail-closed. Resolve the listed infrastructure gates before any paid canary.",
    },
    null,
    2,
  )
}\n`);

process.exitCode = ready ? 0 : 1;
