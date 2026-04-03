import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_TOAST_DURATION_MS } from "@/constants/toast";

const sonnerMocks = vi.hoisted(() => ({
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
    Toaster: () => null,
    toast,
  };
});

import { toast } from "./sonner";

describe("sonner toast wrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.values(sonnerMocks).forEach((mockFn) => mockFn.mockReset());
  });

  it("caps success toasts at three seconds", () => {
    toast.success("Saved", { duration: 5000 });

    expect(sonnerMocks.success).toHaveBeenCalledWith(
      "Saved",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );
  });

  it("auto-dismisses loading toasts after three seconds", () => {
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
});
