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
  it("uses conservative progress checkpoints at 30s, 60s, and 90s", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T00:00:00.000Z"));
    try {
      render(<CompanionCreationLoader />);

      expect(screen.getByText("3%")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText("32%")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText("50%")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText("64%")).toBeInTheDocument();
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

      expect(screen.getByText("64%")).toBeInTheDocument();
      expect(screen.getByText(/Taking longer than expected/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
