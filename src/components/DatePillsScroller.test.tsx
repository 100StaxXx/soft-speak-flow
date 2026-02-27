import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePillsScroller } from "@/components/DatePillsScroller";

const setScrollMetrics = (
  element: HTMLElement,
  {
    scrollLeft,
    clientWidth,
    scrollWidth,
  }: { scrollLeft: number; clientWidth: number; scrollWidth: number },
) => {
  Object.defineProperty(element, "scrollLeft", {
    configurable: true,
    writable: true,
    value: scrollLeft,
  });
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
  });
};

const setCenteringMetrics = (
  scroller: HTMLElement,
  selectedButton: HTMLElement,
  {
    scrollLeft,
    scrollWidth,
    containerWidth,
    selectedLeft,
    selectedWidth,
  }: {
    scrollLeft: number;
    scrollWidth: number;
    containerWidth: number;
    selectedLeft: number;
    selectedWidth: number;
  },
) => {
  Object.defineProperty(scroller, "scrollLeft", {
    configurable: true,
    writable: true,
    value: scrollLeft,
  });
  Object.defineProperty(scroller, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
  });
  Object.defineProperty(scroller, "offsetWidth", {
    configurable: true,
    value: containerWidth,
  });
  Object.defineProperty(selectedButton, "offsetLeft", {
    configurable: true,
    value: selectedLeft,
  });
  Object.defineProperty(selectedButton, "offsetWidth", {
    configurable: true,
    value: selectedWidth,
  });
};

describe("DatePillsScroller", () => {
  it("extends the range when scrolled near the right edge", async () => {
    const onDateSelect = vi.fn();

    const { container } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-13T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    expect(scroller).toBeTruthy();

    const initialCount = scroller.querySelectorAll("button").length;

    setScrollMetrics(scroller, { scrollLeft: 700, clientWidth: 320, scrollWidth: 1000 });
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(scroller.querySelectorAll("button").length).toBeGreaterThan(initialCount);
    });
  });

  it("extends the range when scrolled near the left edge", async () => {
    const onDateSelect = vi.fn();

    const { container } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-13T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    const initialCount = scroller.querySelectorAll("button").length;

    setScrollMetrics(scroller, { scrollLeft: 20, clientWidth: 320, scrollWidth: 1000 });
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(scroller.querySelectorAll("button").length).toBeGreaterThan(initialCount);
    });
  });

  it("keeps days selectable after extending the range", async () => {
    const onDateSelect = vi.fn();

    const { container } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-13T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    setScrollMetrics(scroller, { scrollLeft: 700, clientWidth: 320, scrollWidth: 1000 });
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(scroller.querySelectorAll("button").length).toBeGreaterThan(14);
    });

    const buttons = scroller.querySelectorAll("button");
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(onDateSelect).toHaveBeenCalledTimes(1);
    });
  });

  it("does not re-center when time changes within the same selected date", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = document.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const firstSelected = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, firstSelected, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 220,
        selectedLeft: 320,
        selectedWidth: 60,
      });

      await waitFor(() => {
        expect(scrollToSpy.mock.calls.length).toBeGreaterThan(0);
      });
      const baselineAfterInitialLayout = scrollToSpy.mock.calls.length;

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy.mock.calls.length).toBe(baselineAfterInitialLayout);
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("falls back to scrollLeft when scrollTo throws", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn(() => {
      throw new Error("scrollTo unavailable");
    });
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 200,
        selectedLeft: 320,
        selectedWidth: 60,
      });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
        expect(scroller.scrollLeft).toBe(250);
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("uses smooth scroll without forcing an immediate scrollLeft jump", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 200,
        selectedLeft: 320,
        selectedWidth: 60,
      });

      scrollToSpy.mockClear();
      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
      });

      const lastOptions = scrollToSpy.mock.calls.at(-1)?.[0] as {
        left?: number;
        behavior?: "smooth" | "auto";
      };
      expect(lastOptions.left).toBe(250);
      expect(lastOptions.behavior).toBe("smooth");
      expect(scroller.scrollLeft).toBe(0);
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("uses auto scroll behavior when reduced motion is enabled", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const originalMatchMedia = window.matchMedia;
    const matchMediaSpy = vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }));

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMediaSpy,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 200,
        selectedLeft: 320,
        selectedWidth: 60,
      });

      await act(async () => {
        await Promise.resolve();
      });

      scrollToSpy.mockClear();
      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
      });

      const lastOptions = scrollToSpy.mock.calls.at(-1)?.[0] as {
        behavior?: "smooth" | "auto";
      };
      expect(lastOptions.behavior).toBe("auto");
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("retries centering when layout width is zero and centers on next frame", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let nextRafId = 0;

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      nextRafId += 1;
      rafCallbacks.set(nextRafId, callback);
      return nextRafId;
    });
    window.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 0,
        selectedLeft: 340,
        selectedWidth: 0,
      });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      expect(scrollToSpy).toHaveBeenCalledTimes(0);
      expect(scroller.scrollLeft).toBe(0);
      expect(rafCallbacks.size).toBeGreaterThan(0);

      const selectedAfterRerender = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedAfterRerender, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 220,
        selectedLeft: 340,
        selectedWidth: 64,
      });

      await act(async () => {
        const callbacks = Array.from(rafCallbacks.values());
        rafCallbacks.clear();
        callbacks.forEach((callback) => callback(16));
      });

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
        const lastOptions = scrollToSpy.mock.calls.at(-1)?.[0] as { left?: number };
        expect(lastOptions.left).toBe(262);
      });
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("re-centers when the tab becomes active again without changing selected date", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const selectedDate = new Date("2026-02-13T12:00:00.000Z");
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          isActive={false}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1200,
        containerWidth: 220,
        selectedLeft: 360,
        selectedWidth: 60,
      });

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(0);
      });

      rerender(
        <DatePillsScroller
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          isActive
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("computes symmetric edge spacer widths from container and pill size", async () => {
    const onDateSelect = vi.fn();
    const { rerender, container } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-13T08:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
    setCenteringMetrics(scroller, selectedButton, {
      scrollLeft: 0,
      scrollWidth: 1000,
      containerWidth: 240,
      selectedLeft: 340,
      selectedWidth: 60,
    });

    rerender(
      <DatePillsScroller
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    await waitFor(() => {
      const startSpacer = container.querySelector("[data-testid='date-pill-edge-spacer-start']") as HTMLDivElement;
      const endSpacer = container.querySelector("[data-testid='date-pill-edge-spacer-end']") as HTMLDivElement;
      expect(startSpacer.style.width).toBe("90px");
      expect(endSpacer.style.width).toBe("90px");
    });
  });

  it("keeps edge-date selection centerable without permanent clamp", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 610,
        containerWidth: 220,
        selectedLeft: 380,
        selectedWidth: 60,
      });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalled();
        const lastOptions = scrollToSpy.mock.calls.at(-1)?.[0] as { left?: number };
        expect(lastOptions.left).toBe(300);
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("centers the selected date pill even when today is a different date", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-22T12:00:00.000Z"));
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-19T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button[data-date-key='2026-02-19']") as HTMLButtonElement;
      const todayButton = scroller.querySelector("button[data-date-key='2026-02-22']") as HTMLButtonElement;
      expect(selectedButton).toBeTruthy();
      expect(todayButton).toBeTruthy();

      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1400,
        containerWidth: 220,
        selectedLeft: 520,
        selectedWidth: 60,
      });
      Object.defineProperty(todayButton, "offsetLeft", {
        configurable: true,
        value: 140,
      });
      Object.defineProperty(todayButton, "offsetWidth", {
        configurable: true,
        value: 60,
      });

      scrollToSpy.mockClear();
      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-19T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
      const lastOptions = scrollToSpy.mock.calls.at(-1)?.[0] as { left?: number };
      expect(lastOptions.left).toBe(440);
      expect(lastOptions.left).not.toBe(60);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("ignores programmatic scroll events so recentering does not loop", async () => {
    const onDateSelect = vi.fn();
    const scrollToSpy = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;

    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });

    try {
      const { rerender, container } = render(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T08:00:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
      const selectedButton = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      const nextDayButton = scroller.querySelector("button[data-date-key='2026-02-14']") as HTMLButtonElement;
      setCenteringMetrics(scroller, selectedButton, {
        scrollLeft: 0,
        scrollWidth: 1200,
        containerWidth: 220,
        selectedLeft: 360,
        selectedWidth: 60,
      });
      Object.defineProperty(nextDayButton, "offsetLeft", {
        configurable: true,
        value: 430,
      });
      Object.defineProperty(nextDayButton, "offsetWidth", {
        configurable: true,
        value: 60,
      });
      setScrollMetrics(scroller, { scrollLeft: 0, clientWidth: 220, scrollWidth: 1200 });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-14T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      const baselineCalls = scrollToSpy.mock.calls.length;
      expect(baselineCalls).toBeGreaterThan(0);

      fireEvent.scroll(scroller);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      const afterInitialWindowCalls = scrollToSpy.mock.calls.length;
      expect(afterInitialWindowCalls).toBeGreaterThanOrEqual(baselineCalls);

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(scrollToSpy).toHaveBeenCalledTimes(afterInitialWindowCalls);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });
});
