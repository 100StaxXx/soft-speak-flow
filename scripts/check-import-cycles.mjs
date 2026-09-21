#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve("src");
const sourceFiles = [];

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) {
      sourceFiles.push(entryPath);
    }
  }
};

const resolveModule = (fromFile, specifier) => {
  if (!(specifier.startsWith("@/") || specifier.startsWith("."))) return null;
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
};

walk(sourceRoot);
const graph = new Map();
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

for (const file of sourceFiles) {
  const dependencies = new Set();
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveModule(file, match[1] ?? match[2]);
    if (dependency) dependencies.add(dependency);
  }
  graph.set(file, dependencies);
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycles = new Set();

const visit = (file) => {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    const cycle = [...stack.slice(start), file].map((entry) => path.relative(process.cwd(), entry));
    const rotations = cycle.slice(0, -1).map((_, index) => {
      const body = [...cycle.slice(index, -1), ...cycle.slice(0, index)];
      return [...body, body[0]].join(" -> ");
    });
    cycles.add(rotations.sort()[0]);
    return;
  }
  if (visited.has(file)) return;

  visiting.add(file);
  stack.push(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
};

for (const file of graph.keys()) visit(file);

if (cycles.size > 0) {
  for (const cycle of [...cycles].sort()) console.error(`[cycles] ${cycle}`);
  process.exit(1);
}

console.log(`[cycles] No import cycles across ${sourceFiles.length} production source files.`);
