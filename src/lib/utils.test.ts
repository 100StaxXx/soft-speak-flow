import { describe, expect, it } from "vitest";
import { formatDisplayLabel } from "./utils";

describe("formatDisplayLabel", () => {
  it("formats snake_case labels to title case", () => {
    expect(formatDisplayLabel("guided_tutorial_step_complete")).toBe("Guided Tutorial Step Complete");
  });

  it("formats multi-word snake_case labels", () => {
    expect(formatDisplayLabel("very_aggressive")).toBe("Very Aggressive");
  });

  it("formats kebab-case labels", () => {
    expect(formatDisplayLabel("pep-talk")).toBe("Pep Talk");
  });

  it("collapses repeated separators and trims", () => {
    expect(formatDisplayLabel("  check__in  ")).toBe("Check In");
  });

  it("returns an empty string for undefined", () => {
    expect(formatDisplayLabel(undefined)).toBe("");
  });
});
