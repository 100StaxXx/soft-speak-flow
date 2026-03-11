import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const templatesQueryMock = vi.fn();
  const existingTasksQueryMock = vi.fn();
  const upsertSelectMock = vi.fn();
  const upsertMock = vi.fn();
  const toastErrorMock = vi.fn();

  return {
    fromMock,
    templatesQueryMock,
    existingTasksQueryMock,
    upsertSelectMock,
    upsertMock,
    toastErrorMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
  },
}));

import { useRecurringTaskSpawner } from "./useRecurringTaskSpawner";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useRecurringTaskSpawner spawn behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.templatesQueryMock.mockResolvedValue({
      data: [
        {
          id: "template-1",
          task_text: "No time recurring",
          difficulty: "medium",
          task_date: "2026-02-01",
          created_at: "2026-02-01T12:00:00.000Z",
          scheduled_time: null,
          estimated_duration: 30,
          category: null,
          recurrence_pattern: "daily",
          recurrence_days: null,
          recurrence_month_days: null,
          recurrence_custom_period: null,
          recurrence_end_date: null,
          xp_reward: 50,
          epic_id: null,
          reminder_enabled: false,
          reminder_minutes_before: null,
        },
        {
          id: "template-2",
          task_text: "Timed recurring",
          difficulty: "medium",
          task_date: "2026-02-01",
          created_at: "2026-02-01T12:00:00.000Z",
          scheduled_time: "09:00",
          estimated_duration: 30,
          category: null,
          recurrence_pattern: "daily",
          recurrence_days: null,
          recurrence_month_days: null,
          recurrence_custom_period: null,
          recurrence_end_date: null,
          xp_reward: 50,
          epic_id: null,
          reminder_enabled: false,
          reminder_minutes_before: null,
        },
      ],
      error: null,
    });

    mocks.existingTasksQueryMock.mockResolvedValue({
      data: [],
      error: null,
    });

    mocks.upsertSelectMock.mockResolvedValue({
      data: [{ id: "spawned-1" }],
      error: null,
    });

    mocks.upsertMock.mockImplementation(() => ({
      select: mocks.upsertSelectMock,
    }));

    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "daily_tasks") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: (selection: string) => {
          if (selection.includes("parent_template_id")) {
            return {
              eq: () => ({
                eq: mocks.existingTasksQueryMock,
              }),
            };
          }

          return {
            eq: () => ({
              eq: () => ({
                not: mocks.templatesQueryMock,
              }),
            }),
          };
        },
        upsert: mocks.upsertMock,
      };
    });
  });

  it("skips invalid templates without scheduled_time and shows an actionable toast", async () => {
    const { result } = renderHook(
      () => useRecurringTaskSpawner(new Date("2026-02-09T09:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pendingRecurringCount).toBe(2);
    });

    act(() => {
      result.current.spawnRecurringTasks();
    });

    await waitFor(() => {
      expect(mocks.upsertMock).toHaveBeenCalledTimes(1);
    });

    const upsertPayload = mocks.upsertMock.mock.calls[0]?.[0];
    expect(upsertPayload).toHaveLength(1);
    expect(upsertPayload[0]).toEqual(expect.objectContaining({
      parent_template_id: "template-2",
      scheduled_time: "09:00",
    }));

    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Set a time on recurring quest templates to resume auto-creation.",
    );
    expect(mocks.toastErrorMock).not.toHaveBeenCalledWith("Failed to create recurring quests");
  });
});
