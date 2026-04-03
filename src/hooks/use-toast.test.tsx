import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast, useToast } from "./use-toast";

describe("use-toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      result.current.dismiss();
      vi.runOnlyPendingTimers();
    });

    unmount();
    vi.useRealTimers();
  });

  it("removes dismissed toasts shortly after they close", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Test toast" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.open).toBe(true);

    act(() => {
      result.current.dismiss(result.current.toasts[0]?.id);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.open).toBe(false);

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("caps toast duration at three seconds", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Slow toast", duration: 5000 });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.duration).toBe(3000);
  });
});
