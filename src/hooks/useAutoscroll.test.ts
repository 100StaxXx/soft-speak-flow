import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import { useAutoscroll } from "./useAutoscroll";

const frameCallbacks = new Map<number, FrameRequestCallback>();
let frameId = 1;

const flushAnimationFrame = () => {
  const pending = Array.from(frameCallbacks.entries());
  frameCallbacks.clear();
  for (const [, callback] of pending) {
    callback(0);
  }
};

describe("useAutoscroll", () => {
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    frameCallbacks.clear();
    frameId = 1;

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = frameId++;
      frameCallbacks.set(id, callback);
      return id;
    });

    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frameCallbacks.delete(id);
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });

    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2400,
    });

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });

    Object.defineProperty(window, "scrollX", {
      configurable: true,
      writable: true,
      value: 0,
    });

    window.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === "number") {
        (window as Window & { scrollY: number }).scrollY = y ?? (window as Window & { scrollY: number }).scrollY;
        return;
      }

      if (options && typeof options.top === "number") {
        (window as Window & { scrollY: number }).scrollY = options.top;
      }
    }) as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    frameCallbacks.clear();
    vi.unstubAllGlobals();
    window.scrollTo = originalScrollTo;
  });

  it("scrolls the nearest scrollable ancestor when available", () => {
    const scrollParent = document.createElement("div");
    scrollParent.style.overflowY = "auto";
    Object.defineProperty(scrollParent, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scrollParent, "scrollHeight", { configurable: true, value: 900 });
    Object.defineProperty(scrollParent, "scrollTop", { configurable: true, writable: true, value: 0 });
    scrollParent.getBoundingClientRect = () => ({
      top: 100,
      bottom: 400,
      left: 0,
      right: 320,
      width: 320,
      height: 300,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    }) as DOMRect;

    const container = document.createElement("div");
    scrollParent.appendChild(container);
    document.body.appendChild(scrollParent);

    const containerRef = { current: container } as RefObject<HTMLElement>;
    const { result } = renderHook(() => useAutoscroll({ containerRef, enabled: true }));

    act(() => {
      result.current.updatePosition(395);
      flushAnimationFrame();
    });

    expect(scrollParent.scrollTop).toBeGreaterThan(0);
    expect(window.scrollTo).not.toHaveBeenCalled();

    result.current.stopScroll();
    document.body.removeChild(scrollParent);
  });

  it("falls back to window scrolling when no scrollable ancestor exists", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const containerRef = { current: container } as RefObject<HTMLElement>;
    const { result } = renderHook(() => useAutoscroll({ containerRef, enabled: true }));

    act(() => {
      result.current.updatePosition(790);
      flushAnimationFrame();
    });

    expect(window.scrollTo).toHaveBeenCalled();
    expect(window.scrollY).toBeGreaterThan(0);

    result.current.stopScroll();
    document.body.removeChild(container);
  });

  it("ramps speed near edges and stops when pointer leaves edge zone", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const containerRef = { current: container } as RefObject<HTMLElement>;
    const { result } = renderHook(() =>
      useAutoscroll({
        containerRef,
        enabled: true,
        edgeThreshold: 80,
        scrollSpeed: 8,
      }),
    );

    act(() => {
      result.current.updatePosition(760); // 40px from edge
      flushAnimationFrame();
    });
    const mediumEdgeDelta = window.scrollY;

    act(() => {
      result.current.stopScroll();
      window.scrollY = 0;
      result.current.updatePosition(799); // 1px from edge
      flushAnimationFrame();
    });
    const nearEdgeDelta = window.scrollY;

    expect(nearEdgeDelta).toBeGreaterThan(mediumEdgeDelta);

    act(() => {
      result.current.updatePosition(400); // center of viewport
    });

    const queuedAfterCenter = frameCallbacks.size;
    expect(queuedAfterCenter).toBe(0);

    result.current.stopScroll();
    document.body.removeChild(container);
  });
});
