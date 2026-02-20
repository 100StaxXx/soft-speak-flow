import { render } from "@testing-library/react";
import { act, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeProvider, useTime } from "@/contexts/TimeContext";

const HueProbe = ({ onHue }: { onHue: (value: number) => void }) => {
  const { rotationHue } = useTime();

  useEffect(() => {
    onHue(rotationHue);
  }, [onHue, rotationHue]);

  return null;
};

describe("TimeContext", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates rotation hue on minute cadence and removes sub-minute interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T10:15:00.000Z"));

    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const observedHues: number[] = [];

    render(
      <TimeProvider>
        <HueProbe onHue={(value) => observedHues.push(value)} />
      </TimeProvider>,
    );

    expect(setIntervalSpy.mock.calls.some(([, delay]) => delay === 500)).toBe(false);
    expect(setIntervalSpy.mock.calls.some(([, delay]) => delay === 60000)).toBe(true);

    const initialHue = observedHues[observedHues.length - 1];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(observedHues[observedHues.length - 1]).toBe(initialHue);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(observedHues[observedHues.length - 1]).not.toBe(initialHue);
  });
});
