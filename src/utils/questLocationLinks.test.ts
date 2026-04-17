import { describe, expect, it, vi } from "vitest";

import {
  buildQuestLocationUrl,
  normalizeQuestLocationQuery,
  openQuestLocation,
} from "@/utils/questLocationLinks";

describe("questLocationLinks", () => {
  it("normalizes blank values to null", () => {
    expect(normalizeQuestLocationQuery("   ")).toBeNull();
    expect(normalizeQuestLocationQuery(null)).toBeNull();
  });

  it("builds an Apple Maps URL on native iOS", () => {
    expect(buildQuestLocationUrl("1 Infinite Loop, Cupertino, CA", { nativeIOS: true }))
      .toBe("https://maps.apple.com/?q=1%20Infinite%20Loop%2C%20Cupertino%2C%20CA");
  });

  it("builds a Google Maps URL on web and non-iOS", () => {
    expect(buildQuestLocationUrl("1600 Amphitheatre Pkwy, Mountain View, CA", { nativeIOS: false }))
      .toBe("https://www.google.com/maps/search/?api=1&query=1600%20Amphitheatre%20Pkwy%2C%20Mountain%20View%2C%20CA");
  });

  it("encodes apartment and unit text correctly", () => {
    expect(buildQuestLocationUrl("123 Main St Apt #4B, Los Angeles, CA", { nativeIOS: false }))
      .toBe("https://www.google.com/maps/search/?api=1&query=123%20Main%20St%20Apt%20%234B%2C%20Los%20Angeles%2C%20CA");
  });

  it("returns false and does not open for blank locations", () => {
    const openUrl = vi.fn();

    expect(openQuestLocation("   ", { openUrl, nativeIOS: false })).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("opens the expected URL for valid locations", () => {
    const openUrl = vi.fn();

    expect(openQuestLocation("1 Ferry Building, San Francisco, CA", { openUrl, nativeIOS: false })).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/?api=1&query=1%20Ferry%20Building%2C%20San%20Francisco%2C%20CA",
    );
  });
});
