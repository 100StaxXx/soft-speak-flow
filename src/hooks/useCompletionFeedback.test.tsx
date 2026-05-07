import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  showMock: vi.fn(),
  replaceCurrentMock: vi.fn(),
  triggerEventMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invokeMock(...args),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/TalkPopupContext", () => ({
  useTalkPopupContextSafe: () => ({
    show: mocks.showMock,
    replaceCurrent: mocks.replaceCurrentMock,
    dismiss: vi.fn(),
    isVisible: false,
  }),
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    triggerEvent: mocks.triggerEventMock,
  }),
}));

import { useCompletionFeedback } from "./useCompletionFeedback";

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const getTodayTaskDate = () => new Date().toISOString().slice(0, 10);

describe("useCompletionFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showMock.mockResolvedValue(undefined);
    mocks.replaceCurrentMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows deterministic fallback immediately, then quickly replaces it with valid AI feedback", async () => {
    const deferred = createDeferred<{ data: unknown; error: null }>();
    mocks.invokeMock.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useCompletionFeedback());
    const completionPromise = result.current.triggerCompletionFeedback({
      taskId: "task-1",
      taskTitle: "Portfolio session",
      completionSource: "quest",
      taskDate: getTodayTaskDate(),
    });

    await waitFor(() => {
      expect(mocks.showMock).toHaveBeenCalledWith(expect.objectContaining({
        tone: "proud",
      }));
    });
    const fallbackMessage = (mocks.showMock.mock.calls[0]?.[0] as { message: string }).message;
    expect(fallbackMessage).toContain("Portfolio session");
    expect(mocks.replaceCurrentMock).not.toHaveBeenCalled();

    deferred.resolve({
      data: {
        companion: {
          message: "Portfolio session landed after a packed day.",
          tone: "locked_in",
        },
        mentor: {
          show: true,
          personality: "Disciplined",
          message: "That is the standard.",
        },
        generationSource: "ai",
      },
      error: null,
    });

    await completionPromise;

    expect(mocks.replaceCurrentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Portfolio session landed after a packed day.",
        tone: "locked_in",
        mentor: {
          personality: "Disciplined",
          message: "That is the standard.",
        },
      }),
      fallbackMessage,
    );
  });

  it("does not replace fallback copy when AI feedback arrives after the fresh-popup window", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const deferred = createDeferred<{ data: unknown; error: null }>();
    mocks.invokeMock.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useCompletionFeedback());
    const completionPromise = result.current.triggerCompletionFeedback({
      taskId: "task-1",
      taskTitle: "Portfolio session",
      completionSource: "quest",
      taskDate: getTodayTaskDate(),
    });

    await waitFor(() => {
      expect(mocks.showMock).toHaveBeenCalledWith(expect.objectContaining({
        tone: "proud",
      }));
    });

    now = 2_500;
    deferred.resolve({
      data: {
        companion: {
          message: "Portfolio session landed after a packed day.",
          tone: "locked_in",
        },
        generationSource: "ai",
      },
      error: null,
    });

    await completionPromise;

    expect(mocks.replaceCurrentMock).not.toHaveBeenCalled();
  });

  it("does not replace instant fallback when the server returns fallback metadata", async () => {
    const deferred = createDeferred<{ data: unknown; error: null }>();
    mocks.invokeMock.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useCompletionFeedback());
    const completionPromise = result.current.triggerCompletionFeedback({
      taskId: "task-1",
      taskTitle: "Portfolio session",
      completionSource: "quest",
      taskDate: getTodayTaskDate(),
    });

    await waitFor(() => {
      expect(mocks.showMock).toHaveBeenCalledWith(expect.objectContaining({
        tone: "proud",
      }));
    });

    deferred.resolve({
      data: {
        companion: {
          message: "Portfolio session cleared. Different fallback line.",
          tone: "proud",
        },
        generationSource: "fallback",
      },
      error: null,
    });

    await completionPromise;

    expect(mocks.replaceCurrentMock).not.toHaveBeenCalled();
  });
});
