import { describe, expect, it } from "vitest";

import {
  JOURNEYS_DESKTOP_MIN_WIDTH,
  resolveJourneysLayoutMode,
} from "./useJourneysLayoutMode";

describe("resolveJourneysLayoutMode", () => {
  it("returns mobile below the desktop breakpoint on non-Mac surfaces", () => {
    expect(
      resolveJourneysLayoutMode({
        width: JOURNEYS_DESKTOP_MIN_WIDTH - 1,
        isMacHostedIOSApp: false,
      }),
    ).toBe("mobile");
  });

  it("returns desktop at or above the desktop breakpoint", () => {
    expect(
      resolveJourneysLayoutMode({
        width: JOURNEYS_DESKTOP_MIN_WIDTH,
        isMacHostedIOSApp: false,
      }),
    ).toBe("desktop");
  });

  it("returns desktop for Mac-hosted iOS even below the breakpoint", () => {
    expect(
      resolveJourneysLayoutMode({
        width: 900,
        isMacHostedIOSApp: true,
      }),
    ).toBe("desktop");
  });
});
