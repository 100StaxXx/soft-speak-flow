import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
  },
}));

import { buildEpicInviteLink, buildEpicInviteShareText } from "@/utils/epicInviteShare";

describe("epicInviteShare", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds invite links from the current web origin", () => {
    expect(buildEpicInviteLink("EPIC-QUEST-1234")).toBe(
      `${window.location.origin}/join/EPIC-QUEST-1234`,
    );
  });

  it("builds app-only invite deep links on native platforms", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);

    expect(buildEpicInviteLink("EPIC-QUEST-1234")).toBe(
      "cosmiq://join/EPIC-QUEST-1234",
    );
  });

  it("trims and URL-encodes native invite deep links", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);

    expect(buildEpicInviteLink(" EPIC QUEST/1234 ")).toBe(
      "cosmiq://join/EPIC%20QUEST%2F1234",
    );
  });

  it("trims and URL-encodes invite codes", () => {
    expect(buildEpicInviteLink(" EPIC QUEST/1234 ")).toBe(
      `${window.location.origin}/join/EPIC%20QUEST%2F1234`,
    );
  });

  it("builds readable invite share text", () => {
    expect(buildEpicInviteShareText("Campaign Alpha", "EPIC-QUEST-1234")).toBe(
      'Join my Cosmiq epic "Campaign Alpha" with invite code EPIC-QUEST-1234.',
    );
  });
});
