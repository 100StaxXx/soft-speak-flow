#!/usr/bin/env node

import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const functionsRoot = path.resolve("supabase/functions");
const testsByDirectory = new Map();

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
    } else if (entry.name.endsWith(".test.ts")) {
      const parent = path.dirname(entryPath);
      const tests = testsByDirectory.get(parent) ?? [];
      tests.push(entryPath);
      testsByDirectory.set(parent, tests);
    }
  }
};

walk(functionsRoot);

let totalFiles = 0;
for (const [directory, tests] of [...testsByDirectory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  tests.sort();
  totalFiles += tests.length;
  console.log(`[functions:test] ${path.relative(process.cwd(), directory)} (${tests.length} file${tests.length === 1 ? "" : "s"})`);
  const result = spawnSync(
    "deno",
    ["test", "--allow-all", ...tests],
    { stdio: "inherit", env: { ...process.env } },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[functions:test] ${totalFiles} test files passed in isolated function directories.`);
