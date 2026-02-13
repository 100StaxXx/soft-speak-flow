import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reducedMotion: false,
  isVisible: true,
  isMobile: false,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => mocks.reducedMotion,
  };
});

vi.mock("@/hooks/useVisibleAnimation", () => ({
  useVisibleAnimation: () => ({
    ref: { current: null },
    isVisible: mocks.isVisible,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock("@/hooks/useJourneyPathImage", () => ({
  useJourneyPathImage: () => ({
    pathImageUrl: null,
    isLoading: false,
    isGenerating: false,
  }),
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
    notification: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: { Medium: "MEDIUM" },
  NotificationType: { Success: "SUCCESS" },
}));

import { ConstellationTrail } from "./ConstellationTrail";

describe("ConstellationTrail", () => {
  beforeEach(() => {
    mocks.reducedMotion = false;
    mocks.isVisible = true;
    mocks.isMobile = false;
  });

  it("disables repeating background motion when reduced-motion is enabled", () => {
    mocks.reducedMotion = true;

    render(<ConstellationTrail progress={25} targetDays={30} surface="card" />);

    expect(screen.getByTestId("constellation-trail")).toHaveAttribute("data-motion-active", "false");
    const stars = screen.getAllByTestId("bg-star");
    expect(stars.every((star) => star.getAttribute("data-star-animated") === "false")).toBe(true);
  });

  it("pauses loop animations when the component is offscreen", () => {
    mocks.isVisible = false;

    render(<ConstellationTrail progress={25} targetDays={30} surface="card" />);

    expect(screen.getByTestId("constellation-trail")).toHaveAttribute("data-motion-active", "false");
    const stars = screen.getAllByTestId("bg-star");
    expect(stars.every((star) => star.getAttribute("data-star-animated") === "false")).toBe(true);
  });

  it("uses richer star counts in drawer surface than card surface", () => {
    const { unmount } = render(<ConstellationTrail progress={40} targetDays={45} surface="card" />);

    const cardStars = screen.getAllByTestId("bg-star");
    const cardAnimated = cardStars.filter((star) => star.getAttribute("data-star-animated") === "true");
    expect(cardStars).toHaveLength(14);
    expect(cardAnimated).toHaveLength(6);

    unmount();

    render(<ConstellationTrail progress={40} targetDays={45} surface="drawer" />);

    const drawerStars = screen.getAllByTestId("bg-star");
    const drawerAnimated = drawerStars.filter((star) => star.getAttribute("data-star-animated") === "true");
    expect(drawerStars.length).toBeGreaterThan(cardStars.length);
    expect(drawerAnimated.length).toBeGreaterThan(cardAnimated.length);
  });
});
