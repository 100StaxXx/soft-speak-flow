import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyTask } from "./useTasksQuery";

const mocks = vi.hoisted(() => {
  const updateWidgetDataMock = vi.fn();
  const getWidgetSyncDiagnosticsMock = vi.fn();
  const addListenerMock = vi.fn();
  const removeListenerMock = vi.fn();

  const platformState = {
    isNative: true,
    platform: "ios",
    widgetPluginAvailable: true,
  };

  return {
    updateWidgetDataMock,
    getWidgetSyncDiagnosticsMock,
    addListenerMock,
    removeListenerMock,
    platformState,
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.platformState.isNative,
    getPlatform: () => mocks.platformState.platform,
    isPluginAvailable: (name: string) =>
      name === "WidgetData" ? mocks.platformState.widgetPluginAvailable : true,
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
    getWidgetSyncDiagnostics: mocks.getWidgetSyncDiagnosticsMock,
  },
}));

import {
  WIDGET_SYNC_DIAGNOSTICS_STORAGE_KEY,
  WIDGET_SYNC_LAST_ERROR_STORAGE_KEY,
  useWidgetSync,
} from "./useWidgetSync";

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
    mocks.platformState.widgetPluginAvailable = true;
    mocks.updateWidgetDataMock.mockResolvedValue(undefined);
    mocks.getWidgetSyncDiagnosticsMock.mockResolvedValue({
      appGroupAccessible: true,
      hasPayload: true,
      payloadDate: localDateString(),
      payloadUpdatedAt: null,
      payloadByteCount: 32,
      appGroupId: "group.com.darrylgraham.revolution",
      dataKey: "widget_tasks_data",
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    mocks.addListenerMock.mockResolvedValue({ remove: mocks.removeListenerMock });
    window.sessionStorage.clear();
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

  it("updates widget immediately when quests are created and deleted", async () => {
    const today = localDateString();
    const createdQuest = makeTask({
      id: "quest-created",
      task_text: "Ship update",
      completed: false,
      habit_source_id: null,
      scheduled_time: "16:30",
    });

    const { rerender } = renderHook(
      ({ tasks }) => useWidgetSync(tasks, today),
      { initialProps: { tasks: [] as DailyTask[] } },
    );
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateWidgetDataMock).toHaveBeenLastCalledWith({
      tasks: [],
      completedCount: 0,
      totalCount: 0,
      ritualCount: 0,
      ritualCompleted: 0,
      date: today,
    });

    rerender({ tasks: [createdQuest] });
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(2);
    expect(mocks.updateWidgetDataMock).toHaveBeenLastCalledWith({
      tasks: [
        expect.objectContaining({
          id: "quest-created",
          text: "Ship update",
          scheduledTime: "16:30",
        }),
      ],
      completedCount: 0,
      totalCount: 1,
      ritualCount: 0,
      ritualCompleted: 0,
      date: today,
    });

    rerender({ tasks: [] });
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(3);
    expect(mocks.updateWidgetDataMock).toHaveBeenLastCalledWith({
      tasks: [],
      completedCount: 0,
      totalCount: 0,
      ritualCount: 0,
      ritualCompleted: 0,
      date: today,
    });
  });

  it("orders widget quests by scheduled time with unscheduled quests last", async () => {
    const today = localDateString();
    const tasks: DailyTask[] = [
      makeTask({
        id: "quest-unscheduled",
        task_text: "Inbox cleanup",
        scheduled_time: null,
      }),
      makeTask({
        id: "quest-late",
        task_text: "Afternoon review",
        scheduled_time: "16:30",
      }),
      makeTask({
        id: "quest-early",
        task_text: "Morning focus",
        scheduled_time: "08:15",
      }),
      makeTask({
        id: "quest-mid",
        task_text: "Standup prep",
        scheduled_time: "09:45",
      }),
    ];

    renderHook(() => useWidgetSync(tasks, today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [
          expect.objectContaining({ id: "quest-early", scheduledTime: "08:15" }),
          expect.objectContaining({ id: "quest-mid", scheduledTime: "09:45" }),
          expect.objectContaining({ id: "quest-late", scheduledTime: "16:30" }),
          expect.objectContaining({ id: "quest-unscheduled", scheduledTime: null }),
        ],
      }),
    );
  });

  it("preserves relative order for equal scheduled times and unscheduled quests", async () => {
    const today = localDateString();
    const tasks: DailyTask[] = [
      makeTask({
        id: "quest-same-a",
        task_text: "Same time A",
        scheduled_time: "09:00",
      }),
      makeTask({
        id: "quest-unscheduled-a",
        task_text: "Anytime A",
        scheduled_time: null,
      }),
      makeTask({
        id: "quest-same-b",
        task_text: "Same time B",
        scheduled_time: "09:00",
      }),
      makeTask({
        id: "quest-unscheduled-b",
        task_text: "Anytime B",
        scheduled_time: null,
      }),
    ];

    renderHook(() => useWidgetSync(tasks, today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [
          expect.objectContaining({ id: "quest-same-a" }),
          expect.objectContaining({ id: "quest-same-b" }),
          expect.objectContaining({ id: "quest-unscheduled-a" }),
          expect.objectContaining({ id: "quest-unscheduled-b" }),
        ],
      }),
    );
  });

  it("applies the 10-item widget limit after sorting quests", async () => {
    const today = localDateString();
    const tasks: DailyTask[] = [
      makeTask({ id: "quest-unscheduled-1", task_text: "Unscheduled 1", scheduled_time: null }),
      makeTask({ id: "quest-unscheduled-2", task_text: "Unscheduled 2", scheduled_time: null }),
      makeTask({ id: "quest-1300", task_text: "1:00 PM", scheduled_time: "13:00" }),
      makeTask({ id: "quest-0900", task_text: "9:00 AM", scheduled_time: "09:00" }),
      makeTask({ id: "quest-1500", task_text: "3:00 PM", scheduled_time: "15:00" }),
      makeTask({ id: "quest-0830", task_text: "8:30 AM", scheduled_time: "08:30" }),
      makeTask({ id: "quest-1100", task_text: "11:00 AM", scheduled_time: "11:00" }),
      makeTask({ id: "quest-1000", task_text: "10:00 AM", scheduled_time: "10:00" }),
      makeTask({ id: "quest-1630", task_text: "4:30 PM", scheduled_time: "16:30" }),
      makeTask({ id: "quest-1200", task_text: "12:00 PM", scheduled_time: "12:00" }),
      makeTask({ id: "quest-1400", task_text: "2:00 PM", scheduled_time: "14:00" }),
      makeTask({ id: "quest-1700", task_text: "5:00 PM", scheduled_time: "17:00" }),
    ];

    renderHook(() => useWidgetSync(tasks, today));
    await flushEffects();

    const payload = mocks.updateWidgetDataMock.mock.calls[0]?.[0];
    expect(payload.tasks).toHaveLength(10);
    expect(payload.tasks.map((task: { id: string }) => task.id)).toEqual([
      "quest-0830",
      "quest-0900",
      "quest-1000",
      "quest-1100",
      "quest-1200",
      "quest-1300",
      "quest-1400",
      "quest-1500",
      "quest-1630",
      "quest-1700",
    ]);
  });

  it("keeps rituals out of the widget list while preserving ritual counts", async () => {
    const today = localDateString();
    const tasks: DailyTask[] = [
      makeTask({
        id: "ritual-1",
        task_text: "Morning ritual",
        completed: true,
        habit_source_id: "habit-1",
        scheduled_time: "07:00",
      }),
      makeTask({
        id: "quest-1",
        task_text: "Deep work",
        scheduled_time: "09:00",
        habit_source_id: null,
      }),
      makeTask({
        id: "ritual-2",
        task_text: "Evening ritual",
        completed: false,
        habit_source_id: "habit-2",
        scheduled_time: null,
      }),
      makeTask({
        id: "quest-2",
        task_text: "Inbox zero",
        scheduled_time: null,
        habit_source_id: null,
      }),
    ];

    renderHook(() => useWidgetSync(tasks, today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledWith({
      tasks: [
        {
          id: "quest-1",
          text: "Deep work",
          completed: false,
          xpReward: 50,
          isMainQuest: false,
          category: "mindset",
          section: "morning",
          scheduledTime: "09:00",
        },
        {
          id: "quest-2",
          text: "Inbox zero",
          completed: false,
          xpReward: 50,
          isMainQuest: false,
          category: "mindset",
          section: "unscheduled",
          scheduledTime: null,
        },
      ],
      completedCount: 0,
      totalCount: 2,
      ritualCount: 2,
      ritualCompleted: 1,
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

  it("still syncs when isPluginAvailable reports false", async () => {
    const today = localDateString();
    mocks.platformState.widgetPluginAvailable = false;

    renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    expect(mocks.addListenerMock).toHaveBeenCalledTimes(1);
  });

  it("disables further sync attempts after an unimplemented plugin error", async () => {
    const today = localDateString();
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.updateWidgetDataMock.mockRejectedValueOnce({
      code: "UNIMPLEMENTED",
      message: "WidgetData plugin not implemented",
    });

    const { result } = renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.syncToWidget(true);
    });

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    const appStateCallback = mocks.addListenerMock.mock.calls[0]?.[1];
    await act(async () => {
      appStateCallback?.({ isActive: true });
      await Promise.resolve();
    });

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("runs diagnostics on iOS mount and logs warning for missing payload", async () => {
    const today = localDateString();
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getWidgetSyncDiagnosticsMock.mockResolvedValueOnce({
      appGroupAccessible: true,
      hasPayload: false,
      payloadDate: null,
      payloadUpdatedAt: null,
      payloadByteCount: 0,
      appGroupId: "group.com.darrylgraham.revolution",
      dataKey: "widget_tasks_data",
      lastErrorCode: null,
      lastErrorMessage: null,
    });

    renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    expect(mocks.getWidgetSyncDiagnosticsMock).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[WidgetSync] Diagnostics indicate missing shared payload state",
      expect.objectContaining({
        hasPayload: false,
      }),
    );
    consoleWarnSpy.mockRestore();
  });

  it("does not crash when diagnostics call fails", async () => {
    const today = localDateString();
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getWidgetSyncDiagnosticsMock.mockRejectedValueOnce(new Error("diagnostics failed"));

    renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    expect(mocks.updateWidgetDataMock).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[WidgetSync] Diagnostics check failed",
      expect.objectContaining({
        message: "diagnostics failed",
      }),
    );
    consoleWarnSpy.mockRestore();
  });

  it("persists diagnostics snapshot to sessionStorage", async () => {
    const today = localDateString();
    const diagnosticsPayload = {
      appGroupAccessible: true,
      hasPayload: true,
      payloadDate: today,
      payloadUpdatedAt: "2026-02-12T09:00:00.000Z",
      payloadByteCount: 64,
      appGroupId: "group.com.darrylgraham.revolution",
      dataKey: "widget_tasks_data",
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    mocks.getWidgetSyncDiagnosticsMock.mockResolvedValueOnce(diagnosticsPayload);

    renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    const raw = window.sessionStorage.getItem(WIDGET_SYNC_DIAGNOSTICS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed).toMatchObject(diagnosticsPayload);
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("stores widget sync write errors in sessionStorage", async () => {
    const today = localDateString();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateWidgetDataMock.mockRejectedValueOnce({
      code: "PAYLOAD_WRITE_FAILED",
      message: "Failed to write widget payload",
    });

    renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    const raw = window.sessionStorage.getItem(WIDGET_SYNC_LAST_ERROR_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed).toMatchObject({
      code: "PAYLOAD_WRITE_FAILED",
      message: "Failed to write widget payload",
      source: "updateWidgetData",
    });
    expect(typeof parsed.timestamp).toBe("string");
    consoleErrorSpy.mockRestore();
  });

  it("stores diagnostics failures in sessionStorage", async () => {
    const today = localDateString();
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getWidgetSyncDiagnosticsMock.mockRejectedValueOnce({
      code: "DIAGNOSTICS_FAILED",
      message: "diagnostics failed",
    });

    renderHook(() => useWidgetSync([makeTask()], today));
    await flushEffects();

    const raw = window.sessionStorage.getItem(WIDGET_SYNC_LAST_ERROR_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed).toMatchObject({
      code: "DIAGNOSTICS_FAILED",
      message: "diagnostics failed",
      source: "getWidgetSyncDiagnostics",
    });
    expect(typeof parsed.timestamp).toBe("string");
    consoleWarnSpy.mockRestore();
  });
});
