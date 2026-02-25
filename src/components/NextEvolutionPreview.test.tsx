import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useCompanionMemories", () => ({
  useCompanionMemories: () => ({
    currentBond: null,
    isLoading: false,
  }),
}));

import { NextEvolutionPreview } from "./NextEvolutionPreview";

describe("NextEvolutionPreview", () => {
  it("applies near-evolution pulse accent at 97% when not ready", () => {
    render(
      <NextEvolutionPreview
        currentStage={4}
        currentXP={97}
        nextEvolutionXP={100}
        progressPercent={97}
        showBondProgress={false}
      />,
    );

    expect(screen.getByTestId("next-evolution-progress")).toHaveClass("motion-safe:animate-pulse");
  });

  it("does not apply pulse accent below near-evolution threshold", () => {
    render(
      <NextEvolutionPreview
        currentStage={4}
        currentXP={96}
        nextEvolutionXP={100}
        progressPercent={96}
        showBondProgress={false}
      />,
    );

    expect(screen.getByTestId("next-evolution-progress")).not.toHaveClass("motion-safe:animate-pulse");
  });

  it("keeps ready state copy and suppresses near-only pulse when evolvable", () => {
    render(
      <NextEvolutionPreview
        currentStage={4}
        currentXP={100}
        nextEvolutionXP={100}
        progressPercent={100}
        showBondProgress={false}
      />,
    );

    expect(screen.getByText("Ready!")).toBeInTheDocument();
    expect(screen.getByTestId("next-evolution-progress")).not.toHaveClass("motion-safe:animate-pulse");
  });
});
