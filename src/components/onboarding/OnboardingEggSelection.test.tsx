import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CompanionElementId } from "@/config/companionCatalog";
import { OnboardingEggSelection } from "./OnboardingEggSelection";

const mocks = vi.hoisted(() => ({
  reducedMotion: false,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, ...props }: any) => React.createElement(tag, props, children);
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
    useReducedMotion: () => mocks.reducedMotion,
  };
});

vi.mock("@/lib/companionAssetResolver", () => ({
  getPresetCompanionAssetUrl: () => "/species-preview.png",
  getUniversalEggAssetUrl: (element: string) => `/${element}-egg.png`,
}));

vi.mock("./OnboardingStageShell", () => ({
  OnboardingStageShell: ({ children }: { children: any }) => <div>{children}</div>,
}));

const Harness = ({ onContinue }: { onContinue: () => void }) => {
  const [selectedElement, setSelectedElement] = useState<CompanionElementId | null>(null);

  return (
    <OnboardingEggSelection
      presetId="dragon"
      storyTone="epic_adventure"
      selectedElement={selectedElement}
      onSelectElement={setSelectedElement}
      onBack={vi.fn()}
      onContinue={onContinue}
    />
  );
};

describe("OnboardingEggSelection", () => {
  it("shows the renamed product labels and gates continue until an egg is selected", () => {
    mocks.reducedMotion = false;
    const onContinue = vi.fn();

    render(<Harness onContinue={onContinue} />);

    expect(screen.getByText("Ember")).toBeInTheDocument();
    expect(screen.getByText("Frost")).toBeInTheDocument();
    expect(screen.getByText("Terra")).toBeInTheDocument();

    const continueButton = screen.getByRole("button", { name: /seal my egg/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /ember egg/i }));

    expect(screen.getByRole("button", { name: /seal my egg/i })).toBeEnabled();
    expect(screen.getByTestId("egg-slot-fire")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("egg-slot-ice")).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: /seal my egg/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("disables looping chamber animation when reduced motion is enabled", () => {
    mocks.reducedMotion = true;

    render(<Harness onContinue={vi.fn()} />);

    expect(screen.getByTestId("egg-slot-fire")).toHaveAttribute("data-animated", "false");
    expect(screen.getByTestId("egg-slot-void")).toHaveAttribute("data-animated", "false");
  });
});
