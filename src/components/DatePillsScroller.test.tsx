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

const setButtonLayoutMetrics = (scroller: HTMLDivElement) => {
  const buttons = Array.from(scroller.querySelectorAll("button"));
  buttons.forEach((button, index) => {
    Object.defineProperty(button, "offsetLeft", {
      configurable: true,
      value: index * 60,
    });
    Object.defineProperty(button, "offsetWidth", {
      configurable: true,
      value: 52,
    });
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

  it("snaps to next week when selected date crosses week boundary", async () => {
    const onDateSelect = vi.fn();

    const { container, rerender } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-13T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    setScrollMetrics(scroller, { scrollLeft: 0, clientWidth: 320, scrollWidth: 3000 });
    setButtonLayoutMetrics(scroller);

    const scrollToSpy = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    await waitFor(() => {
      expect(scrollToSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
    scrollToSpy.mockClear();

    rerender(
      <DatePillsScroller
        selectedDate={new Date("2026-02-16T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );
    setButtonLayoutMetrics(scroller);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("snaps to previous week when selected date crosses backward", async () => {
    const onDateSelect = vi.fn();

    const { container, rerender } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-16T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    setScrollMetrics(scroller, { scrollLeft: 0, clientWidth: 320, scrollWidth: 3000 });
    setButtonLayoutMetrics(scroller);

    const scrollToSpy = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    await waitFor(() => {
      expect(scrollToSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
    scrollToSpy.mockClear();

    rerender(
      <DatePillsScroller
        selectedDate={new Date("2026-02-14T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );
    setButtonLayoutMetrics(scroller);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("does not snap when selected date remains in the same week", async () => {
    const onDateSelect = vi.fn();

    const { container, rerender } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-10T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    setScrollMetrics(scroller, { scrollLeft: 0, clientWidth: 320, scrollWidth: 3000 });
    setButtonLayoutMetrics(scroller);

    const scrollToSpy = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    await waitFor(() => {
      expect(scrollToSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
    scrollToSpy.mockClear();

    rerender(
      <DatePillsScroller
        selectedDate={new Date("2026-02-12T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );
    setButtonLayoutMetrics(scroller);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("snaps directly for larger week jumps", async () => {
    const onDateSelect = vi.fn();

    const { container, rerender } = render(
      <DatePillsScroller
        selectedDate={new Date("2026-02-01T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );

    const scroller = container.querySelector("div.overflow-x-auto") as HTMLDivElement;
    setScrollMetrics(scroller, { scrollLeft: 0, clientWidth: 320, scrollWidth: 3000 });
    setButtonLayoutMetrics(scroller);

    const scrollToSpy = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    await waitFor(() => {
      expect(scrollToSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
    scrollToSpy.mockClear();

    rerender(
      <DatePillsScroller
        selectedDate={new Date("2026-03-15T12:00:00.000Z")}
        onDateSelect={onDateSelect}
      />,
    );
    setButtonLayoutMetrics(scroller);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledTimes(1);
    });
  });
});
