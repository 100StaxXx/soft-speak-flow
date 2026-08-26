import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneyBegins } from "./JourneyBegins";

const LINE_DISPLAY_MS = 3000;
const NARRATIVE_LINE_COUNT = 5;
const FINAL_LINE_HOLD_MS = 3200;
const FINAL_BUTTON_DELAY_MS = 900;
const FIRST_LINE_TEXT = "Your daily path is ready...";
const SECOND_LINE_TEXT = "Your Guide helps you listen and choose a direction.";
const FINAL_LINE_TEXT = "In the evening, your Guide helps you return to the same day with grace.";

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
  it("paces narrative lines before showing the final message and button", async () => {
    vi.useFakeTimers();
    try {
      render(
        <JourneyBegins
          userName="Nova"
          companionAnimal="Kitsune"
          onComplete={vi.fn()}
        />,
      );

      expect(screen.getByText(FIRST_LINE_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(SECOND_LINE_TEXT)).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(LINE_DISPLAY_MS - 1);
      });

      expect(screen.getByText(FIRST_LINE_TEXT)).toBeInTheDocument();
      expect(screen.queryByText(SECOND_LINE_TEXT)).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByText(SECOND_LINE_TEXT)).toBeInTheDocument();

      for (let i = 1; i < NARRATIVE_LINE_COUNT - 1; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(LINE_DISPLAY_MS);
        });
      }

      expect(screen.getByText(FINAL_LINE_TEXT)).toBeInTheDocument();
      expect(screen.queryByText("Your Daily Path Is Ready")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FINAL_LINE_HOLD_MS - 1);
      });

      expect(screen.queryByText("Your Daily Path Is Ready")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByText("Your Daily Path Is Ready")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Nova" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Nova & Kitsune" })).not.toBeInTheDocument();
      expect(
        screen.getByText(/visual companion for the practices you complete/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /See Today/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FINAL_BUTTON_DELAY_MS);
      });

      expect(screen.getByRole("button", { name: /See Today/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
