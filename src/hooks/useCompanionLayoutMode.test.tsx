import { describe, expect, it } from "vitest";
import {
  COMPANION_DESKTOP_MIN_WIDTH,
  resolveCompanionLayoutMode,
} from "./useCompanionLayoutMode";

describe("resolveCompanionLayoutMode", () => {
  it("returns mobile below the desktop breakpoint on non-Mac surfaces", () => {
    expect(
      resolveCompanionLayoutMode({
        width: COMPANION_DESKTOP_MIN_WIDTH - 1,
        isMacHostedIOSApp: false,
      }),
    ).toBe("mobile");
  });

  it("returns desktop at or above the desktop breakpoint", () => {
    expect(
      resolveCompanionLayoutMode({
        width: COMPANION_DESKTOP_MIN_WIDTH,
        isMacHostedIOSApp: false,
      }),
    ).toBe("desktop");
  });

  it("returns desktop for Mac-hosted iOS even below the breakpoint", () => {
    expect(
      resolveCompanionLayoutMode({
        width: 900,
        isMacHostedIOSApp: true,
      }),
    ).toBe("desktop");
  });
});
