import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_TOAST_DURATION_MS } from "@/constants/toast";

const sonnerMocks = vi.hoisted(() => ({
  toaster: vi.fn(() => null),
  base: vi.fn(() => "base-id"),
  success: vi.fn(() => "success-id"),
  info: vi.fn(() => "info-id"),
  warning: vi.fn(() => "warning-id"),
  error: vi.fn(() => "error-id"),
  custom: vi.fn(() => "custom-id"),
  message: vi.fn(() => "message-id"),
  promise: vi.fn(),
  dismiss: vi.fn(),
  loading: vi.fn(() => "loading-id"),
  getHistory: vi.fn(() => []),
  getToasts: vi.fn(() => []),
}));

vi.mock("sonner", () => {
  const toast = Object.assign(sonnerMocks.base, {
    success: sonnerMocks.success,
    info: sonnerMocks.info,
    warning: sonnerMocks.warning,
    error: sonnerMocks.error,
    custom: sonnerMocks.custom,
    message: sonnerMocks.message,
    promise: sonnerMocks.promise,
    dismiss: sonnerMocks.dismiss,
    loading: sonnerMocks.loading,
    getHistory: sonnerMocks.getHistory,
    getToasts: sonnerMocks.getToasts,
  });

  return {
    Toaster: sonnerMocks.toaster,
    toast,
  };
});

import { Toaster, toast } from "./sonner";

describe("sonner toast wrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.values(sonnerMocks).forEach((mockFn) => mockFn.mockReset());
  });

  it("caps success toasts at two seconds", () => {
    toast.success("Saved", { duration: 5000 });

    expect(sonnerMocks.success).toHaveBeenCalledWith(
      "Saved",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );
  });

  it("hard-dismisses action toasts after two seconds", () => {
    toast("Quest deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: vi.fn(),
      },
    });

    expect(sonnerMocks.base).toHaveBeenCalledWith(
      "Quest deleted",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );

    act(() => {
      vi.advanceTimersByTime(MAX_TOAST_DURATION_MS);
    });

    expect(sonnerMocks.dismiss).toHaveBeenCalledWith("base-id");
  });

  it("auto-dismisses loading toasts after two seconds", () => {
    sonnerMocks.loading.mockReturnValueOnce("loading-id");

    toast.loading("Working...");

    expect(sonnerMocks.loading).toHaveBeenCalledWith(
      "Working...",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );

    act(() => {
      vi.advanceTimersByTime(MAX_TOAST_DURATION_MS);
    });

    expect(sonnerMocks.dismiss).toHaveBeenCalledWith("loading-id");
  });

  it("disables pause-when-hidden on the shared toaster", () => {
    render(<Toaster />);

    const sonnerProps = sonnerMocks.toaster.mock.calls[0]?.[0];

    expect(sonnerProps).toEqual(expect.objectContaining({
      className: "toaster group",
      duration: MAX_TOAST_DURATION_MS,
      pauseWhenPageIsHidden: false,
      position: "bottom-center",
      swipeDirections: ["bottom", "left", "right"],
      theme: "dark",
    }));
  });
});
