import { describe, expect, it } from "vitest";
import { compareVersions, isVersionNewer } from "./versionCompare";

describe("compareVersions", () => {
  it("detects when right version is newer", () => {
    expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
  });

  it("treats missing trailing segments as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
  });

  it("returns zero for malformed versions", () => {
    expect(compareVersions("1.2.beta", "1.2.4")).toBe(0);
    expect(compareVersions("", "1.2.4")).toBe(0);
  });
});

describe("isVersionNewer", () => {
  it("returns true when latest is newer than current", () => {
    expect(isVersionNewer("1.0.0", "1.1.0")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isVersionNewer("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when either side is unavailable", () => {
    expect(isVersionNewer(null, "1.0.1")).toBe(false);
    expect(isVersionNewer("1.0.0", null)).toBe(false);
  });
});
