import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneyBegins } from "./JourneyBegins";

const LINE_DISPLAY_MS = 3000;
const NARRATIVE_LINE_COUNT = 5;
const FINAL_LINE_HOLD_MS = 2600;
const FINAL_LINE_TEXT = "Step by step, your destinies braid into one radiant path.";

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

describe("JourneyBegins", () => {
  it("holds the final narrative line for the full delay before showing the final message", async () => {
    vi.useFakeTimers();
    try {
      render(
        <JourneyBegins
          userName="Nova"
          companionAnimal="Fox"
          onComplete={vi.fn()}
        />,
      );

      for (let i = 0; i < NARRATIVE_LINE_COUNT; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(LINE_DISPLAY_MS);
        });
      }

      expect(screen.getByText(FINAL_LINE_TEXT)).toBeInTheDocument();
      expect(screen.queryByText("Your Journey Awaits")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FINAL_LINE_HOLD_MS - 1);
      });

      expect(screen.queryByText("Your Journey Awaits")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByText("Your Journey Awaits")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
