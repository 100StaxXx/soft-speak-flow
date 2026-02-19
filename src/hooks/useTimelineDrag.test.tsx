import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineDrag } from "./useTimelineDrag";
import { SHARED_TIMELINE_DRAG_PROFILE } from "@/components/calendar/dragSnap";

const mocks = vi.hoisted(() => ({
  updatePositionMock: vi.fn(),
  stopScrollMock: vi.fn(),
  hapticImpactMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useAutoscroll", () => ({
  useAutoscroll: () => ({
    updatePosition: mocks.updatePositionMock,
    stopScroll: mocks.stopScrollMock,
  }),
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: mocks.hapticImpactMock,
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
  },
}));

const createPointerDownEvent = (
  clientY: number,
  target?: Element,
  pointerType: "mouse" | "touch" | "pen" = "mouse",
) => {
  let defaultPrevented = false;
  const preventDefault = vi.fn(() => {
    defaultPrevented = true;
  });

  return {
    pointerType,
    button: 0,
    clientY,
    target: target ?? document.createElement("div"),
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault,
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent<HTMLElement>;
};

const createTouchEvent = (
  y: number,
  target?: Element,
) => {
  let defaultPrevented = false;
  const preventDefault = vi.fn(() => {
    defaultPrevented = true;
  });

  return {
    touches: [{ clientX: 0, clientY: y }],
    changedTouches: [{ clientX: 0, clientY: y }],
    target: target ?? document.createElement("div"),
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault,
    stopPropagation: vi.fn(),
  } as unknown as React.TouchEvent<HTMLElement>;
};

const dispatchPointerMove = (clientY: number) => {
  const event = new Event("pointermove") as PointerEvent;
  Object.defineProperty(event, "clientY", { value: clientY });
  window.dispatchEvent(event);
};

const dispatchPointerUp = () => {
  window.dispatchEvent(new Event("pointerup"));
};

const dispatchScroll = () => {
  window.dispatchEvent(new Event("scroll"));
};

const dispatchTouchMove = (clientY: number) => {
  const event = new Event("touchmove", { cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "touches", { value: [{ clientY }] });
  window.dispatchEvent(event);
};

const dispatchTouchEnd = () => {
  window.dispatchEvent(new Event("touchend"));
};

describe("useTimelineDrag", () => {
  const containerRef = { current: document.createElement("div") } as React.RefObject<HTMLElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 720,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 720 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("activates drag after crossing threshold, previews in 5-minute increments, and uses drop-only haptics", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-1", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
    });

    expect(result.current.draggingTaskId).toBeNull();
    expect(result.current.previewTime).toBeNull();

    act(() => {
      dispatchPointerMove(120);
    });
    expect(result.current.draggingTaskId).toBe("task-1");
    expect(result.current.previewTime).toBe("09:20");
    expect(result.current.snapMode).toBe("coarse");
    expect(result.current.zoomRail).toBeNull();
    expect(mocks.hapticImpactMock).not.toHaveBeenCalled();

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-1", "09:20");
    expect(result.current.draggingTaskId).toBeNull();
    expect(result.current.dragOffsetY.get()).toBe(0);
    expect(result.current.zoomRail).toBeNull();
    expect(mocks.hapticImpactMock).toHaveBeenCalledTimes(1);
    expect(mocks.hapticImpactMock).toHaveBeenCalledWith({ style: "MEDIUM" });
  });

  it("maps a full-screen drag to multi-hour movement", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({
      containerRef,
      onDrop,
      snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
    }));

    const handleProps = result.current.getDragHandleProps("task-long", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(820);
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-long", "21:00");
  });

  it("starts drag from row-level drag props", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const rowProps = result.current.getRowDragProps("task-row", "09:00");
    act(() => {
      rowProps.onPointerDown(createPointerDownEvent(120));
      dispatchPointerMove(140);
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-row", "09:20");
  });

  it("does not double-start when capture and bubble handlers receive the same start event", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const rowProps = result.current.getRowDragProps("task-capture-bubble", "09:00");
    const pointerEvent = createPointerDownEvent(120);
    act(() => {
      rowProps.onPointerDownCapture?.(pointerEvent);
      rowProps.onPointerDown(pointerEvent);
      dispatchPointerMove(140);
      dispatchPointerUp();
    });

    expect(pointerEvent.preventDefault).toHaveBeenCalledTimes(0);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith("task-capture-bubble", "09:20");
  });

  it("starts drag from touch pointerdown events", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const rowProps = result.current.getRowDragProps("task-touch-pointer", "09:00");
    act(() => {
      rowProps.onPointerDown(createPointerDownEvent(120, undefined, "touch"));
      dispatchPointerMove(140);
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-touch-pointer", "09:20");
  });

  it("keeps coarse mode even when precision settings are provided", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: {
          precisionHoldMs: 0,
          precisionActivationWindowPx: 120,
        },
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-1", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(100);
    });

    expect(result.current.snapMode).toBe("coarse");
    expect(result.current.zoomRail).toBeNull();

    act(() => {
      dispatchPointerMove(130);
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-1", "09:15");
  });

  it("keeps coarse mode during continuous movement", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: {
          precisionHoldMs: 120,
          precisionActivationWindowPx: 72,
          precisionHoldMovementPx: 12,
        },
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-1", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(130);
      dispatchPointerMove(160);
      dispatchPointerMove(190);
    });

    expect(result.current.snapMode).toBe("coarse");

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-1", "09:45");
  });

  it("ignores pointer/touch starts from interactive descendants", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop }));

    const interactiveEl = document.createElement("button");
    interactiveEl.setAttribute("data-interactive", "true");
    const child = document.createElement("span");
    interactiveEl.appendChild(child);

    const handleProps = result.current.getRowDragProps("task-1", "09:00");

    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100, child));
    });
    expect(result.current.draggingTaskId).toBeNull();

    act(() => {
      handleProps.onTouchStart(createTouchEvent(100, child));
    });
    expect(result.current.draggingTaskId).toBeNull();
  });

  it("skips onDrop when the dragged time is unchanged", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop }));

    const handleProps = result.current.getDragHandleProps("task-1", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerUp();
    });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("does not activate drag on pointer down without movement", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop }));

    const handleProps = result.current.getDragHandleProps("task-no-move", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerUp();
    });

    expect(result.current.draggingTaskId).toBeNull();
    expect(result.current.previewTime).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("does not activate drag when movement stays below threshold", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop }));

    const handleProps = result.current.getDragHandleProps("task-below-threshold", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(107);
      dispatchPointerUp();
    });

    expect(result.current.draggingTaskId).toBeNull();
    expect(result.current.previewTime).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("activates drag on touch after threshold and supports quick touch drag/drop", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-1", "09:00");

    act(() => {
      handleProps.onTouchStart(createTouchEvent(100));
    });
    expect(result.current.draggingTaskId).toBeNull();

    act(() => {
      dispatchTouchMove(120);
    });
    expect(result.current.draggingTaskId).toBe("task-1");

    act(() => {
      dispatchTouchEnd();
    });
    expect(onDrop).toHaveBeenCalledWith("task-1", "09:20");
  });

  it("advances preview time while scrolling at the edge without extra pointer movement", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop }));

    const handleProps = result.current.getDragHandleProps("task-scroll", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(790));
      dispatchPointerMove(810);
    });

    expect(result.current.previewTime).toBe("09:10");

    act(() => {
      (window as Window & { scrollY: number }).scrollY = 120;
      dispatchScroll();
    });

    expect(result.current.previewTime).toBe("10:10");

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-scroll", "10:10");
  });

  it("advances preview time while constrained pane scrolls under a held pointer", () => {
    const onDrop = vi.fn();
    const scrollPane = document.createElement("div");
    scrollPane.style.overflowY = "auto";
    Object.defineProperty(scrollPane, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scrollPane, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(scrollPane, "scrollTop", { configurable: true, writable: true, value: 0 });
    scrollPane.getBoundingClientRect = () => ({
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
    scrollPane.appendChild(container);
    document.body.appendChild(scrollPane);

    const localContainerRef = { current: container } as React.RefObject<HTMLElement>;
    const { result } = renderHook(() => useTimelineDrag({ containerRef: localContainerRef, onDrop }));

    const handleProps = result.current.getDragHandleProps("task-pane-scroll", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(395));
      dispatchPointerMove(415);
    });

    expect(result.current.previewTime).toBe("09:10");

    act(() => {
      scrollPane.scrollTop = 120;
      scrollPane.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.previewTime).toBe("10:10");

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-pane-scroll", "10:10");
    document.body.removeChild(scrollPane);
  });

  it("clamps time range to 00:00 through 23:59", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop }));

    const upperClamp = result.current.getDragHandleProps("task-upper", "23:59");
    act(() => {
      upperClamp.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(400);
    });
    expect(result.current.previewTime).toBe("23:59");
    expect(result.current.dragOffsetY.get()).toBe(0);
    expect(result.current.dragVisualOffsetY.get()).toBe(0);
    expect(result.current.dragEdgeOffsetY.get()).toBe(0);
    act(() => {
      dispatchPointerUp();
    });
    expect(onDrop).not.toHaveBeenCalledWith("task-upper", expect.any(String));

    const lowerClamp = result.current.getDragHandleProps("task-lower", "00:00");
    act(() => {
      lowerClamp.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(-300);
    });
    expect(result.current.previewTime).toBe("00:00");
    expect(result.current.dragOffsetY.get()).toBe(0);
    expect(result.current.dragVisualOffsetY.get()).toBe(0);
    expect(result.current.dragEdgeOffsetY.get()).toBe(0);
    act(() => {
      dispatchPointerUp();
    });
    expect(onDrop).not.toHaveBeenCalledWith("task-lower", expect.any(String));
  });

  it("nudges preview and drop time forward by one fine step while dragging", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
        activationThresholdPx: 0,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-nudge-forward", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(100);
    });

    let nudged = false;
    act(() => {
      nudged = result.current.nudgeByFineStep(1);
    });

    expect(nudged).toBe(true);
    expect(result.current.previewTime).toBe("09:05");

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-nudge-forward", "09:05");
  });

  it("keeps nudged preview time when pointermove repeats at the same clientY", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-nudge-stable", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(130);
    });
    expect(result.current.previewTime).toBe("09:30");

    act(() => {
      result.current.nudgeByFineStep(1);
    });
    expect(result.current.previewTime).toBe("09:35");

    act(() => {
      dispatchPointerMove(130);
    });
    expect(result.current.previewTime).toBe("09:35");

    act(() => {
      dispatchPointerUp();
    });
    expect(onDrop).toHaveBeenCalledWith("task-nudge-stable", "09:35");
  });

  it("nudges preview and drop time backward by one fine step while dragging", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
        activationThresholdPx: 0,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-nudge-backward", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(100);
    });

    let nudged = false;
    act(() => {
      nudged = result.current.nudgeByFineStep(-1);
    });

    expect(nudged).toBe(true);
    expect(result.current.previewTime).toBe("08:55");

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-nudge-backward", "08:55");
  });

  it("blends nudged preview back toward pointer time on opposite-direction pointer movement", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-nudge-blend", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(130);
      result.current.nudgeByFineStep(1);
      result.current.nudgeByFineStep(1);
    });
    expect(result.current.previewTime).toBe("09:40");

    act(() => {
      dispatchPointerMove(120);
    });
    expect(result.current.previewTime).toBe("09:25");

    act(() => {
      dispatchPointerUp();
    });
    expect(onDrop).toHaveBeenCalledWith("task-nudge-blend", "09:25");
  });

  it("returns false when nudging beyond either boundary", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTimelineDrag({ containerRef, onDrop, activationThresholdPx: 0 }));

    const upperClamp = result.current.getDragHandleProps("task-nudge-upper", "23:59");
    act(() => {
      upperClamp.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(100);
    });

    let nudged = true;
    act(() => {
      nudged = result.current.nudgeByFineStep(1);
    });

    expect(nudged).toBe(false);
    expect(result.current.previewTime).toBe("23:59");
    expect(result.current.dragOffsetY.get()).toBe(0);

    act(() => {
      dispatchPointerUp();
    });

    const lowerClamp = result.current.getDragHandleProps("task-nudge-lower", "00:00");
    act(() => {
      lowerClamp.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(100);
    });

    act(() => {
      nudged = result.current.nudgeByFineStep(-1);
    });

    expect(nudged).toBe(false);
    expect(result.current.previewTime).toBe("00:00");
    expect(result.current.dragOffsetY.get()).toBe(0);

    act(() => {
      dispatchPointerUp();
    });
  });

  it("updates drag offsets when nudging changes the minute", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
        activationThresholdPx: 0,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-nudge-offset", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(100);
      result.current.nudgeByFineStep(1);
    });

    expect(result.current.dragOffsetY.get()).not.toBe(0);
    expect(result.current.dragVisualOffsetY.get()).toBe(result.current.dragOffsetY.get());

    act(() => {
      dispatchPointerUp();
    });
  });

  it("does not update pointer-anchored edge offset when nudging without additional pointer movement", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useTimelineDrag({
        containerRef,
        onDrop,
        snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
      }),
    );

    const handleProps = result.current.getDragHandleProps("task-edge-stable", "09:00");
    act(() => {
      handleProps.onPointerDown(createPointerDownEvent(100));
      dispatchPointerMove(130);
    });

    const edgeOffsetBeforeNudge = result.current.dragEdgeOffsetY.get();
    const dragOffsetBeforeNudge = result.current.dragOffsetY.get();
    act(() => {
      result.current.nudgeByFineStep(1);
    });

    expect(result.current.dragOffsetY.get()).not.toBe(dragOffsetBeforeNudge);
    expect(result.current.dragVisualOffsetY.get()).toBe(result.current.dragOffsetY.get());
    expect(result.current.dragEdgeOffsetY.get()).toBe(edgeOffsetBeforeNudge);

    act(() => {
      dispatchPointerUp();
    });
  });
});
