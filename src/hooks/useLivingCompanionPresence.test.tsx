import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLivingCompanionPresence } from "@/hooks/useLivingCompanionPresence";

const mocks = vi.hoisted(() => ({
  triggerEvent: vi.fn(),
  light: vi.fn(),
  medium: vi.fn(),
  success: vi.fn(),
  updateDailyGuideThread: vi.fn().mockResolvedValue(null),
  dailyGuideThread: null as Record<string, unknown> | null,
  previousDailyGuideThread: null as Record<string, unknown> | null,
  memoryEnabled: true,
  trackProductExperience: vi.fn(),
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    activeEvent: null,
    triggerEvent: mocks.triggerEvent,
    clearEvent: vi.fn(),
  }),
}));

vi.mock("@/utils/haptics", () => ({
  haptics: {
    light: mocks.light,
    medium: mocks.medium,
    success: mocks.success,
  },
}));

vi.mock("@/hooks/useDailyGuideThread", () => ({
  useDailyGuideThread: () => ({
    thread: mocks.dailyGuideThread,
    previousThread: mocks.previousDailyGuideThread,
    updateThread: mocks.updateDailyGuideThread,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: { companion_memory_enabled: mocks.memoryEnabled },
  }),
}));

vi.mock("@/lib/productAnalytics", () => ({
  trackProductExperience: mocks.trackProductExperience,
}));

const defaultOptions = {
  companionId: "companion-1",
  companionName: "Nova",
  expressionMood: "calm" as const,
  isVisible: true,
  canInteract: true,
  isDormant: false,
  hasDormancyWarning: false,
  inactiveDays: 0,
  progressToNext: 45,
  canEvolve: false,
};

describe("useLivingCompanionPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 9, 0));
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.dailyGuideThread = null;
    mocks.previousDailyGuideThread = null;
    mocks.memoryEnabled = true;
    mocks.updateDailyGuideThread.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers one daily question, records the answer, and does not repeat it", () => {
    const answerListener = vi.fn();
    window.addEventListener("companion-daily-question-answered", answerListener);
    const first = renderHook(() => useLivingCompanionPresence(defaultOptions));

    act(() => {
      vi.advanceTimersByTime(3_200);
    });

    expect(first.result.current.prompt?.kind).toBe("question");
    expect(first.result.current.bodyLanguage).toBe("curious");
    const option = first.result.current.prompt?.options?.[0];
    expect(option).toBeDefined();

    act(() => {
      first.result.current.answerQuestion(option!.id);
    });

    expect(first.result.current.prompt).toMatchObject({
      kind: "comment",
      message: option!.response,
    });
    expect(mocks.medium).toHaveBeenCalledOnce();
    expect(answerListener).toHaveBeenCalledOnce();
    expect(mocks.updateDailyGuideThread).toHaveBeenCalledWith(expect.objectContaining({
      companion_question_id: expect.any(String),
      companion_answer_id: option!.id,
      companion_answer_label: option!.label,
      companion_answered_at: expect.any(String),
    }));
    expect(JSON.parse(
      localStorage.getItem("graceward:living-companion:question:companion-1:2026-08-09") ?? "{}",
    )).toMatchObject({
      status: "answered",
      optionId: option!.id,
    });

    first.unmount();
    const second = renderHook(() => useLivingCompanionPresence(defaultOptions));
    act(() => {
      vi.advanceTimersByTime(3_200);
    });
    expect(second.result.current.prompt).toBeNull();
    window.removeEventListener("companion-daily-question-answered", answerListener);
  });

  it("acknowledges the Guide-led daily thread before offering a separate question", async () => {
    mocks.dailyGuideThread = {
      updated_at: "2026-08-09T09:00:00.000Z",
      companion_response: "Clarity, then. I’ll help you keep the next step simple today.",
      companion_acknowledged_at: null,
      focus_answered_at: "2026-08-09T08:30:00.000Z",
      encouragement_completed_at: null,
    };

    const { result } = renderHook(() => useLivingCompanionPresence(defaultOptions));

    await act(async () => {
      vi.advanceTimersByTime(1_251);
      await Promise.resolve();
    });

    expect(result.current.prompt).toMatchObject({
      kind: "comment",
      message: "Clarity, then. I’ll help you keep the next step simple today.",
    });
    expect(mocks.updateDailyGuideThread).toHaveBeenCalledWith({
      companion_acknowledged_at: expect.any(String),
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.prompt?.kind).not.toBe("question");
  });

  it("gently recalls the previous thread once when personal memory is enabled", async () => {
    mocks.previousDailyGuideThread = {
      thread_date: "2026-08-08",
      focus_label: "A gentler pace",
      companion_answer_label: null,
      practice_completed_at: null,
    };

    const { result } = renderHook(() => useLivingCompanionPresence(defaultOptions));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_801);
    });

    expect(localStorage.getItem("graceward:living-companion:daily-memory:companion-1:2026-08-09")).not.toBeNull();
    expect(result.current.prompt?.message).toContain("without becoming a debt");
    expect(mocks.trackProductExperience).toHaveBeenCalledWith(
      "companion_response_viewed",
      expect.objectContaining({ surface: "companion" }),
    );
  });

  it("turns portrait taps into contextual comments with a short cooldown", () => {
    const { result } = renderHook(() => useLivingCompanionPresence(defaultOptions));

    act(() => {
      result.current.interact();
    });

    expect(result.current.prompt?.kind).toBe("comment");
    expect(result.current.bodyLanguage).toBe("curious");
    expect(result.current.interactionNonce).toBe(1);
    expect(mocks.light).toHaveBeenCalledOnce();
    expect(mocks.triggerEvent).toHaveBeenCalledWith(expect.objectContaining({
      reason: "companion_tap",
    }));

    act(() => {
      result.current.interact();
    });
    expect(result.current.interactionNonce).toBe(1);

    act(() => {
      vi.advanceTimersByTime(901);
      result.current.interact();
    });
    expect(result.current.interactionNonce).toBe(2);
    expect(mocks.light).toHaveBeenCalledTimes(2);
  });

  it("treats a press and hold as a comforting moment", () => {
    const { result } = renderHook(() => useLivingCompanionPresence(defaultOptions));

    act(() => {
      result.current.comfort();
    });

    expect(result.current.prompt?.message).toBe("I felt that. It's good to pause together.");
    expect(result.current.bodyLanguage).toBe("happy");
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.triggerEvent).toHaveBeenCalledWith(expect.objectContaining({
      reason: "companion_comfort",
    }));
  });

  it("turns petting and play into distinct creature actions", () => {
    const { result } = renderHook(() => useLivingCompanionPresence({
      ...defaultOptions,
      currentStage: 36,
      presetId: "phoenix",
    }));

    act(() => {
      result.current.pet({ x: 62, y: 42 });
    });
    expect(result.current.activeAction).toBe("nuzzle");
    expect(result.current.interactionPoint).toEqual({ x: 62, y: 42 });

    act(() => {
      result.current.play();
    });
    expect(["play", "signature"]).toContain(result.current.activeAction);
    expect(result.current.bodyLanguage).toBe("excited");
    expect(mocks.triggerEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      intensity: expect.stringMatching(/medium|heroic/),
    }));
  });

  it("lets the pre-hatch egg react without offering spoken daily questions", () => {
    const { result } = renderHook(() => useLivingCompanionPresence({
      ...defaultOptions,
      currentStage: 0,
      canSpeak: false,
    }));

    act(() => {
      result.current.interact("head", { x: 50, y: 25 });
    });
    expect(result.current.prompt?.message).toContain("inside the shell");
    expect(result.current.activeAction).toBe("listen");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.prompt?.kind).not.toBe("question");
  });

  it("comments on meaningful progress without interrupting every action", () => {
    const { result } = renderHook(() => useLivingCompanionPresence(defaultOptions));

    act(() => {
      window.dispatchEvent(new Event("task-completed"));
    });

    expect(result.current.prompt).toMatchObject({
      kind: "comment",
      message: "You followed through. Let that count before you hurry onward.",
    });
    expect(result.current.bodyLanguage).toBe("happy");

    act(() => {
      window.dispatchEvent(new Event("focus-sprint-completed"));
    });
    expect(result.current.prompt?.message).toBe(
      "You followed through. Let that count before you hurry onward.",
    );
  });
});
