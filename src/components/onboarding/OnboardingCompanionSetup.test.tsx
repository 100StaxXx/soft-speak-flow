import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingCompanionSetup } from "./OnboardingCompanionSetup";

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
    useReducedMotion: () => false,
  };
});

vi.mock("@/lib/companionAssetResolver", () => ({
  getPresetCompanionAssetUrl: () => "/species-preview.png",
}));

vi.mock("@/config/companionCatalog", () => ({
  COMPANION_PRESETS: [
    {
      id: "dragon",
      displayName: "Dragon",
      carouselOrder: 1,
      role: "flagship mythic",
      signatureIdentity: "Ancient wings and ember scales",
      anatomyLock: "4 legs + 2 wings",
      revealCopy: "Ancient, bold, and born for legendary arcs.",
    },
    {
      id: "fox",
      displayName: "Kitsune",
      carouselOrder: 2,
      role: "mystic trickster",
      signatureIdentity: "Fox spirit silhouette and luminous tails",
      anatomyLock: "4 legs",
      revealCopy: "Mystical, clever, and lit by fox-fire.",
    },
  ],
  COMPANION_STORY_TONES: [
    {
      value: "epic_adventure",
      label: "Epic Adventure",
      summary: "Cinematic growth with bold heroic stakes.",
    },
    {
      value: "soft_gentle",
      label: "Soft & Gentle",
      summary: "Tender chapters with warmth and care.",
    },
  ],
}));

vi.mock("./OnboardingStageShell", () => ({
  OnboardingStageShell: ({ children }: { children: any }) => <div>{children}</div>,
}));

const Harness = ({ onContinue }: { onContinue: () => void }) => {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [storyTone, setStoryTone] = useState<string | null>(null);

  return (
    <OnboardingCompanionSetup
      selectedPresetId={presetId}
      selectedStoryTone={storyTone}
      onSelectPreset={setPresetId}
      onSelectStoryTone={setStoryTone}
      onContinue={onContinue}
    />
  );
};

describe("OnboardingCompanionSetup", () => {
  it("requires both a species and story tone before continuing", () => {
    const onContinue = vi.fn();

    render(<Harness onContinue={onContinue} />);

    expect(screen.getByTestId("species-preview-stage-dragon")).toBeInTheDocument();
    expect(screen.getByTestId("species-preview-image-dragon")).toHaveClass("object-contain");
    expect(screen.getByTestId("species-preview-image-dragon")).toHaveClass("h-48");
    expect(screen.getByTestId("species-preview-image-dragon")).not.toHaveClass("h-24");

    const continueButton = screen.getByRole("button", { name: /continue to egg chamber/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: /dragon/i })[0]);
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /epic adventure/i }));
    expect(screen.getByRole("button", { name: /continue to egg chamber/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /continue to egg chamber/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  }, 25000);
});
