import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EggSelectionPrelude } from "./EggSelectionPrelude";

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

describe("EggSelectionPrelude", () => {
  it("reveals the updated companion copy before continuing", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    try {
      render(
        <EggSelectionPrelude
          storyTone="epic_adventure"
          speciesName="Buttercat"
          onComplete={onComplete}
        />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_200);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_200);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_200);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });

      expect(
        screen.getByText("Your companion will make steady progress visible, one day at a time."),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Choose Your Companion" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Choose My Companion" }));

      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
