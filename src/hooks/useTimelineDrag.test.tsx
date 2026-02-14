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
) =>
  ({
    pointerType,
    button: 0,
    clientY,
    target: target ?? document.createElement("div"),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as React.PointerEvent<HTMLElement>;

const createTouchEvent = (
  y: number,
  target?: Element,
): React.TouchEvent<HTMLElement> =>
  ({
    touches: [{ clientX: 0, clientY: y }],
    changedTouches: [{ clientX: 0, clientY: y }],
    target: target ?? document.createElement("div"),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as React.TouchEvent<HTMLElement>;

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
    vi.useRealTimers();
  });

  it("starts immediately from drag handle, previews in 5-minute increments, and uses drop-only haptics", () => {
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

    expect(result.current.draggingTaskId).toBe("task-1");
    expect(result.current.previewTime).toBe("09:00");

    act(() => {
      dispatchPointerMove(120);
    });
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

  it("starts drag immediately on touch and supports quick touch drag/drop", () => {
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
    expect(result.current.draggingTaskId).toBe("task-1");

    act(() => {
      dispatchTouchMove(120);
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
      dispatchPointerMove(790);
    });

    expect(result.current.previewTime).toBe("09:00");

    act(() => {
      (window as Window & { scrollY: number }).scrollY = 120;
      dispatchScroll();
    });

    expect(result.current.previewTime).toBe("10:00");

    act(() => {
      dispatchPointerUp();
    });

    expect(onDrop).toHaveBeenCalledWith("task-scroll", "10:00");
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
    act(() => {
      dispatchPointerUp();
    });
    expect(onDrop).not.toHaveBeenCalledWith("task-lower", expect.any(String));
  });
});
