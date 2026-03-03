import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const templateQueryResultMock = vi.fn();
  const existingTasksQueryResultMock = vi.fn();
  const toastErrorMock = vi.fn();

  return {
    fromMock,
    templateQueryResultMock,
    existingTasksQueryResultMock,
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

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useRecurringTaskSpawner schema fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.templateQueryResultMock
      .mockResolvedValueOnce({
        data: null,
        error: recurrenceColumnsMissingError,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "template-1",
            task_text: "Legacy recurring quest",
            difficulty: "medium",
            task_date: "2026-02-01",
            created_at: "2026-02-01T12:00:00.000Z",
            scheduled_time: "09:00",
            estimated_duration: 30,
            category: null,
            recurrence_pattern: "daily",
            recurrence_days: null,
            recurrence_end_date: null,
            xp_reward: 50,
            epic_id: null,
            reminder_enabled: false,
            reminder_minutes_before: null,
          },
        ],
        error: null,
      });
    mocks.existingTasksQueryResultMock.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "daily_tasks") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: (selection: string) => {
          if (selection.includes("parent_template_id")) {
            return {
              eq: () => ({
                eq: mocks.existingTasksQueryResultMock,
              }),
            };
          }

          return {
            eq: () => ({
              eq: () => ({
                not: mocks.templateQueryResultMock,
              }),
            }),
          };
        },
      };
    });
  });

  it("retries recurring template fetch without month recurrence columns", async () => {
    const { result } = renderHook(
      () => useRecurringTaskSpawner(new Date("2026-02-09T09:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pendingRecurringCount).toBe(1);
    });

    expect(mocks.templateQueryResultMock).toHaveBeenCalledTimes(2);
    expect(mocks.toastErrorMock).not.toHaveBeenCalled();
  });
});
