import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanionCreationLoader } from "./CompanionCreationLoader";

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
  };
});

describe("CompanionCreationLoader", () => {
  it("uses near-old fast checkpoints at 30s, 60s, and 90s", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T00:00:00.000Z"));
    try {
      render(<CompanionCreationLoader />);

      expect(screen.getByText("5%")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText("50%")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText("75%")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText("88%")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps progress monotonic over elapsed time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T00:00:00.000Z"));
    try {
      render(<CompanionCreationLoader />);

      const checkpoints = [10_000, 10_000, 10_000, 15_000, 15_000, 30_000, 30_000];
      const values: number[] = [];

      for (const step of checkpoints) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(step);
        });

        const text = screen.getByText(/^\d+%$/).textContent ?? "0%";
        values.push(Number.parseInt(text.replace("%", ""), 10));
      }

      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]).toBeGreaterThanOrEqual(values[index - 1]);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps visual progress at 99%", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T00:00:00.000Z"));
    try {
      render(<CompanionCreationLoader />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000_000);
      });

      expect(screen.getByText("99%")).toBeInTheDocument();
      expect(screen.queryByText("100%")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows longer-wait messaging at 90 seconds based on elapsed time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T00:00:00.000Z"));
    try {
      render(<CompanionCreationLoader />);

      expect(screen.queryByText(/Taking longer than expected/i)).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(89_000);
      });
      expect(screen.queryByText(/Taking longer than expected/i)).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(screen.getByText("88%")).toBeInTheDocument();
      expect(screen.getByText(/Taking longer than expected/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
