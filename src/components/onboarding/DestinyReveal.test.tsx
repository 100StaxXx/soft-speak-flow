import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DestinyReveal } from "./DestinyReveal";

const LINE_DISPLAY_MS = 2800;
const NARRATIVE_LINE_COUNT = 4;
const FINAL_MESSAGE_DELAY_MS = 900;
const FINAL_BUTTON_DELAY_MS = 1800;

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          ...props
        }: any) => React.createElement(tag, props, children);
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: any }) => <>{children}</>,
  };
});

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: "enhanced" as const,
    capabilities: {
      allowParallax: true,
      maxParticles: 24,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web" as const,
    },
    signals: {
      prefersReducedMotion: false,
      isLowPowerMode: false,
      isBackgrounded: false,
    },
  }),
}));

describe("DestinyReveal", () => {
  it("progresses through lines, then waits for final message and button delays", async () => {
    vi.useFakeTimers();
    try {
      render(<DestinyReveal userName="Nova" onComplete={vi.fn()} />);

      for (let i = 0; i < NARRATIVE_LINE_COUNT; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(LINE_DISPLAY_MS);
        });
      }

      expect(
        screen.getByText("The universe has been waiting for your first step."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Your Path Awakens")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FINAL_MESSAGE_DELAY_MS - 1);
      });

      expect(screen.queryByText("Your Path Awakens")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByText("Your Path Awakens")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Choose My Faction" })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FINAL_BUTTON_DELAY_MS - 1);
      });

      expect(screen.queryByRole("button", { name: "Choose My Faction" })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByRole("button", { name: "Choose My Faction" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
