import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/assets/sage-mentor.png", () => ({ default: "/mock/sage-mentor.png" }));
vi.mock("@/assets/lyra-mentor.png", () => ({ default: "/mock/lyra-mentor.png" }));
vi.mock("@/assets/icon-mentor.png", () => ({ default: "/mock/icon-mentor.png" }));
vi.mock("@/assets/charles-mentor.png", () => ({ default: "/mock/charles-mentor.png" }));
vi.mock("@/assets/princess-mentor.png", () => ({ default: "/mock/princess-mentor.png" }));
vi.mock("@/assets/operator-mentor.png", () => ({ default: "/mock/operator-mentor.png" }));
vi.mock("@/assets/rival-mentor.png", () => ({ default: "/mock/rival-mentor.png" }));

import { clearMentorImageCache, loadMentorImage } from "./mentorImageLoader";

describe("mentorImageLoader", () => {
  beforeEach(() => {
    clearMentorImageCache();
  });

  it("loads canonical mentor art assets", async () => {
    await expect(loadMentorImage("sage")).resolves.toBe("/mock/sage-mentor.png");
    await expect(loadMentorImage("lyra")).resolves.toBe("/mock/lyra-mentor.png");
    await expect(loadMentorImage("icon")).resolves.toBe("/mock/icon-mentor.png");
    await expect(loadMentorImage("charles")).resolves.toBe("/mock/charles-mentor.png");
    await expect(loadMentorImage("princess")).resolves.toBe("/mock/princess-mentor.png");
    await expect(loadMentorImage("rival")).resolves.toBe("/mock/rival-mentor.png");
  });

  it("loads the canonical operator portrait", async () => {
    await expect(loadMentorImage("operator")).resolves.toBe("/mock/operator-mentor.png");
  });

  it("defaults unknown and unsupported slugs to sage", async () => {
    await expect(loadMentorImage("retired-guide")).resolves.toBe("/mock/sage-mentor.png");
    await expect(loadMentorImage("legacy-alpha")).resolves.toBe("/mock/sage-mentor.png");
    await expect(loadMentorImage("unknown-mentor")).resolves.toBe("/mock/sage-mentor.png");
  });
});
