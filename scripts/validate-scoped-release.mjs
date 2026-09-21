import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Expanding this set requires source/version comparison for both apps.
const reviewedFunctions = new Set([
  "companion-wellbeing-video", "generate-companion-evolution",
  "process-companion-evolution-job", "generate-companion-stat-analysis",
  // Live v22 and its dependency closure reconciled before release 359.
  "process-companion-cinema-event",
]);

export function validateScopedRelease(expected, live) {
  if (!expected || Array.isArray(expected) || typeof expected !== "object" || !Object.keys(expected).length) {
    throw new Error("Provide a nonempty object mapping reviewed function names to their current live versions (0 only for a new function).");
  }
  if (!Array.isArray(live)) throw new Error("Unexpected live inventory format; refusing to deploy.");
  const names = Object.keys(expected).sort();
  for (const name of names) {
    if (!reviewedFunctions.has(name)) throw new Error(`Unreconciled function: ${name}`);
    const version = expected[name];
    if (!Number.isSafeInteger(version) || version < 0) throw new Error(`Invalid expected version: ${name}`);
    const entries = live.filter(row => (row.slug ?? row.name) === name);
    if (entries.length > 1) throw new Error(`Ambiguous inventory: ${name}`);
    const actual = entries[0]?.version ?? 0;
    if (actual !== version) throw new Error(`Live version changed for ${name}: expected ${version}, found ${actual}. Reconcile before deploying.`);
    if (entries[0] && entries[0].status !== "ACTIVE") throw new Error(`Function is not active: ${name}`);
  }
  return names;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const expected = JSON.parse(process.env.FUNCTION_VERSIONS ?? "{}");
    const live = JSON.parse(readFileSync(process.argv[2], "utf8"));
    console.log(validateScopedRelease(expected, live).join("\n"));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
