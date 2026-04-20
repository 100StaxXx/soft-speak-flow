import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();

  return {
    safeLocalStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
        return true;
      }),
      clear: vi.fn(() => {
        values.clear();
        return true;
      }),
    },
  };
});

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storage.safeLocalStorage,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
  },
}));

import {
  DRAGGABLE_FAB_LEGACY_STORAGE_KEY,
  DRAGGABLE_FAB_STORAGE_KEY_V2,
  useDraggableFAB,
} from "./useDraggableFAB";

const setViewport = ({ width, height }: { width: number; height: number }) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
};

const setSafeAreaVars = ({
  top = 0,
  right = 0,
  bottom = 0,
  left = 0,
}: {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}) => {
  document.documentElement.style.setProperty("--safe-area-inset-top", `${top}px`);
  document.documentElement.style.setProperty("--safe-area-inset-right", `${right}px`);
  document.documentElement.style.setProperty("--safe-area-inset-bottom", `${bottom}px`);
  document.documentElement.style.setProperty("--safe-area-inset-left", `${left}px`);
  document.documentElement.style.setProperty("--sat", `${top}px`);
  document.documentElement.style.setProperty("--sar", `${right}px`);
  document.documentElement.style.setProperty("--sab", `${bottom}px`);
  document.documentElement.style.setProperty("--sal", `${left}px`);
};

describe("useDraggableFAB", () => {
  beforeEach(() => {
    storage.safeLocalStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    setViewport({ width: 400, height: 800 });
    setSafeAreaVars({ top: 0, right: 0, bottom: 0, left: 0 });
    document.documentElement.style.setProperty("--bottom-nav-runtime-offset", "96px");
    document.documentElement.style.setProperty("--bottom-nav-safe-offset", "96px");
  });

  it("uses a freeform bottom-right default position within the safe viewport bounds", () => {
    const { result } = renderHook(() => useDraggableFAB());

    expect(result.current.position).toEqual({ x: 240, y: 536 });
    expect(result.current.popupAlignment).toEqual({ horizontal: "right", vertical: "bottom" });
    expect(result.current.positionStyles).toMatchObject({
      left: 240,
      top: 536,
    });
  });

  it("restores a previously saved freeform position from local storage", () => {
    storage.safeLocalStorage.setItem(DRAGGABLE_FAB_STORAGE_KEY_V2, JSON.stringify({ x: 72, y: 128 }));

    const { result } = renderHook(() => useDraggableFAB());

    expect(result.current.position).toEqual({ x: 72, y: 128 });
    expect(result.current.popupAlignment).toEqual({ horizontal: "left", vertical: "top" });
  });

  it("migrates the legacy corner value into a saved freeform position", async () => {
    storage.safeLocalStorage.setItem(DRAGGABLE_FAB_LEGACY_STORAGE_KEY, "top-left");

    const { result } = renderHook(() => useDraggableFAB());

    expect(result.current.position).toEqual({ x: 16, y: 80 });

    await waitFor(() => {
      expect(storage.safeLocalStorage.setItem).toHaveBeenCalledWith(
        DRAGGABLE_FAB_STORAGE_KEY_V2,
        JSON.stringify({ x: 16, y: 80 }),
      );
    });
  });

  it("clamps a dragged drop to the safe viewport bounds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDraggableFAB());

    act(() => {
      result.current.longPressHandlers.onPointerDown({
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent);
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isLongPressing).toBe(true);

    act(() => {
      result.current.dragControls.onDragStart();
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.dragControls.onDragEnd(
        {} as MouseEvent,
        {
          offset: { x: 500, y: -1000 },
        } as never,
      );
    });

    expect(result.current.position).toEqual({ x: 240, y: 80 });
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isLongPressing).toBe(false);
  });

  it("re-clamps a saved position when the viewport shrinks", async () => {
    storage.safeLocalStorage.setItem(DRAGGABLE_FAB_STORAGE_KEY_V2, JSON.stringify({ x: 260, y: 620 }));

    const { result } = renderHook(() => useDraggableFAB());

    expect(result.current.position).toEqual({ x: 240, y: 536 });

    setViewport({ width: 320, height: 640 });
    document.documentElement.style.setProperty("--bottom-nav-runtime-offset", "120px");
    document.documentElement.style.setProperty("--bottom-nav-safe-offset", "120px");

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.position).toEqual({ x: 160, y: 352 });
    });
  });
});
