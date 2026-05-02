import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  profile: {
    completed_tasks_stay_in_place: true,
    readable_quest_cards_enabled: false,
  },
  toast: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: mocks.profile }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

import { QuestBehaviorSettings } from "./QuestBehaviorSettings";

describe("QuestBehaviorSettings", () => {
  const renderWithClient = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <QuestBehaviorSettings />
      </QueryClientProvider>,
    );

    return { queryClient };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile = {
      completed_tasks_stay_in_place: true,
      readable_quest_cards_enabled: false,
    };
    mocks.eqMock.mockResolvedValue({ error: null });
    mocks.updateMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.fromMock.mockReturnValue({ update: mocks.updateMock });
  });

  it("saves the readable quest cards preference to the profile", async () => {
    renderWithClient();

    fireEvent.click(screen.getByRole("switch", { name: "Readable quest cards" }));

    await waitFor(() => {
      expect(mocks.fromMock).toHaveBeenCalledWith("profiles");
      expect(mocks.updateMock).toHaveBeenCalledWith({
        readable_quest_cards_enabled: true,
      });
      expect(mocks.eqMock).toHaveBeenCalledWith("id", "user-1");
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Preference Updated",
      description: "Quest and ritual cards will use a sturdier backing",
    });
  });
});
