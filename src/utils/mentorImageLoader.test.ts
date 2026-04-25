import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/assets/sage-mentor.png", () => ({ default: "/mock/sage-mentor.png" }));
vi.mock("@/assets/lyra-mentor.png", () => ({ default: "/mock/lyra-mentor.png" }));
vi.mock("@/assets/icon-mentor.png", () => ({ default: "/mock/icon-mentor.png" }));
vi.mock("@/assets/charles-mentor.png", () => ({ default: "/mock/charles-mentor.png" }));
vi.mock("@/assets/princess-mentor.png", () => ({ default: "/mock/princess-mentor.png" }));
vi.mock("@/assets/stryker-sage.png", () => ({ default: "/mock/operator-mentor.png" }));
vi.mock("@/assets/rival-mentor.png", () => ({ default: "/mock/rival-mentor.png" }));
vi.mock("@/assets/reign-sage.png", () => ({ default: "/mock/reign-mentor.png" }));

import {
  clearMentorImageCache,
  getDirectMentorAvatarUrl,
  loadMentorImage,
  resolveMentorImageSource,
} from "./mentorImageLoader";

describe("mentorImageLoader", () => {
  beforeEach(() => {
    clearMentorImageCache();
  });

  it("resolves legacy aliases to the new canonical art assets", async () => {
    await expect(loadMentorImage("atlas")).resolves.toBe("/mock/sage-mentor.png");
    await expect(loadMentorImage("carmen")).resolves.toBe("/mock/icon-mentor.png");
    await expect(loadMentorImage("solace")).resolves.toBe("/mock/charles-mentor.png");
    await expect(loadMentorImage("sienna")).resolves.toBe("/mock/princess-mentor.png");
    await expect(loadMentorImage("eli")).resolves.toBe("/mock/rival-mentor.png");
  });

  it("keeps operator pointed at the current stryker portrait", async () => {
    await expect(loadMentorImage("operator")).resolves.toBe("/mock/operator-mentor.png");
    await expect(loadMentorImage("stryker")).resolves.toBe("/mock/operator-mentor.png");
  });

  it("loads Lyra from bundled art and ignores the stale storage URL", async () => {
    await expect(loadMentorImage("lyra")).resolves.toBe("/mock/lyra-mentor.png");
    expect(
      getDirectMentorAvatarUrl(
        "lyra",
        "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/lyra-mentor.png",
      ),
    ).toBeNull();

    await expect(
      resolveMentorImageSource(
        "lyra",
        "https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/lyra-mentor.png",
      ),
    ).resolves.toBe("/mock/lyra-mentor.png");
  });

  it("keeps usable avatar URLs for mentors without stale art paths", async () => {
    await expect(resolveMentorImageSource("sage", "https://cdn.example.com/sage.png")).resolves.toBe(
      "https://cdn.example.com/sage.png",
    );
  });

  it("preserves the legacy reign portrait and defaults unknown slugs to sage", async () => {
    await expect(loadMentorImage("reign")).resolves.toBe("/mock/reign-mentor.png");
    await expect(loadMentorImage("unknown-mentor")).resolves.toBe("/mock/sage-mentor.png");
  });
});
