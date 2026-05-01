import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetOfflineDBForTests,
  clearAllPendingActions,
  enqueueAction,
  initOfflineDB,
  updateQueuedAction,
} from "@/utils/offlineStorage";

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  isNativePlatform: vi.fn(() => false),
  toast: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
  trackResilienceEvent: vi.fn(),
  dispatchPlannerSyncFinished: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNativePlatform(),
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (...args: unknown[]) => mocks.addListener(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.from(...args),
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/utils/resilienceTelemetry", () => ({
  trackResilienceEvent: (...args: unknown[]) => mocks.trackResilienceEvent(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  dispatchPlannerSyncFinished: () => mocks.dispatchPlannerSyncFinished(),
}));

import { useOfflineQueue } from "./useOfflineQueue";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

const enqueueFailedSupportReport = async (retryCount: number) => {
  await initOfflineDB();
  const id = await enqueueAction({
    userId: "user-1",
    actionKind: "SUPPORT_REPORT",
    entityType: "support_report",
    entityId: "corr-1",
    payload: {
      correlationId: "corr-1",
      summary: "Queued support report",
    },
  });

  await updateQueuedAction(id, {
    status: "failed",
    retry_count: retryCount,
    last_error: "Network request failed",
  });

  return id;
};

const enqueueQueuedSupportReport = async () => {
  await initOfflineDB();
  return enqueueAction({
    userId: "user-1",
    actionKind: "SUPPORT_REPORT",
    entityType: "support_report",
    entityId: "corr-queued",
    payload: {
      correlationId: "corr-queued",
      summary: "Queued support report",
    },
  });
};

describe("useOfflineQueue", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
    mocks.from.mockReset();
    setOnline(true);
    await clearAllPendingActions();
  });

  afterEach(async () => {
    if (originalOnlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
    }
    if (originalVisibilityStateDescriptor) {
      Object.defineProperty(document, "visibilityState", originalVisibilityStateDescriptor);
    }
    await clearAllPendingActions();
    __resetOfflineDBForTests();
  });

  it("manually retries failed actions even after they hit the auto-retry limit", async () => {
    const id = await enqueueFailedSupportReport(3);
    mocks.invoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
    });

    await act(async () => {
      await result.current.triggerSync();
    });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("submit-support-report", {
        body: expect.objectContaining({
          correlationId: "corr-1",
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.syncStatus).toBe("success");
    });

    expect(result.current.receipts.find((receipt) => receipt.id === id)?.status).toBe("synced");
  });

  it("keeps syncStatus in error when skipped failed actions remain", async () => {
    const id = await enqueueFailedSupportReport(3);

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
    });

    await act(async () => {
      await result.current.syncPendingActions();
    });

    expect(mocks.invoke).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.syncStatus).toBe("error");
      expect(result.current.lastSyncError).toBe("1 action needs retry.");
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.receipts.find((receipt) => receipt.id === id)?.status).toBe("failed");
  });

  it("auto-syncs queued actions during initialization when already online", async () => {
    await enqueueQueuedSupportReport();
    mocks.invoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("submit-support-report", {
        body: expect.objectContaining({
          correlationId: "corr-queued",
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.syncStatus).toBe("success");
    });
  });

  it("retries queued actions when the tab becomes visible again", async () => {
    await enqueueQueuedSupportReport();
    mocks.invoke.mockResolvedValue({ data: null, error: null });
    setOnline(false);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
    });

    expect(mocks.invoke).not.toHaveBeenCalled();

    setOnline(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("submit-support-report", {
        body: expect.objectContaining({
          correlationId: "corr-queued",
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
  });

  it("sanitizes queued EPIC_CREATE payloads before upserting epics remotely", async () => {
    await initOfflineDB();
    await enqueueAction({
      userId: "user-1",
      actionKind: "EPIC_CREATE",
      entityType: "epic",
      entityId: "epic-1",
      payload: {
        epic: {
          id: "epic-1",
          user_id: "user-1",
          title: "Queued Campaign",
          description: null,
          status: "active",
          progress_percentage: 0,
          target_days: 30,
          start_date: "2026-04-11",
          end_date: "2026-05-11",
          xp_reward: 300,
          invite_code: "EPIC-TEST",
          theme_color: "heroic",
          created_at: "2026-04-11T00:00:00.000Z",
          epic_habits: [],
        },
        habits: [],
        epicHabits: [],
        phases: [],
        milestones: [],
      },
    });

    const epicsUpsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "epics") {
        return {
          upsert: epicsUpsertMock,
        };
      }

      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(epicsUpsertMock).toHaveBeenCalledTimes(1);
    });

    expect(epicsUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "epic-1",
      user_id: "user-1",
      title: "Queued Campaign",
    }));
    expect(epicsUpsertMock.mock.calls[0]?.[0]).not.toHaveProperty("epic_habits");

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.syncStatus).toBe("success");
    });
  });

  it("replays queued EPIC_RITUAL_CREATE actions by upserting the habit before the epic link", async () => {
    await initOfflineDB();
    await enqueueAction({
      userId: "user-1",
      actionKind: "EPIC_RITUAL_CREATE",
      entityType: "epic",
      entityId: "epic-1",
      payload: {
        habit: {
          id: "habit-1",
          user_id: "user-1",
          title: "Queued Ritual",
          difficulty: "medium",
          frequency: "daily",
          custom_days: [0, 1, 2, 3, 4, 5, 6],
          custom_month_days: null,
          reminder_enabled: false,
          reminder_minutes_before: 15,
          is_active: true,
          current_streak: 0,
          longest_streak: 0,
          created_at: "2026-04-11T00:00:00.000Z",
        },
        epicHabit: {
          id: "epic-habit-1",
          epic_id: "epic-1",
          habit_id: "habit-1",
        },
      },
    });

    const habitsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicHabitsUpsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          upsert: habitsUpsertMock,
        };
      }

      if (table === "epic_habits") {
        return {
          upsert: epicHabitsUpsertMock,
        };
      }

      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(habitsUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
        id: "habit-1",
        title: "Queued Ritual",
      }));
    });

    expect(epicHabitsUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "epic-habit-1",
      epic_id: "epic-1",
      habit_id: "habit-1",
    }));

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.syncStatus).toBe("success");
    });
  });

  it("replays queued EPIC_DELETE actions by cleaning up linked records before deleting the epic", async () => {
    await initOfflineDB();
    await enqueueAction({
      userId: "user-1",
      actionKind: "EPIC_DELETE",
      entityType: "epic",
      entityId: "epic-1",
      payload: {
        epicId: "epic-1",
      },
    });

    const epicHabitsEqMock = vi.fn().mockResolvedValue({
      data: [
        { id: "link-1", habit_id: "habit-1" },
      ],
      error: null,
    });
    const epicHabitsSelectMock = vi.fn().mockReturnValue({
      eq: epicHabitsEqMock,
    });
    const dailyTasksCompletedOrMock = vi.fn().mockResolvedValue({ error: null });
    const dailyTasksEpicIdEqMock = vi.fn().mockReturnValue({
      or: dailyTasksCompletedOrMock,
    });
    const dailyTasksUserEqMock = vi.fn().mockReturnValue({
      eq: dailyTasksEpicIdEqMock,
    });
    const dailyTasksHabitCompletedOrMock = vi.fn().mockResolvedValue({ error: null });
    const dailyTasksHabitInMock = vi.fn().mockReturnValue({
      or: dailyTasksHabitCompletedOrMock,
    });
    const dailyTasksHabitUserEqMock = vi.fn().mockReturnValue({
      in: dailyTasksHabitInMock,
    });
    const dailyTasksDeleteCompletedOrMock = vi.fn().mockResolvedValue({ error: null });
    const dailyTasksDeleteCompletedAtIsMock = vi.fn().mockReturnValue({
      or: dailyTasksDeleteCompletedOrMock,
    });
    const dailyTasksDeleteInMock = vi.fn().mockReturnValue({
      is: dailyTasksDeleteCompletedAtIsMock,
    });
    const dailyTasksDeleteUserEqMock = vi.fn().mockReturnValue({
      in: dailyTasksDeleteInMock,
    });
    const dailyTasksUpdateMock = vi.fn()
      .mockReturnValueOnce({ eq: dailyTasksUserEqMock })
      .mockReturnValueOnce({ eq: dailyTasksHabitUserEqMock });
    const dailyTasksDeleteMock = vi.fn().mockReturnValue({
      eq: dailyTasksDeleteUserEqMock,
    });
    const habitsInMock = vi.fn().mockResolvedValue({ error: null });
    const habitsUserEqMock = vi.fn().mockReturnValue({
      in: habitsInMock,
    });
    const milestonesUserEqMock = vi.fn().mockResolvedValue({ error: null });
    const milestonesEqMock = vi.fn().mockReturnValue({
      eq: milestonesUserEqMock,
    });
    const phasesUserEqMock = vi.fn().mockResolvedValue({ error: null });
    const phasesEqMock = vi.fn().mockReturnValue({
      eq: phasesUserEqMock,
    });
    const linksInMock = vi.fn().mockResolvedValue({ error: null });
    const epicDeleteUserEqMock = vi.fn().mockResolvedValue({ error: null });
    const epicDeleteEqMock = vi.fn().mockReturnValue({
      eq: epicDeleteUserEqMock,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "epic_habits") {
        return {
          select: epicHabitsSelectMock,
          delete: vi.fn().mockReturnValue({
            in: linksInMock,
          }),
        };
      }

      if (table === "daily_tasks") {
        return {
          update: dailyTasksUpdateMock,
          delete: dailyTasksDeleteMock,
        };
      }

      if (table === "habits") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: habitsUserEqMock,
          }),
        };
      }

      if (table === "epic_milestones") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: milestonesEqMock,
          }),
        };
      }

      if (table === "journey_phases") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: phasesEqMock,
          }),
        };
      }

      if (table === "epics") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: epicDeleteEqMock,
          }),
        };
      }

      return {};
    });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(epicHabitsSelectMock).toHaveBeenCalledWith("id, habit_id");
    });

    expect(dailyTasksUpdateMock).toHaveBeenNthCalledWith(1, {
      epic_id: null,
      epic_title: null,
      habit_source_id: null,
    });
    expect(dailyTasksUpdateMock).toHaveBeenNthCalledWith(2, {
      epic_id: null,
      epic_title: null,
      habit_source_id: null,
    });
    expect(dailyTasksDeleteMock).toHaveBeenCalled();
    expect(habitsInMock).toHaveBeenCalledWith("id", ["habit-1"]);
    expect(linksInMock).toHaveBeenCalledWith("id", ["link-1"]);
    expect(epicDeleteEqMock).toHaveBeenCalledWith("id", "epic-1");

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.syncStatus).toBe("success");
    });
  });
});
