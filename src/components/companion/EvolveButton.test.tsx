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

  it("calls onEvolve when the button is actionable", () => {
    const onEvolve = vi.fn();

    render(<EvolveButton onEvolve={onEvolve} isEvolving={false} />);

    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onEvolve).toHaveBeenCalledTimes(1);
  });

  it("disables the button while evolving", () => {
    render(<EvolveButton onEvolve={vi.fn()} isEvolving={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("EVOLVING...")).toBeInTheDocument();
  });

  it("disables the button when global evolution loading is active", () => {
    mocks.isEvolvingLoading = true;
    const onEvolve = vi.fn();
    render(<EvolveButton onEvolve={onEvolve} isEvolving={false} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onEvolve).not.toHaveBeenCalled();
  });
});
