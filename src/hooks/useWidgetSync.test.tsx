import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyTask } from "./useTasksQuery";

const mocks = vi.hoisted(() => {
  const updateWidgetDataMock = vi.fn();
  const addListenerMock = vi.fn();
  const removeListenerMock = vi.fn();

  const platformState = {
    isNative: true,
    platform: "ios",
  };

  return {
    updateWidgetDataMock,
    addListenerMock,
    removeListenerMock,
    platformState,
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.platformState.isNative,
    getPlatform: () => mocks.platformState.platform,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addListenerMock,
  },
}));

vi.mock("@/plugins/WidgetDataPlugin", () => ({
  WidgetData: {
    updateWidgetData: mocks.updateWidgetDataMock,
  },
}));

import { useWidgetSync } from "./useWidgetSync";

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeTask(overrides: Partial<DailyTask> = {}): DailyTask {
  return {
    id: "task-1",
    user_id: "user-1",
    task_text: "Daily focus",
    difficulty: null,
    xp_reward: 50,
    task_date: localDateString(),
    completed: false,
    completed_at: null,
    is_main_quest: false,
    scheduled_time: "09:00",
    estimated_duration: null,
    recurrence_pattern: null,
    recurrence_days: null,
    is_recurring: null,
    reminder_enabled: null,
    reminder_minutes_before: null,
    reminder_sent: null,
    parent_template_id: null,
    category: "mindset",
    is_bonus: null,
    created_at: null,
    priority: null,
    energy_level: null,
    is_top_three: null,
    actual_time_spent: null,
    ai_generated: null,
    context_id: null,
    source: null,
    habit_source_id: null,
    epic_id: null,
    contact_id: null,
    auto_log_interaction: null,
    image_url: null,
    notes: null,
    location: null,
    ...overrides,
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useWidgetSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-12T09:00:00"));
    vi.clearAllMocks();

    mocks.platformState.isNative = true;
    mocks.platformState.platform = "ios";
    mocks.updateWidgetDataMock.mockResolvedValue(undefined);
    mocks.addListenerMock.mockResolvedValue({ remove: mocks.removeListenerMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("syncs today's tasks with mapped payload and counts", async () => {
    const today = localDateString();
    const tasks: DailyTask[] = [
      makeTask({
        id: "quest-1",
        task_text: "Deep work sprint",
        xp_reward: 100,
        is_main_quest: true,
        completed: true,
        category: "work",
        scheduled_time: "08:30",
        habit_source_id: null,
      }),
      makeTask({
        id: "ritual-1",
        task_text: "Morning ritual",
        completed: false,
        habit_source_id: "habit-1",
      }),
    ];

    renderHook(() => useWidgetSync(tasks, today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateWidgetDataMock).toHaveBeenCalledWith({
      tasks: [
        {
          id: "quest-1",
          text: "Deep work sprint",
          completed: true,
          xpReward: 100,
          isMainQuest: true,
          category: "work",
          section: "morning",
          scheduledTime: "08:30",
        },
      ],
      completedCount: 1,
      totalCount: 1,
      ritualCount: 1,
      ritualCompleted: 0,
      date: today,
    });
  });

  it("syncs an empty today payload to clear stale widget tasks", async () => {
    const today = localDateString();

    renderHook(() => useWidgetSync([], today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateWidgetDataMock).toHaveBeenCalledWith({
      tasks: [],
      completedCount: 0,
      totalCount: 0,
      ritualCount: 0,
      ritualCompleted: 0,
      date: today,
    });
  });

  it("skips syncing when the selected date is not today", async () => {
    renderHook(() => useWidgetSync([makeTask()], "2026-02-11"));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).not.toHaveBeenCalled();
  });

  it("retries sync after a failed native write", async () => {
    const today = localDateString();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.updateWidgetDataMock
      .mockRejectedValueOnce(new Error("native write failed"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();
    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.syncToWidget();
    });

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
  });

  it("keeps a single appState listener across rerenders and syncs when task content changes", async () => {
    const today = localDateString();
    const initialTasks = [
      makeTask({ id: "quest-1", task_text: "Initial title", completed: false }),
    ];
    const updatedTasks = [
      makeTask({ id: "quest-1", task_text: "Edited title", completed: false }),
    ];

    const { rerender } = renderHook(
      ({ tasks }) => useWidgetSync(tasks, today),
      { initialProps: { tasks: initialTasks } },
    );
    await flushEffects();

    expect(mocks.addListenerMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);

    rerender({ tasks: updatedTasks });
    await flushEffects();

    expect(mocks.addListenerMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(2);

    const appStateCallback = mocks.addListenerMock.mock.calls[0]?.[1];
    expect(typeof appStateCallback).toBe("function");

    await act(async () => {
      appStateCallback({ isActive: true });
      await Promise.resolve();
    });

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(3);
    expect(mocks.updateWidgetDataMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tasks: [
          expect.objectContaining({
            id: "quest-1",
            text: "Edited title",
          }),
        ],
      }),
    );
  });
});
