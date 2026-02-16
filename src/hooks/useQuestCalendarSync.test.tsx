import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const questLinksEqMock = vi.fn();
  const dailyTaskSingleMock = vi.fn();
  const functionsInvokeMock = vi.fn();
  const useCalendarIntegrationsMock = vi.fn();

  return {
    questLinksEqMock,
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
});
