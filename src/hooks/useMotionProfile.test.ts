import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MotionProfileProvider } from "@/contexts/MotionProfileContext";
import { useMotionProfile } from "@/hooks/useMotionProfile";

const Probe = () => {
  const { profile, capabilities } = useMotionProfile();

  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "profile" }, profile),
    React.createElement("span", { "data-testid": "max-particles" }, String(capabilities.maxParticles)),
    React.createElement(
      "span",
      { "data-testid": "bg-animation" },
      capabilities.allowBackgroundAnimation ? "yes" : "no",
    ),
  );
};

const originalHardwareConcurrency = Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency");
const originalDeviceMemory = Object.getOwnPropertyDescriptor(
  navigator as Navigator & { deviceMemory?: number },
  "deviceMemory",
);

const setNavigatorCapabilities = (hardwareConcurrency: number, deviceMemory: number) => {
  Object.defineProperty(navigator, "hardwareConcurrency", {
    configurable: true,
    value: hardwareConcurrency,
  });
  Object.defineProperty(navigator as Navigator & { deviceMemory?: number }, "deviceMemory", {
    configurable: true,
    value: deviceMemory,
  });
};

const restoreNavigatorCapabilities = () => {
  if (originalHardwareConcurrency) {
    Object.defineProperty(navigator, "hardwareConcurrency", originalHardwareConcurrency);
  }
  if (originalDeviceMemory) {
    Object.defineProperty(
      navigator as Navigator & { deviceMemory?: number },
      "deviceMemory",
      originalDeviceMemory,
    );
  } else {
    delete (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  }
};

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

describe("useMotionProfile", () => {
  beforeEach(() => {
    setReducedMotion(false);
    restoreNavigatorCapabilities();
  });

  afterEach(() => {
    restoreNavigatorCapabilities();
  });

  it("selects reduced profile when prefers-reduced-motion is enabled", async () => {
    setReducedMotion(true);
    setNavigatorCapabilities(8, 8);

    render(
      React.createElement(MotionProfileProvider, null, React.createElement(Probe)),
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile")).toHaveTextContent("reduced");
    });
    expect(screen.getByTestId("max-particles")).toHaveTextContent("0");
    expect(screen.getByTestId("bg-animation")).toHaveTextContent("no");
  });

  it("selects reduced profile for low-capability environments", async () => {
    setReducedMotion(false);
    setNavigatorCapabilities(2, 2);

    render(
      React.createElement(MotionProfileProvider, null, React.createElement(Probe)),
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile")).toHaveTextContent("reduced");
    });
    expect(screen.getByTestId("max-particles")).toHaveTextContent("0");
  });

  it("selects enhanced profile for high-capability environments", async () => {
    setReducedMotion(false);
    setNavigatorCapabilities(8, 8);

    render(
      React.createElement(MotionProfileProvider, null, React.createElement(Probe)),
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile")).toHaveTextContent("enhanced");
    });
    expect(Number(screen.getByTestId("max-particles").textContent)).toBeGreaterThan(40);
    expect(screen.getByTestId("bg-animation")).toHaveTextContent("yes");
  });
});
