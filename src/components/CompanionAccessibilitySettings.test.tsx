import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  profile: { readable_quest_cards_enabled: false },
  autoplayVoice: false,
  muteSpokenReplies: false,
  setAutoplayVoice: vi.fn(),
  setMuteSpokenReplies: vi.fn(),
  invalidateQueries: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mocks.update,
    })),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useCompanionVoiceSettings", () => ({
  useCompanionVoiceSettings: () => ({
    autoplayVoice: mocks.autoplayVoice,
    setAutoplayVoice: mocks.setAutoplayVoice,
    muteSpokenReplies: mocks.muteSpokenReplies,
    setMuteSpokenReplies: mocks.setMuteSpokenReplies,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

import { CompanionAccessibilitySettings } from "./CompanionAccessibilitySettings";

describe("CompanionAccessibilitySettings", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.profile = { readable_quest_cards_enabled: false };
    mocks.autoplayVoice = false;
    mocks.muteSpokenReplies = false;
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ error: null });
    vi.clearAllMocks();
  });

  it("enables spoken replies from the accessibility setting", () => {
    render(<CompanionAccessibilitySettings />);

    fireEvent.click(screen.getByRole("switch", { name: "Read companion replies aloud" }));

    expect(mocks.setMuteSpokenReplies).toHaveBeenCalledWith(false);
    expect(mocks.setAutoplayVoice).toHaveBeenCalledWith(true);
  });

  it("turns spoken replies off from the accessibility setting", () => {
    mocks.autoplayVoice = true;

    render(<CompanionAccessibilitySettings />);

    fireEvent.click(screen.getByRole("switch", { name: "Read companion replies aloud" }));

    expect(mocks.setAutoplayVoice).toHaveBeenCalledWith(false);
    expect(mocks.setMuteSpokenReplies).not.toHaveBeenCalled();
  });

  it("saves the readable quest cards preference from the accessibility setting", async () => {
    render(<CompanionAccessibilitySettings />);

    fireEvent.click(screen.getByRole("switch", { name: "Readable quest cards" }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        readable_quest_cards_enabled: true,
      });
    });

    expect(mocks.eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["profile", "user-1"],
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Preference Updated",
      description: "Quest cards will use a clearer backing",
    });
  });
});
