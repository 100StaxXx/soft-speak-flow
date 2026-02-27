import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TalkPopupProvider, useTalkPopupContext } from "@/contexts/TalkPopupContext";

const mocks = vi.hoisted(() => ({
  companion: null as {
    id: string;
    current_stage: number;
    current_image_url: string | null;
    cached_creature_name?: string | null;
    spirit_animal: string;
    core_element?: string | null;
  } | null,
  from: vi.fn(),
  evolutionMaybeSingle: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/components/companion/CompanionTalkPopup", () => ({
  CompanionTalkPopup: ({
    isVisible,
    message,
    companionName,
  }: {
    isVisible: boolean;
    message: string;
    companionName: string;
  }) => (
    <div
      data-testid="popup-props"
      data-visible={String(isVisible)}
      data-message={message}
      data-name={companionName}
    />
  ),
}));

const ShowProbe = ({ options }: { options: { message: string; companionName?: string | null } }) => {
  const { show } = useTalkPopupContext();

  useEffect(() => {
    void show(options);
  }, []);

  return null;
};

describe("TalkPopupContext", () => {
  beforeEach(() => {
    mocks.evolutionMaybeSingle.mockReset();
    mocks.updateEq.mockReset();
    mocks.from.mockReset();

    mocks.evolutionMaybeSingle.mockResolvedValue({ data: null });
    mocks.updateEq.mockResolvedValue({ data: null, error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "companion_evolution_cards") {
        const chain = {
          select: vi.fn(),
          eq: vi.fn(),
          order: vi.fn(),
          limit: vi.fn(),
          maybeSingle: mocks.evolutionMaybeSingle,
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        chain.order.mockReturnValue(chain);
        chain.limit.mockReturnValue(chain);
        return chain;
      }

      if (table === "user_companion") {
        const chain = {
          update: vi.fn(),
          eq: mocks.updateEq,
        };
        chain.update.mockReturnValue(chain);
        return chain;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("uses cached_creature_name without querying evolution cards", async () => {
    mocks.companion = {
      id: "comp-1",
      current_stage: 3,
      current_image_url: "https://example.com/companion.png",
      cached_creature_name: "Nova",
      spirit_animal: "eagle",
    };

    render(
      <TalkPopupProvider>
        <ShowProbe options={{ message: "Cached name path" }} />
      </TalkPopupProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("popup-props")).toHaveAttribute("data-visible", "true");
    });

    expect(screen.getByTestId("popup-props")).toHaveAttribute("data-name", "Nova");
    expect(mocks.evolutionMaybeSingle).not.toHaveBeenCalled();
  });

  it("fetches current-stage creature name and caches it", async () => {
    mocks.companion = {
      id: "comp-2",
      current_stage: 4,
      current_image_url: null,
      cached_creature_name: null,
      spirit_animal: "eagle",
    };
    mocks.evolutionMaybeSingle.mockResolvedValue({
      data: { creature_name: "Astra" },
    });

    render(
      <TalkPopupProvider>
        <ShowProbe options={{ message: "Fetched name path" }} />
      </TalkPopupProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("popup-props")).toHaveAttribute("data-name", "Astra");
    });

    expect(mocks.from).toHaveBeenCalledWith("companion_evolution_cards");
    expect(mocks.from).toHaveBeenCalledWith("user_companion");
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "comp-2");
  });

  it("assigns a proper name when no creature name is available and never falls back to species", async () => {
    mocks.companion = {
      id: "comp-3",
      current_stage: 1,
      current_image_url: null,
      cached_creature_name: null,
      spirit_animal: "eagle",
      core_element: "air",
    };
    mocks.evolutionMaybeSingle.mockResolvedValue({ data: null });

    render(
      <TalkPopupProvider>
        <ShowProbe options={{ message: "No name available" }} />
      </TalkPopupProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("popup-props")).toHaveAttribute("data-visible", "true");
    });

    const resolvedName = screen.getByTestId("popup-props").getAttribute("data-name");
    expect(resolvedName).toBeTruthy();
    expect(resolvedName).not.toBe("eagle");
  });

  it("respects explicit caller-provided companionName override", async () => {
    mocks.companion = {
      id: "comp-4",
      current_stage: 2,
      current_image_url: null,
      cached_creature_name: null,
      spirit_animal: "eagle",
    };

    render(
      <TalkPopupProvider>
        <ShowProbe options={{ message: "Override path", companionName: "Zephyr" }} />
      </TalkPopupProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("popup-props")).toHaveAttribute("data-name", "Zephyr");
    });

    expect(mocks.evolutionMaybeSingle).not.toHaveBeenCalled();
  });
});
