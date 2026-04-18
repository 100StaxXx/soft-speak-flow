import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    current_stage: 8,
  },
  progressToNext: 42,
  canEvolve: false,
  care: {
    overallCare: 0.72,
    hasDormancyWarning: false,
    dormancy: {
      inactiveDays: 0,
    },
  },
  moodSignal: {
    pendingMood: null,
    todayMood: null,
    latestMood: null,
    moodSignal: null,
    source: "none" as const,
  },
  activeEvent: null as { type: string } | null,
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    progressToNext: mocks.progressToNext,
    canEvolve: mocks.canEvolve,
  }),
}));

vi.mock("@/hooks/useCompanionCareSignals", () => ({
  useCompanionCareSignals: () => ({
    care: mocks.care,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useCompanionMoodSignal", () => ({
  useCompanionMoodSignal: () => mocks.moodSignal,
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    activeEvent: mocks.activeEvent,
    triggerEvent: vi.fn(),
    clearEvent: vi.fn(),
  }),
}));

import {
  COMPANION_EXPRESSION_EVENT_WINDOW_MS,
  deriveCompanionExpressionState,
  getCompanionExpressionVariant,
  useCompanionExpressionState,
} from "./useCompanionExpressionState";

describe("useCompanionExpressionState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T09:00:00"));
    mocks.companion = {
      id: "companion-1",
      current_stage: 8,
    };
    mocks.progressToNext = 42;
    mocks.canEvolve = false;
    mocks.care = {
      overallCare: 0.72,
      hasDormancyWarning: false,
      dormancy: {
        inactiveDays: 0,
      },
    };
    mocks.moodSignal = {
      pendingMood: null,
      todayMood: null,
      latestMood: null,
      moodSignal: null,
      source: "none",
    };
    mocks.activeEvent = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prioritizes recent reward events as excited", () => {
    const state = deriveCompanionExpressionState({
      companionId: "companion-1",
      currentStage: 8,
      overallCare: 0.7,
      hasRecentRewardEvent: true,
      currentHour: 9,
      now: new Date("2026-04-18T09:00:00"),
    });

    expect(state.mood).toBe("excited");
    expect(state.reason).toBe("recent-reward-event");
    expect(state.isEventDriven).toBe(true);
  });

  it("maps low care and warning states to concerned", () => {
    const state = deriveCompanionExpressionState({
      companionId: "companion-1",
      currentStage: 8,
      overallCare: 0.22,
      inactiveDays: 3,
      currentHour: 14,
      now: new Date("2026-04-18T14:00:00"),
    });

    expect(state.mood).toBe("concerned");
    expect(state.reason).toBe("inactive-days");
  });

  it("maps late-night idle periods to sleepy", () => {
    const state = deriveCompanionExpressionState({
      companionId: "companion-1",
      currentStage: 8,
      overallCare: 0.5,
      currentHour: 23,
      now: new Date("2026-04-18T23:15:00"),
    });

    expect(state.mood).toBe("sleepy");
    expect(state.reason).toBe("late-night");
  });

  it("maps positive mood signals to happy", () => {
    const state = deriveCompanionExpressionState({
      companionId: "companion-1",
      currentStage: 8,
      overallCare: 0.45,
      moodSignal: "focused",
      currentHour: 11,
      now: new Date("2026-04-18T11:00:00"),
    });

    expect(state.mood).toBe("happy");
    expect(state.reason).toBe("positive-mood");
  });

  it("falls back to calm when no stronger signal is active", () => {
    const state = deriveCompanionExpressionState({
      companionId: "companion-1",
      currentStage: 8,
      overallCare: 0.45,
      currentHour: 15,
      now: new Date("2026-04-18T15:00:00"),
    });

    expect(state.mood).toBe("calm");
    expect(state.reason).toBe("default-calm");
  });

  it("keeps the selected variant stable across rerenders inside the same 6-hour bucket", () => {
    const { result, rerender } = renderHook(() => useCompanionExpressionState());

    expect(result.current.variant).toBe(
      getCompanionExpressionVariant({
        companionId: mocks.companion.id,
        currentStage: mocks.companion.current_stage,
        mood: result.current.mood,
        now: new Date("2026-04-18T09:00:00"),
      }),
    );

    rerender();

    expect(result.current.variant).toBe(
      getCompanionExpressionVariant({
        companionId: mocks.companion.id,
        currentStage: mocks.companion.current_stage,
        mood: result.current.mood,
        now: new Date("2026-04-18T09:00:00"),
      }),
    );
  });

  it("rotates the selected variant when the local 6-hour bucket changes", () => {
    const start = new Date("2026-04-18T09:00:00");
    const afterBoundary = new Date("2026-04-18T12:00:00");

    let rotatingId = "companion-rotation";
    let startVariant = getCompanionExpressionVariant({
      companionId: rotatingId,
      currentStage: 8,
      mood: "happy",
      now: start,
    });
    let nextVariant = getCompanionExpressionVariant({
      companionId: rotatingId,
      currentStage: 8,
      mood: "happy",
      now: afterBoundary,
    });

    while (startVariant === nextVariant) {
      rotatingId = `${rotatingId}-x`;
      startVariant = getCompanionExpressionVariant({
        companionId: rotatingId,
        currentStage: 8,
        mood: "happy",
        now: start,
      });
      nextVariant = getCompanionExpressionVariant({
        companionId: rotatingId,
        currentStage: 8,
        mood: "happy",
        now: afterBoundary,
      });
    }

    mocks.companion = {
      id: rotatingId,
      current_stage: 8,
    };

    const { result } = renderHook(() => useCompanionExpressionState());
    expect(result.current.mood).toBe("happy");
    expect(result.current.variant).toBe(startVariant);

    act(() => {
      vi.advanceTimersByTime(3 * 60 * 60 * 1000);
      vi.setSystemTime(afterBoundary);
    });

    expect(result.current.variant).toBe(nextVariant);
  });

  it("treats recent custom reward events as temporarily event-driven", () => {
    const { result } = renderHook(() => useCompanionExpressionState());

    expect(result.current.mood).toBe("happy");

    act(() => {
      window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
    });

    expect(result.current.mood).toBe("excited");
    expect(result.current.isEventDriven).toBe(true);

    act(() => {
      vi.advanceTimersByTime(COMPANION_EXPRESSION_EVENT_WINDOW_MS);
    });

    expect(result.current.mood).toBe("happy");
    expect(result.current.isEventDriven).toBe(false);
  });
});
