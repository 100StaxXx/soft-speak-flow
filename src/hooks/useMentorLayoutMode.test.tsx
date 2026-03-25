import { describe, expect, it } from "vitest";
import {
  MENTOR_DESKTOP_MIN_WIDTH,
  resolveMentorLayoutMode,
} from "./useMentorLayoutMode";

describe("resolveMentorLayoutMode", () => {
  it("returns mobile below the desktop breakpoint on non-Mac surfaces", () => {
    expect(
      resolveMentorLayoutMode({
        width: MENTOR_DESKTOP_MIN_WIDTH - 1,
        isMacHostedIOSApp: false,
      }),
    ).toBe("mobile");
  });

  it("returns desktop at or above the desktop breakpoint", () => {
    expect(
      resolveMentorLayoutMode({
        width: MENTOR_DESKTOP_MIN_WIDTH,
        isMacHostedIOSApp: false,
      }),
    ).toBe("desktop");
  });

  it("returns desktop for Mac-hosted iOS even below the breakpoint", () => {
    expect(
      resolveMentorLayoutMode({
        width: 900,
        isMacHostedIOSApp: true,
      }),
    ).toBe("desktop");
  });
});
