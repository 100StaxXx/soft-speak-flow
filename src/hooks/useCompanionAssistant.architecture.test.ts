import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const assistantHookPath = path.resolve(__dirname, "useCompanionAssistant.ts");
const assistantHookSource = fs.readFileSync(assistantHookPath, "utf8");

describe("useCompanionAssistant architecture guardrails", () => {
  it("does not import the legacy companion assistant adapter", () => {
    expect(assistantHookSource).not.toMatch(
      /^\s*import\s+.*\buseLegacyCompanionAssistantAdapter\b.*$/m,
    );
  });

  it("keeps the active shell free of shell-level legacy fallback toggles", () => {
    expect(assistantHookSource).not.toContain("shouldFallbackToLegacyAgent");
    expect(assistantHookSource).not.toContain("useLegacyFallback");
  });
});
