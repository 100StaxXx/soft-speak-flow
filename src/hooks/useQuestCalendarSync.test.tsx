import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const questLinksEqMock = vi.fn();
  const outlookTaskLinksEqMock = vi.fn();
  const dailyTaskSingleMock = vi.fn();
  const functionsInvokeMock = vi.fn();
  const useCalendarIntegrationsMock = vi.fn();
  const dispatchPlannerSyncFinishedMock = vi.fn();

  return {
    questLinksEqMock,
    outlookTaskLinksEqMock,
    dailyTaskSingleMock,
    functionsInvokeMock,
    useCalendarIntegrationsMock,
    dispatchPlannerSyncFinishedMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: (...args: unknown[]) => mocks.useCalendarIntegrationsMock(...args),
}));

vi.mock("@/plugins/NativeCalendarPlugin", () => ({
  NativeCalendar: {
    isAvailable: vi.fn(),
    requestPermissions: vi.fn(),
    listCalendars: vi.fn(),
    createOrUpdateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "quest_calendar_links") {
        return {
          select: () => ({
            eq: mocks.questLinksEqMock,
          }),
          upsert: vi.fn(),
        };
      }

      if (table === "daily_tasks") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: mocks.dailyTaskSingleMock,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }

      if (table === "quest_outlook_task_links") {
        return {
          select: () => ({
            eq: mocks.outlookTaskLinksEqMock,
          }),
        };
      }

      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
    functions: {
      invoke: mocks.functionsInvokeMock,
    },
  },
}));

vi.mock("@/utils/plannerSync", () => ({
  dispatchPlannerSyncFinished: (...args: unknown[]) => mocks.dispatchPlannerSyncFinishedMock(...args),
}));

import { useQuestCalendarSync } from "./useQuestCalendarSync";

const recurrenceColumnsMissingError = {
  code: "PGRST204",
  message: "Could not find the 'recurrence_custom_period' column of 'daily_tasks' in the schema cache",
  details: null,
  hint: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useQuestCalendarSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-1",
          provider: "google",
          calendar_email: "user@example.com",
          primary_calendar_id: "primary-calendar",
          primary_calendar_name: "Primary Calendar",
          sync_mode: "send_only",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "google",
    });
    mocks.questLinksEqMock.mockResolvedValue({ data: [], error: null });
    mocks.outlookTaskLinksEqMock.mockResolvedValue({ data: [], error: null });
    mocks.functionsInvokeMock.mockResolvedValue({ data: null, error: null });
  });

  it("does not fetch quest links when disabled", () => {
    const { result } = renderHook(() => useQuestCalendarSync({ enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(mocks.useCalendarIntegrationsMock).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.questLinksEqMock).not.toHaveBeenCalled();
    expect(result.current.links).toEqual([]);
  });

  it("throws TASK_DATE_REQUIRED when sending a task with no date", async () => {
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-1",
        task_text: "No date quest",
        task_date: null,
        scheduled_time: null,
        estimated_duration: 30,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-1" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("TASK_DATE_REQUIRED");
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("falls back to legacy task select when recurrence columns are missing", async () => {
    mocks.dailyTaskSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: recurrenceColumnsMissingError,
      })
      .mockResolvedValueOnce({
        data: {
          id: "task-fallback-1",
          task_text: "Legacy schema quest",
          task_date: "2026-02-12",
          scheduled_time: "09:00",
          estimated_duration: 30,
          recurrence_pattern: "weekly",
          recurrence_days: [1],
          location: null,
          notes: null,
        },
        error: null,
      });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-fallback-1" });
    });

    expect(mocks.dailyTaskSingleMock).toHaveBeenCalledTimes(2);
    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("google-calendar-events", {
      body: {
        action: "createLinkedEvent",
        taskId: "task-fallback-1",
        syncMode: "send_only",
      },
    });
  });

  it("throws SCHEDULED_TIME_REQUIRED when sending a task with date but no time", async () => {
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-2",
        task_text: "No time quest",
        task_date: "2026-02-12",
        scheduled_time: null,
        estimated_duration: 30,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-2" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("SCHEDULED_TIME_REQUIRED");
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("throws MULTI_DAY_MONTHLY_UNSUPPORTED for month-based recurrence with multiple days", async () => {
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-monthly-1",
        task_text: "Monthly multi-day quest",
        task_date: "2026-02-12",
        scheduled_time: "09:00",
        estimated_duration: 30,
        recurrence_pattern: "monthly",
        recurrence_days: [],
        recurrence_month_days: [1, 15],
        recurrence_custom_period: null,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-monthly-1" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("MULTI_DAY_MONTHLY_UNSUPPORTED");
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("falls back to a connected provider when default provider is stale", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-1",
          provider: "google",
          calendar_email: "user@example.com",
          primary_calendar_id: "primary-calendar",
          primary_calendar_name: "Primary Calendar",
          sync_mode: "send_only",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-3",
        task_text: "Fallback provider quest",
        task_date: "2026-02-12",
        scheduled_time: "09:00",
        estimated_duration: 30,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-3" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("google-calendar-events", {
      body: {
        action: "createLinkedEvent",
        taskId: "task-3",
        syncMode: "send_only",
      },
    });
  });

  it("throws NO_CALENDAR_CONNECTION when no providers are connected", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [],
      defaultProvider: "google",
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-4" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("NO_CALENDAR_CONNECTION");
    expect(mocks.dailyTaskSingleMock).not.toHaveBeenCalled();
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("routes unscheduled Outlook tasks to Outlook To Do", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-outlook-1",
          provider: "outlook",
          calendar_email: "user@example.com",
          primary_calendar_id: "calendar-1",
          primary_calendar_name: "Calendar",
          sync_mode: "send_only",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-5",
        task_text: "Inbox quest",
        task_date: null,
        scheduled_time: null,
        estimated_duration: 30,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-5" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("outlook-todo-tasks", {
      body: {
        action: "createLinkedTask",
        taskId: "task-5",
        syncMode: "send_only",
      },
    });
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalledWith(
      "outlook-calendar-events",
      expect.anything(),
    );
  });

  it("routes scheduled Outlook tasks to Outlook calendar events", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-outlook-2",
          provider: "outlook",
          calendar_email: "user@example.com",
          primary_calendar_id: "calendar-2",
          primary_calendar_name: "Calendar",
          sync_mode: "send_only",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-6",
        task_text: "Scheduled quest",
        task_date: "2026-02-12",
        scheduled_time: "09:00",
        estimated_duration: 45,
        location: null,
        notes: null,
      },
      error: null,
    });
    mocks.functionsInvokeMock.mockResolvedValueOnce({
      data: {
        link: {
          externalCalendarId: "calendar-2",
          externalEventId: "event-2",
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let sendResult: Awaited<ReturnType<typeof result.current.sendTaskToCalendar.mutateAsync>> | null = null;
    await act(async () => {
      sendResult = await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-6" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("outlook-calendar-events", {
      body: {
        action: "createLinkedEvent",
        taskId: "task-6",
        syncMode: "send_only",
      },
    });
    expect(sendResult).toEqual({
      provider: "outlook",
      providerLabel: "Outlook",
      destinationKind: "calendar",
      destinationName: "Calendar",
      externalId: "event-2",
    });
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalledWith(
      "outlook-todo-tasks",
      expect.objectContaining({
        body: expect.objectContaining({ action: "createLinkedTask" }),
      }),
    );
  });

  it("requires a default provider before sending when multiple providers are connected", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-google",
          provider: "google",
          calendar_email: "user@gmail.com",
          primary_calendar_id: "google-primary",
          primary_calendar_name: "Google Primary",
          sync_mode: "send_only",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
        {
          id: "conn-outlook",
          provider: "outlook",
          calendar_email: "user@outlook.com",
          primary_calendar_id: "outlook-calendar",
          primary_calendar_name: "Outlook Calendar",
          sync_mode: "send_only",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-multi-provider" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("CALENDAR_DEFAULT_REQUIRED");
    expect(mocks.dailyTaskSingleMock).not.toHaveBeenCalled();
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("full sync pull for Outlook invokes both calendar and To Do providers", async () => {
    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.syncProviderPull.mutateAsync({ provider: "outlook" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(1, "outlook-calendar-events", {
      body: {
        action: "syncLinkedChanges",
      },
    });
    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(2, "outlook-todo-tasks", {
      body: {
        action: "syncLinkedChanges",
      },
    });
    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(3, "outlook-calendar-events", {
      body: {
        action: "syncPlannerWindow",
      },
    });
    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(4, "outlook-todo-tasks", {
      body: {
        action: "syncPlannerTasks",
      },
    });
  });

  it("full sync update pushes linked Outlook To Do tasks", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-outlook-3",
          provider: "outlook",
          calendar_email: "user@example.com",
          primary_calendar_id: "calendar-3",
          primary_calendar_name: "Calendar",
          sync_mode: "full_sync",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.outlookTaskLinksEqMock.mockResolvedValue({
      data: [
        {
          id: "otl-1",
          task_id: "task-7",
          user_id: "user-1",
          connection_id: "conn-outlook-3",
          provider: "outlook",
          external_task_list_id: "list-1",
          external_task_id: "todo-1",
          sync_mode: "full_sync",
          last_app_sync_at: null,
          last_provider_sync_at: null,
        },
      ],
      error: null,
    });
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-7",
        task_text: "Outlook linked",
        task_date: null,
        scheduled_time: null,
        estimated_duration: 20,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.outlookTaskLinks).toHaveLength(1);
    });

    await act(async () => {
      await result.current.syncTaskUpdate.mutateAsync({ taskId: "task-7" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("outlook-todo-tasks", {
      body: {
        action: "updateLinkedTask",
        taskId: "task-7",
        syncMode: "full_sync",
      },
    });
  });

  it("uses current provider full sync mode for older send-only Outlook calendar links", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-outlook-current-full-sync",
          provider: "outlook",
          calendar_email: "user@example.com",
          primary_calendar_id: "calendar-current",
          primary_calendar_name: "Calendar",
          sync_mode: "full_sync",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.questLinksEqMock.mockResolvedValue({
      data: [
        {
          id: "qcl-send-only-1",
          task_id: "task-current-full-sync",
          user_id: "user-1",
          connection_id: "conn-outlook-current-full-sync",
          provider: "outlook",
          external_calendar_id: "calendar-current",
          external_event_id: "event-current",
          sync_mode: "send_only",
          last_app_sync_at: null,
          last_provider_sync_at: null,
        },
      ],
      error: null,
    });
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-current-full-sync",
        task_text: "Moved linked quest",
        task_date: "2026-02-12",
        scheduled_time: "10:00",
        estimated_duration: 30,
        recurrence_pattern: null,
        recurrence_days: [],
        recurrence_month_days: [],
        recurrence_custom_period: null,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.links).toHaveLength(1);
    });

    await act(async () => {
      await result.current.syncTaskUpdate.mutateAsync({ taskId: "task-current-full-sync" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("outlook-calendar-events", {
      body: {
        action: "updateLinkedEvent",
        taskId: "task-current-full-sync",
        syncMode: "full_sync",
      },
    });
  });

  it("full sync delete removes linked Outlook To Do tasks", async () => {
    mocks.outlookTaskLinksEqMock.mockResolvedValue({
      data: [
        {
          id: "otl-2",
          task_id: "task-8",
          user_id: "user-1",
          connection_id: "conn-outlook-4",
          provider: "outlook",
          external_task_list_id: "list-2",
          external_task_id: "todo-2",
          sync_mode: "full_sync",
          last_app_sync_at: null,
          last_provider_sync_at: null,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.outlookTaskLinks).toHaveLength(1);
    });

    await act(async () => {
      await result.current.syncTaskDelete.mutateAsync({ taskId: "task-8" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("outlook-todo-tasks", {
      body: {
        action: "deleteLinkedTask",
        taskId: "task-8",
      },
    });
  });

  it("migrates a timed Outlook quest from To Do to Calendar", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-outlook-5",
          provider: "outlook",
          calendar_email: "user@example.com",
          primary_calendar_id: "calendar-5",
          primary_calendar_name: "Calendar",
          sync_mode: "full_sync",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.outlookTaskLinksEqMock.mockResolvedValue({
      data: [
        {
          id: "otl-3",
          task_id: "task-9",
          user_id: "user-1",
          connection_id: "conn-outlook-5",
          provider: "outlook",
          external_task_list_id: "list-5",
          external_task_id: "todo-5",
          sync_mode: "full_sync",
          last_app_sync_at: null,
          last_provider_sync_at: null,
        },
      ],
      error: null,
    });
    mocks.dailyTaskSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-9",
        task_text: "Now time-blocked",
        task_date: "2026-02-12",
        scheduled_time: "10:00",
        estimated_duration: 30,
        recurrence_pattern: null,
        recurrence_days: [],
        recurrence_month_days: [],
        recurrence_custom_period: null,
        location: null,
        notes: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.outlookTaskLinks).toHaveLength(1);
    });

    await act(async () => {
      await result.current.syncTaskUpdate.mutateAsync({ taskId: "task-9" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(1, "outlook-todo-tasks", {
      body: {
        action: "deleteLinkedTask",
        taskId: "task-9",
      },
    });
    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(2, "outlook-calendar-events", {
      body: {
        action: "createLinkedEvent",
        taskId: "task-9",
        syncMode: "full_sync",
      },
    });
  });

  it("syncs Outlook planner context and notifies planner listeners", async () => {
    mocks.useCalendarIntegrationsMock.mockReturnValue({
      connections: [
        {
          id: "conn-outlook-6",
          provider: "outlook",
          calendar_email: "user@example.com",
          primary_calendar_id: "calendar-6",
          primary_calendar_name: "Calendar",
          sync_mode: "full_sync",
          sync_enabled: true,
          platform: "web",
          last_synced_at: null,
        },
      ],
      defaultProvider: "outlook",
    });
    mocks.functionsInvokeMock
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              id: "evt-1",
              title: "Focus block",
              start: "2026-04-19T10:00:00.000Z",
              end: "2026-04-19T11:00:00.000Z",
              isAllDay: false,
              provider: "outlook",
              readOnly: true,
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: "task-10",
              task_text: "Inbox follow-up",
              task_date: null,
              scheduled_time: null,
              estimated_duration: null,
              recurrence_pattern: null,
              source: "outlook_sync",
              subtasks: [],
            },
          ],
          removedTaskIds: ["task-old"],
        },
        error: null,
      });

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    let syncResult: Awaited<ReturnType<typeof result.current.syncPlanningContext.mutateAsync>> | null = null;
    await act(async () => {
      syncResult = await result.current.syncPlanningContext.mutateAsync({
        startDate: "2026-04-19",
        endDate: "2026-04-25",
      });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(1, "outlook-calendar-events", {
      body: {
        action: "syncPlannerWindow",
        startDate: "2026-04-19",
        endDate: "2026-04-25",
      },
    });
    expect(mocks.functionsInvokeMock).toHaveBeenNthCalledWith(2, "outlook-todo-tasks", {
      body: {
        action: "syncPlannerTasks",
      },
    });
    expect(syncResult).toEqual({
      calendarEvents: [
        {
          id: "evt-1",
          title: "Focus block",
          start: "2026-04-19T10:00:00.000Z",
          end: "2026-04-19T11:00:00.000Z",
          isAllDay: false,
          provider: "outlook",
          readOnly: true,
        },
      ],
      tasks: [
        {
          id: "task-10",
          task_text: "Inbox follow-up",
          task_date: null,
          scheduled_time: null,
          estimated_duration: null,
          recurrence_pattern: null,
          source: "outlook_sync",
          subtasks: [],
        },
      ],
      removedTaskIds: ["task-old"],
    });
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(1);
  });
});
