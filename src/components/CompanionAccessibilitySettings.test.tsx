import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autoplayVoice: false,
  muteSpokenReplies: false,
  setAutoplayVoice: vi.fn(),
  setMuteSpokenReplies: vi.fn(),
}));

vi.mock("@/hooks/useCompanionVoiceSettings", () => ({
  useCompanionVoiceSettings: () => ({
    autoplayVoice: mocks.autoplayVoice,
    setAutoplayVoice: mocks.setAutoplayVoice,
    muteSpokenReplies: mocks.muteSpokenReplies,
    setMuteSpokenReplies: mocks.setMuteSpokenReplies,
  }),
}));

import { CompanionAccessibilitySettings } from "./CompanionAccessibilitySettings";

describe("CompanionAccessibilitySettings", () => {
  beforeEach(() => {
    mocks.autoplayVoice = false;
    mocks.muteSpokenReplies = false;
    vi.clearAllMocks();
  });

  it("enables spoken replies from the accessibility setting", () => {
    render(<CompanionAccessibilitySettings />);

    fireEvent.click(screen.getByRole("switch"));

    expect(mocks.setMuteSpokenReplies).toHaveBeenCalledWith(false);
    expect(mocks.setAutoplayVoice).toHaveBeenCalledWith(true);
  });

  it("turns spoken replies off from the accessibility setting", () => {
    mocks.autoplayVoice = true;

    render(<CompanionAccessibilitySettings />);

    fireEvent.click(screen.getByRole("switch"));

    expect(mocks.setAutoplayVoice).toHaveBeenCalledWith(false);
    expect(mocks.setMuteSpokenReplies).not.toHaveBeenCalled();
  });
});
