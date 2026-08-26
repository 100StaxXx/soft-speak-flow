import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/assets/guides/sage-guide.jpg", () => ({ default: "/mock/sage-guide.jpg" }));
vi.mock("@/assets/guides/lyra-guide.jpg", () => ({ default: "/mock/lyra-guide.jpg" }));
vi.mock("@/assets/guides/icon-guide.jpg", () => ({ default: "/mock/icon-guide.jpg" }));
vi.mock("@/assets/guides/charles-guide.jpg", () => ({ default: "/mock/charles-guide.jpg" }));
vi.mock("@/assets/guides/princess-guide.jpg", () => ({ default: "/mock/princess-guide.jpg" }));
vi.mock("@/assets/guides/operator-guide.jpg", () => ({ default: "/mock/operator-guide.jpg" }));
vi.mock("@/assets/guides/rival-guide.jpg", () => ({ default: "/mock/rival-guide.jpg" }));
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
    await expect(loadMentorImage("atlas")).resolves.toBe("/mock/sage-guide.jpg");
    await expect(loadMentorImage("carmen")).resolves.toBe("/mock/icon-guide.jpg");
    await expect(loadMentorImage("solace")).resolves.toBe("/mock/charles-guide.jpg");
    await expect(loadMentorImage("sienna")).resolves.toBe("/mock/princess-guide.jpg");
    await expect(loadMentorImage("eli")).resolves.toBe("/mock/rival-guide.jpg");
  });

  it("points operator and its legacy alias at the Guide portrait", async () => {
    await expect(loadMentorImage("operator")).resolves.toBe("/mock/operator-guide.jpg");
    await expect(loadMentorImage("stryker")).resolves.toBe("/mock/operator-guide.jpg");
  });

  it("loads Lyra from bundled art and ignores the stale storage URL", async () => {
    await expect(loadMentorImage("lyra")).resolves.toBe("/mock/lyra-guide.jpg");
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
    ).resolves.toBe("/mock/lyra-guide.jpg");
  });

  it("prefers reviewed bundled art over legacy URLs for every canonical Guide", async () => {
    expect(getDirectMentorAvatarUrl("sage", "https://cdn.example.com/sage.png")).toBeNull();
    await expect(resolveMentorImageSource("sage", "https://cdn.example.com/sage.png")).resolves.toBe(
      "/mock/sage-guide.jpg",
    );
  });

  it("preserves the legacy reign portrait and defaults unknown slugs to sage", async () => {
    await expect(loadMentorImage("reign")).resolves.toBe("/mock/reign-mentor.png");
    await expect(loadMentorImage("unknown-mentor")).resolves.toBe("/mock/sage-guide.jpg");
  });
});
