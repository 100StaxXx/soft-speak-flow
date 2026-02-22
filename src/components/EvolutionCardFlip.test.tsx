import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EvolutionCardFlip } from "@/components/EvolutionCardFlip";

const downloadCardElementMock = vi.fn().mockResolvedValue(undefined);
const tapMock = vi.fn();

vi.mock("@/utils/imageDownload", () => ({
  downloadCardElement: (...args: unknown[]) => downloadCardElementMock(...args),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    tap: tapMock,
  }),
}));

const baseCard = {
  id: "card-1",
  creature_name: "Cyndathia",
  evolution_stage: 0,
  image_url: null,
  rarity: "Common",
  stats: {
    vitality: 320,
    wisdom: 340,
    discipline: 360,
    resolve: 380,
    creativity: 400,
    alignment: 420,
  },
  story_text: "A bold legend.",
  traits: ["Radiant", "Calm"],
  element: "fire",
  species: "dolphin",
  energy_cost: 1,
  bond_level: 40,
};

describe("EvolutionCardFlip", () => {
  beforeEach(() => {
    downloadCardElementMock.mockClear();
    tapMock.mockClear();
  });

  it("renders all 6 companion attributes and keeps energy/bond badges", () => {
    render(<EvolutionCardFlip card={baseCard} />);

    expect(screen.getByText(/Vitality/)).toBeInTheDocument();
    expect(screen.getByText(/Wisdom/)).toBeInTheDocument();
    expect(screen.getByText(/Discipline/)).toBeInTheDocument();
    expect(screen.getByText(/Resolve/)).toBeInTheDocument();
    expect(screen.getByText(/Creativity/)).toBeInTheDocument();
    expect(screen.getByText(/Alignment/)).toBeInTheDocument();

    expect(screen.getByText(/⚡/)).toBeInTheDocument();
    expect(screen.getByText(/🤝/)).toBeInTheDocument();
  });

  it("shows explicit legacy message when card stats are not 6-attribute snapshots", () => {
    render(
      <EvolutionCardFlip
        card={{
          ...baseCard,
          stats: { mind: 55, body: 65, soul: 75 },
        }}
      />,
    );

    expect(screen.getByTestId("legacy-stats-message")).toHaveTextContent(
      "Legacy card: regenerate to view 6 attributes.",
    );

    fireEvent.click(screen.getByRole("button", { name: /open cyndathia companion card/i }));

    expect(screen.getByTestId("legacy-stats-message-modal")).toHaveTextContent(
      "Legacy card: regenerate to view 6 attributes.",
    );
  });

  it("resets flip state when dialog closes and reopens", () => {
    render(<EvolutionCardFlip card={baseCard} />);

    const openCardButton = screen.getByRole("button", { name: /open cyndathia companion card/i });
    fireEvent.click(openCardButton);

    const innerCard = screen.getByTestId("evolution-card-inner");
    expect(innerCard).toHaveAttribute("data-flipped", "false");

    fireEvent.click(screen.getByTestId("evolution-card-flip-target"));
    expect(screen.getByTestId("evolution-card-inner")).toHaveAttribute("data-flipped", "true");

    fireEvent.click(screen.getByRole("button", { name: /close companion card/i }));

    fireEvent.click(openCardButton);
    expect(screen.getByTestId("evolution-card-inner")).toHaveAttribute("data-flipped", "false");
  });

  it("shares using downloadCardElement from the fullscreen card", () => {
    render(<EvolutionCardFlip card={baseCard} />);

    fireEvent.click(screen.getByRole("button", { name: /open cyndathia companion card/i }));
    fireEvent.click(screen.getByRole("button", { name: /share companion card/i }));

    expect(downloadCardElementMock).toHaveBeenCalledTimes(1);
    expect(downloadCardElementMock.mock.calls[0]?.[1]).toContain("cyndathia-stage-0.png");
  });
});
