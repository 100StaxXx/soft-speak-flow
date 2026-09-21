#!/usr/bin/env node

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const budgets = {
  ".js": 700 * 1024,
  ".css": 450 * 1024,
  ".png": 6 * 1024 * 1024,
  ".jpg": 3 * 1024 * 1024,
  ".jpeg": 3 * 1024 * 1024,
  ".webp": 3 * 1024 * 1024,
};
const violations = [];

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    const budget = budgets[extension];
    if (!budget) continue;
    const size = statSync(entryPath).size;
    if (size > budget) {
      violations.push({ file: path.relative(root, entryPath), size, budget });
    }
  }
};

walk(root);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `[bundle:budget] ${violation.file}: ${(violation.size / 1024).toFixed(1)} KiB exceeds ${(violation.budget / 1024).toFixed(0)} KiB.`,
    );
  }
  process.exit(1);
}

console.log(`[bundle:budget] ${root} is within JavaScript, CSS, and image budgets.`);
