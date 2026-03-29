#!/usr/bin/env node

import { chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

function getCurrentHooksPath() {
  try {
    return execFileSync("git", ["config", "--get", "core.hooksPath"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const hookPath = ".githooks";
const currentHooksPath = getCurrentHooksPath();

if (currentHooksPath && currentHooksPath !== hookPath) {
  console.warn(
    `Skipping hook install because core.hooksPath is already set to ${currentHooksPath}.`,
  );
  process.exit(0);
}

if (!existsSync(`${hookPath}/pre-commit`)) {
  console.error(`Missing ${hookPath}/pre-commit hook.`);
  process.exit(1);
}

chmodSync(`${hookPath}/pre-commit`, 0o755);
execFileSync("git", ["config", "core.hooksPath", hookPath], { stdio: "inherit" });

console.log(`Configured git hooks to use ${hookPath}.`);
