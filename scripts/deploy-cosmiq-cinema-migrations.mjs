#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || true];
  }),
);
const releaseMigrations = [
  "20260812100000_add_explicit_companion_product_mode.sql",
  "20260819090000_add_companion_cinema_engine.sql",
  "20260819113000_bind_profile_and_companion_product_to_account.sql",
];
const releaseVersions = releaseMigrations.map((name) => name.slice(0, 14));
const linkedProjectFile = resolve(root, "supabase/.temp/project-ref");
if (!existsSync(linkedProjectFile)) {
  throw new Error("Supabase is not linked to a production project.");
}
const projectRef = readFileSync(linkedProjectFile, "utf8").trim();
const execute = args.has("--execute");

const run = (commandArgs, cwd = root) => {
  const result = spawnSync("supabase", commandArgs, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) {
    throw new Error(
      `supabase ${commandArgs.join(" ")} failed:\n${output.trim()}`,
    );
  }
  return output;
};

const migrationList = run(["migration", "list", "--linked"]);
const remoteVersions = new Set();
for (const line of migrationList.split("\n")) {
  const match = line.match(/^\s*(\d{14})?\s*\|\s*(\d{14})?/);
  if (match?.[2]) remoteVersions.add(match[2]);
}
const pendingMigrations = releaseMigrations.filter((name) =>
  !remoteVersions.has(name.slice(0, 14))
);
const pendingVersions = pendingMigrations.map((name) => name.slice(0, 14));
const productModeVersion = releaseVersions[0];
const cinemaVersion = releaseVersions[1];
const accountBindingVersion = releaseVersions[2];
if (
  remoteVersions.has(cinemaVersion) &&
  (!remoteVersions.has(productModeVersion) ||
    !remoteVersions.has(accountBindingVersion))
) {
  throw new Error(
    "Production migration ledger is inconsistent: the cinema engine is recorded without both reviewed product-boundary prerequisites.",
  );
}
if (execute) {
  const expectedVersions = pendingVersions.join(",");
  if (args.get("--confirm-project") !== projectRef) {
    throw new Error(`Execution blocked: pass --confirm-project=${projectRef}`);
  }
  if (args.get("--confirm-migrations") !== expectedVersions) {
    throw new Error(
      `Execution blocked: pass --confirm-migrations=${expectedVersions || "none"}`,
    );
  }
  if (pendingVersions.length === 0) {
    throw new Error("Execution blocked: all reviewed migrations are already applied.");
  }
}

const releaseRoot = mkdtempSync(resolve(tmpdir(), "cosmiq-cinema-release-"));
const releaseSupabase = resolve(releaseRoot, "supabase");
const releaseMigrationDir = resolve(releaseSupabase, "migrations");
const releaseTempDir = resolve(releaseSupabase, ".temp");
mkdirSync(releaseMigrationDir, { recursive: true });
mkdirSync(releaseTempDir, { recursive: true });
copyFileSync(
  resolve(root, "supabase/config.toml"),
  resolve(releaseSupabase, "config.toml"),
);
writeFileSync(resolve(releaseTempDir, "project-ref"), `${projectRef}\n`);

for (const version of remoteVersions) {
  writeFileSync(
    resolve(releaseMigrationDir, `${version}_remote_placeholder.sql`),
    `-- ${version} is already recorded on the linked production database.\n`,
  );
}
for (const name of pendingMigrations) {
  copyFileSync(
    resolve(root, "supabase/migrations", name),
    resolve(releaseMigrationDir, name),
  );
}

try {
  const pushArgs = [
    "db",
    "push",
    "--workdir",
    releaseRoot,
    "--linked",
    "--include-all",
    "--dry-run",
    "--yes",
  ];
  const dryRunOutput = run(pushArgs, releaseRoot);
  const plannedVersions = [...dryRunOutput.matchAll(/•\s+(\d{14})_/g)]
    .map((match) => match[1]);
  if (JSON.stringify(plannedVersions) !== JSON.stringify(pendingVersions)) {
    throw new Error(
      `Dry-run scope mismatch. Expected ${pendingVersions.join(", ") || "none"}; got ${
        plannedVersions.join(", ") || "none"
      }.`,
    );
  }

  process.stdout.write(`${
    JSON.stringify(
      {
        projectRef,
        mode: execute ? "execute" : "dry-run",
        reviewedMigrations: pendingMigrations.map((name) => basename(name)),
        alreadyAppliedReviewedMigrations: releaseMigrations
          .filter((name) => remoteVersions.has(name.slice(0, 14)))
          .map((name) => basename(name)),
        dryRunScopeVerified: true,
      },
      null,
      2,
    )
  }\n`);

  if (execute) {
    run(pushArgs.filter((argument) => argument !== "--dry-run"), releaseRoot);
    process.stdout.write(`${
      JSON.stringify(
        {
          projectRef,
          appliedMigrations: pendingVersions,
          next:
            "Run npm run cosmiq:cinema:production-check before deploying functions or enabling the canary.",
        },
        null,
        2,
      )
    }\n`);
  } else {
    process.stdout.write(`${
      JSON.stringify(
        {
          paidProviderCallsMade: false,
          databaseChanged: false,
          executeRequirements: [
            "--execute",
            `--confirm-project=${projectRef}`,
            `--confirm-migrations=${pendingVersions.join(",") || "none"}`,
          ],
        },
        null,
        2,
      )
    }\n`);
  }
} finally {
  if (!args.has("--keep-workspace")) {
    rmSync(releaseRoot, { recursive: true, force: true });
  } else {
    process.stdout.write(
      `Filtered release workspace retained at ${releaseRoot}\n`,
    );
  }
}
