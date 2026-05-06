import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onEvolve when the button is actionable", () => {
    const onEvolve = vi.fn();

    render(<EvolveButton onEvolve={onEvolve} isEvolving={false} />);

    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onEvolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("This can take a few minutes")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You can leave this screen and come back when it is ready."),
    ).not.toBeInTheDocument();
  });

  it("disables the button while evolving", () => {
    vi.useFakeTimers();
    render(<EvolveButton onEvolve={vi.fn()} isEvolving={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("EVOLVING...")).toBeInTheDocument();
    expect(screen.getByText("This can take a few minutes")).toBeInTheDocument();
    expect(
      screen.getByText("You can leave this screen and come back when it is ready."),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(75_000);
    });

    expect(
      screen.getByText("Still working. Reveal videos can take several minutes."),
    ).toBeInTheDocument();
  });

  it("disables the button when global evolution loading is active", () => {
    mocks.isEvolvingLoading = true;
    const onEvolve = vi.fn();
    render(<EvolveButton onEvolve={onEvolve} isEvolving={false} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onEvolve).not.toHaveBeenCalled();
    expect(screen.getByText("This can take a few minutes")).toBeInTheDocument();
    expect(
      screen.getByText("You can leave this screen and come back when it is ready."),
    ).toBeInTheDocument();
  });
});
