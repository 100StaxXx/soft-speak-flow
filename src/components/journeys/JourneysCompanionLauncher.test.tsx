import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JourneysCompanionLauncher } from "./JourneysCompanionLauncher";

const mocks = vi.hoisted(() => ({
  useJourneysCompanionVisual: vi.fn(),
  useCompanionImageBackgroundCutout: vi.fn(() => ({
    cutoutSrc: null,
    status: "idle",
  })),
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: mocks.useJourneysCompanionVisual,
}));

vi.mock("@/hooks/useCompanionImageBackgroundCutout", () => ({
  useCompanionImageBackgroundCutout: mocks.useCompanionImageBackgroundCutout,
}));

describe("JourneysCompanionLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCompanionImageBackgroundCutout.mockReturnValue({
      cutoutSrc: null,
      status: "idle",
    });
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

  it("renders the floating hero launcher without a visible shell around the art", () => {
    render(
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        data-testid="launcher"
      />,
    );

    const launcher = screen.getByTestId("launcher");
    const image = screen.getByRole("img", { name: "Nova" });
    const heroWrapper = launcher.firstElementChild as HTMLElement;

    expect(launcher).toHaveClass(
      "h-36",
      "w-36",
      "overflow-visible",
      "rounded-full",
      "border-0",
      "bg-transparent",
      "shadow-none",
      "p-0",
    );
    expect(launcher.className).not.toContain("border-[#4d2811]");
    expect(launcher.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
    expect(image).toHaveAttribute("data-companion-image-fit", "portrait");
    expect(image.parentElement).toHaveClass("h-[7.75rem]", "w-[7.75rem]");
    expect(image.parentElement?.className).not.toContain("rounded");
    expect(heroWrapper).not.toHaveClass("h-full", "w-full");
    expect(image.parentElement).toHaveStyle("filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.24))");
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

  it("can suppress image fallback and render a neutral placeholder", () => {
    render(
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        imageUrlOverride={null}
        allowImageFallback={false}
        data-testid="launcher"
      />,
    );

    expect(screen.getByTestId("journeys-companion-launcher-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Nova" })).not.toBeInTheDocument();
  });

  it("shows a placeholder instead of original art when a required hero cutout fails", () => {
    mocks.useCompanionImageBackgroundCutout.mockReturnValue({
      cutoutSrc: null,
      status: "failed",
    });

    render(
      <JourneysCompanionLauncher
        variant="floating"
        floatingSize="hero"
        imageUrlOverride="https://example.com/launcher-with-light-bg.png"
        usesPortraitShellOverride={false}
        requireHeroCutout
        data-testid="launcher"
      />,
    );

    expect(screen.getByTestId("journeys-companion-launcher-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Nova" })).not.toBeInTheDocument();
  });
});
