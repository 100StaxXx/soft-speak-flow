import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JourneysCompanionLauncher } from "./JourneysCompanionLauncher";

const mocks = vi.hoisted(() => ({
  useJourneysCompanionVisual: vi.fn(),
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: mocks.useJourneysCompanionVisual,
}));

describe("JourneysCompanionLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useJourneysCompanionVisual.mockReturnValue({
      companionLabel: "Nova",
      imageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
      focalX: null,
      focalY: null,
      element: "fire",
      usesPortraitShell: true,
      launcherAwayImageUrl: null,
      launcherAwayFocalX: null,
      launcherAwayFocalY: null,
      launcherAwayUsesPortraitShell: false,
    });
  });

  it("renders the floating hero launcher as larger art-only portrait treatment", () => {
    render(
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        data-testid="launcher"
      />,
    );

    const launcher = screen.getByTestId("launcher");
    const image = screen.getByRole("img", { name: "Nova" });

    expect(launcher).toHaveClass("h-36", "w-36", "overflow-visible", "bg-transparent");
    expect(launcher.className).not.toContain("backdrop-blur-xl");
    expect(launcher.className).not.toContain("border-[#4d2811]");
    expect(launcher.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
    expect(image).toHaveAttribute("data-companion-image-fit", "portrait");
    expect(image.parentElement).toHaveClass("h-[7.75rem]", "w-[7.75rem]");
    expect(image.parentElement?.className).not.toContain("rounded");
  });

  it("uses contain framing for non-preset hero art", () => {
    render(
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        imageUrlOverride="https://example.com/custom-companion.png"
        usesPortraitShellOverride={false}
      />,
    );

    expect(screen.getByRole("img", { name: "Nova" })).toHaveAttribute("data-companion-image-fit", "contain");
  });
});
