import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isEvolvingLoading: false,
}));

vi.mock("@/contexts/EvolutionContext", () => ({
  useEvolution: () => ({
    isEvolvingLoading: mocks.isEvolvingLoading,
  }),
}));

import { EvolveButton } from "./EvolveButton";

describe("EvolveButton", () => {
  beforeEach(() => {
    mocks.isEvolvingLoading = false;
  });

  it("renders degraded notice while keeping the evolve CTA actionable", () => {
    const onEvolve = vi.fn();

    render(
      <EvolveButton
        onEvolve={onEvolve}
        isEvolving={false}
        serviceState="degraded"
        serviceNotice="Evolution is busy right now. Try again in about a minute."
      />,
    );

    expect(screen.getByText(/Evolution is busy right now/i)).toBeInTheDocument();

    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onEvolve).toHaveBeenCalledTimes(1);
  });

  it("keeps processing state behavior unchanged", () => {
    render(
      <EvolveButton
        onEvolve={vi.fn()}
        isEvolving={true}
        etaMessage="About 90 seconds"
        serviceState="processing"
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("About 90 seconds")).toBeInTheDocument();
    expect(screen.getByText(/You can leave this screen/i)).toBeInTheDocument();
  });
});
