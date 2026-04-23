import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(__dirname, "..");
const runtimeBoundaryRoots = [
  path.resolve(srcRoot, "hooks"),
  path.resolve(srcRoot, "components"),
  path.resolve(srcRoot, "pages"),
  path.resolve(srcRoot, "features"),
];

const allowedUseEpicsImporters = [
  path.resolve(srcRoot, "hooks", "useCampaigns.ts"),
].sort();

const allowedUseTaskMutationsImporters = [
  path.resolve(srcRoot, "hooks", "useQuestMutations.ts"),
].sort();

const allowedUseDailyTasksImporters = [
  path.resolve(srcRoot, "hooks", "useQuests.ts"),
].sort();

const allowedLegacyAssistantImporters: string[] = [];

const collectRuntimeSourceFiles = (dirPath: string): string[] =>
  fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return collectRuntimeSourceFiles(entryPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith(".d.ts")) {
      return [];
    }

    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
      return [];
    }

    return [entryPath];
  });

const importsNamedHook = (source: string, modulePathFragment: string, hookName: string) => {
  const hookImportBlocks = source.match(
    new RegExp(`import[\\s\\S]*?from\\s+[\"'][^\"']*${modulePathFragment}[\"'];?`, "gm"),
  ) ?? [];

  return hookImportBlocks.some((importBlock) =>
    new RegExp(`\\b${hookName}\\b`).test(importBlock),
  );
};

const findHookImporters = (modulePathFragment: string, hookName: string) =>
  runtimeBoundaryRoots
    .flatMap(collectRuntimeSourceFiles)
    .filter((filePath) => importsNamedHook(
      fs.readFileSync(filePath, "utf8"),
      modulePathFragment,
      hookName,
    ))
    .sort();

describe("normalization wrapper boundaries", () => {
  it("keeps useEpics isolated behind useCampaigns", () => {
    expect(findHookImporters("useEpics", "useEpics")).toEqual(allowedUseEpicsImporters);
  });

  it("keeps useTaskMutations isolated behind useQuestMutations", () => {
    expect(findHookImporters("useTaskMutations", "useTaskMutations")).toEqual(allowedUseTaskMutationsImporters);
  });

  it("keeps useDailyTasks isolated behind useQuests", () => {
    expect(findHookImporters("useDailyTasks", "useDailyTasks")).toEqual(allowedUseDailyTasksImporters);
  });

  it("keeps the legacy companion assistant adapter out of runtime imports", () => {
    expect(findHookImporters("useLegacyCompanionAssistantAdapter", "useLegacyCompanionAssistantAdapter")).toEqual(
      allowedLegacyAssistantImporters,
    );
  });
});
