import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneyBegins } from "./JourneyBegins";

const LINE_DISPLAY_MS = 1300;
const NARRATIVE_LINE_COUNT = 5;
const FINAL_LINE_HOLD_MS = 1000;
const FINAL_LINE_TEXT = "...will shape both your destinies.";

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
    useReducedMotion: () => false,
  };
});

describe("JourneyBegins", () => {
  it("holds the final narrative line for the full delay before showing the final message", async () => {
    vi.useFakeTimers();
    try {
      render(
        <JourneyBegins
          userName="Nova"
          companionAnimal="Kitsune"
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
      expect(screen.getByRole("heading", { name: "Nova" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Nova & Kitsune" })).not.toBeInTheDocument();
      expect(
        screen.getByText(/Kitsune is already part of your story now\. For a little while longer, they rest inside the shell and wait for the bond that will awaken their form\./i),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
