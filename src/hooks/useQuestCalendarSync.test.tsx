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

  return {
    questLinksEqMock,
    outlookTaskLinksEqMock,
    dailyTaskSingleMock,
    functionsInvokeMock,
    useCalendarIntegrationsMock,
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

import { useQuestCalendarSync } from "./useQuestCalendarSync";

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

    const { result } = renderHook(() => useQuestCalendarSync(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendTaskToCalendar.mutateAsync({ taskId: "task-6" });
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("outlook-calendar-events", {
      body: {
        action: "createLinkedEvent",
        taskId: "task-6",
        syncMode: "send_only",
      },
    });
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalledWith(
      "outlook-todo-tasks",
      expect.objectContaining({
        body: expect.objectContaining({ action: "createLinkedTask" }),
      }),
    );
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
  });

  it("full sync update pushes linked Outlook To Do tasks", async () => {
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
});
