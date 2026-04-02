import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CompanionMotionProvider,
  useCompanionMotion,
} from "./CompanionMotionContext";

const MotionProbe = () => {
  const { activeEvent, triggerEvent } = useCompanionMotion();

  return (
    <div>
      <button
        onClick={() => {
          triggerEvent({
            type: "xp_gain",
            intensity: "medium",
            durationMs: 100,
            reason: "Probe XP",
          });
        }}
      >
        Trigger
      </button>
      <div data-testid="active-type">{activeEvent?.type ?? "none"}</div>
    </div>
  );
};

describe("CompanionMotionContext", () => {
  it("publishes and clears transient motion events", () => {
    vi.useFakeTimers();

    render(
      <CompanionMotionProvider>
        <MotionProbe />
      </CompanionMotionProvider>,
    );

    expect(screen.getByTestId("active-type")).toHaveTextContent("none");

    act(() => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });

    expect(screen.getByTestId("active-type")).toHaveTextContent("xp_gain");

    act(() => {
      vi.advanceTimersByTime(101);
    });

    expect(screen.getByTestId("active-type")).toHaveTextContent("none");

    vi.useRealTimers();
  });
});
