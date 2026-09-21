import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvolutionProvider, useEvolution } from "@/contexts/EvolutionContext";
import { EvolveButton } from "./EvolveButton";

const LateLoadingUpdate = () => {
  const { setIsEvolvingLoading } = useEvolution();
  useEffect(() => { setIsEvolvingLoading(true); }, [setIsEvolvingLoading]);
  return null;
};

describe("EvolveButton", () => {
  it("allows the ready reveal even while old loading and mutation flags remain set", () => {
    const onEvolve = vi.fn();
    render(<EvolutionProvider>
      <LateLoadingUpdate />
      <EvolveButton isEvolving revealReady actionLabel="REVEAL" onEvolve={onEvolve} />
    </EvolutionProvider>);
    const button = screen.getByRole("button", { name: "REVEAL" });
    expect(button).toBeEnabled();
    expect(button.style.animation).toBe("");
    expect(button.querySelector("div")).toBeNull();
    expect(button).toHaveClass("text-sm");
    fireEvent.click(button);
    expect(onEvolve).toHaveBeenCalledTimes(1);
  });

  it("still prevents duplicate hatch requests while the custom reveal is preparing", () => {
    const onEvolve = vi.fn();
    render(<EvolutionProvider>
      <LateLoadingUpdate />
      <EvolveButton isEvolving={false} loadingLabel="PREPARING..." onEvolve={onEvolve} />
    </EvolutionProvider>);
    const button = screen.getByRole("button", { name: "PREPARING..." });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onEvolve).not.toHaveBeenCalled();
  });
});
