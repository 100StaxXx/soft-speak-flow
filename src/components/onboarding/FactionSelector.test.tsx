import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) =>
          React.createElement(tag, props, children);
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
  };
});

import { FactionSelector } from "./FactionSelector";

const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");
const originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");

const setNavigatorValues = (userAgent: string, maxTouchPoints: number) => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });

  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
};

const renderExpandedVoidFaction = () => {
  render(<FactionSelector onComplete={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /Void Collective/i }));

  const joinButton = screen.getByRole("button", { name: /Join Void Collective/i });
  const ctaWrapper = joinButton.parentElement;
  expect(ctaWrapper).not.toBeNull();

  return ctaWrapper as HTMLDivElement;
};

describe("FactionSelector CTA spacing", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.getPlatform.mockReturnValue("web");
  });

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(navigator, "userAgent", originalUserAgentDescriptor);
    } else {
      delete (navigator as Navigator & { userAgent?: string }).userAgent;
    }

    if (originalMaxTouchPointsDescriptor) {
      Object.defineProperty(navigator, "maxTouchPoints", originalMaxTouchPointsDescriptor);
    } else {
      delete (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints;
    }
  });

  it("adds extra CTA bottom spacing for Mac-hosted iOS", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 0);

    const ctaWrapper = renderExpandedVoidFaction();

    expect(ctaWrapper.className).toContain("pt-2");
    expect(ctaWrapper.className).toContain("pb-6");
  });

  it("leaves handheld iOS CTA spacing unchanged", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    setNavigatorValues("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", 5);

    const ctaWrapper = renderExpandedVoidFaction();

    expect(ctaWrapper.className).toContain("pt-2");
    expect(ctaWrapper.className).not.toContain("pb-6");
  });

  it("leaves web CTA spacing unchanged", () => {
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 0);

    const ctaWrapper = renderExpandedVoidFaction();

    expect(ctaWrapper.className).toContain("pt-2");
    expect(ctaWrapper.className).not.toContain("pb-6");
  });
});
