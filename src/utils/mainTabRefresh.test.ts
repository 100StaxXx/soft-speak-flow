import { describe, expect, it } from "vitest";
import {
  buildRefreshPredicate,
  getCoreRefreshPrefixes,
  getTabRefreshPrefixes,
  type MainTabPath,
} from "@/utils/mainTabRefresh";

describe("mainTabRefresh", () => {
  it("returns core prefixes for all paths", () => {
    const core = getCoreRefreshPrefixes();
    expect(core).toContain("profile");
    expect(core).toContain("calendar-connections");
    expect(core).toContain("inbox-count");
  });

  it("returns tab-specific prefixes for each tab", () => {
    const tabChecks: Array<{ path: MainTabPath; expected: string }> = [
      { path: "/mentor", expected: "morning-briefing" },
      { path: "/inbox", expected: "inbox-tasks" },
      { path: "/journeys", expected: "daily-tasks" },
      { path: "/companion", expected: "companion" },
    ];

    for (const { path, expected } of tabChecks) {
      expect(getTabRefreshPrefixes(path)).toContain(expected);
    }
  });

  it("matches only allowed query prefixes for a given tab", () => {
    const predicate = buildRefreshPredicate("/journeys");

    expect(predicate({ queryKey: ["daily-tasks", "u1", "2026-02-13"] } as any)).toBe(true);
    expect(predicate({ queryKey: ["calendar-tasks", "u1"] } as any)).toBe(true);
    expect(predicate({ queryKey: ["profile", "u1"] } as any)).toBe(true);

    expect(predicate({ queryKey: ["companion", "u1"] } as any)).toBe(false);
    expect(predicate({ queryKey: ["random-query"] } as any)).toBe(false);
  });
});
