import { render, screen } from "@testing-library/react";
import type { HTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="motion-wrapper" {...props}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => false,
  useScroll: () => ({ scrollYProgress: 0 }),
  useTransform: () => 0,
  useSpring: (value: unknown) => value,
}));

import { ParallaxCard } from "./parallax-card";

describe("ParallaxCard", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.getPlatform.mockReturnValue("web");
  });

  it("disables parallax wrapper on native iOS", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");

    render(
      <ParallaxCard>
        <div>Card Body</div>
      </ParallaxCard>,
    );

    expect(screen.queryByTestId("motion-wrapper")).not.toBeInTheDocument();
    expect(screen.getByText("Card Body")).toBeInTheDocument();
  });

  it("uses motion wrapper on non-native platforms", () => {
    render(
      <ParallaxCard>
        <div>Card Body</div>
      </ParallaxCard>,
    );

    expect(screen.getByTestId("motion-wrapper")).toBeInTheDocument();
    expect(screen.getByText("Card Body")).toBeInTheDocument();
  });
});
