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

  it("re-centers the selected day when time changes within the same date", async () => {
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
        expect(scrollToSpy).toHaveBeenCalledTimes(0);
      });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
      });

      const secondSelected = scroller.querySelector("button.bg-gradient-to-br") as HTMLButtonElement;
      setCenteringMetrics(scroller, secondSelected, {
        scrollLeft: 0,
        scrollWidth: 1000,
        containerWidth: 220,
        selectedLeft: 360,
        selectedWidth: 60,
      });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T22:30:00.000Z")}
          onDateSelect={onDateSelect}
        />,
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(2);
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
        expect(scroller.scrollLeft).toBe(262);
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
        expect(scroller.scrollLeft).toBe(300);
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });
});
