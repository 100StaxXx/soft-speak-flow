import { fireEvent, render, waitFor } from "@testing-library/react";
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

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledTimes(1);
      });

      rerender(
        <DatePillsScroller
          selectedDate={new Date("2026-02-13T20:30:00.000Z")}
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
});
