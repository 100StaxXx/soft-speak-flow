import { describe, expect, it } from "vitest";

import {
  getJourneyPathCardImageUrl,
  getJourneyPathDrawerImageUrl,
  getJourneyPathRenderUrl,
} from "./journeyPathUrls";

describe("journeyPathUrls", () => {
  it("returns transformed render urls for public journey path images", () => {
    const url = getJourneyPathRenderUrl(
      "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-1/0_123.png",
      {
        width: 1536,
        height: 1024,
        resize: "cover",
        quality: 70,
      },
    );

    expect(url).toBe(
      "https://example.supabase.co/storage/v1/render/image/public/journey-paths/user-1/epic-1/0_123.png?width=1536&height=1024&resize=cover&quality=70",
    );
  });

  it("preserves non-journey urls unchanged", () => {
    expect(getJourneyPathCardImageUrl("https://example.com/path.png")).toBe("https://example.com/path.png");
  });

  it("returns null for empty inputs", () => {
    expect(getJourneyPathDrawerImageUrl(null)).toBeNull();
    expect(getJourneyPathCardImageUrl("")).toBeNull();
  });

  it("upgrades existing render urls by overriding transform params", () => {
    const url = getJourneyPathCardImageUrl(
      "https://example.supabase.co/storage/v1/render/image/public/journey-paths/user-1/epic-1/0_123.png?width=200&quality=30",
    );

    expect(url).toBe(
      "https://example.supabase.co/storage/v1/render/image/public/journey-paths/user-1/epic-1/0_123.png?width=1536&quality=70&height=1024&resize=cover",
    );
  });
});
