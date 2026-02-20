import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const eqUserIdMock = vi.fn();
  const eqTaskDateMock = vi.fn();
  const orderSortOrderMock = vi.fn();
  const orderCreatedAtMock = vi.fn();

  return {
    selectMock,
    eqUserIdMock,
    eqTaskDateMock,
    orderSortOrderMock,
    orderCreatedAtMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mocks.selectMock,
    })),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

import { fetchDailyTasks, useTasksQuery } from "./useTasksQuery";

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

describe("fetchDailyTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectMock.mockReturnValue({
      eq: mocks.eqUserIdMock,
    });

    mocks.eqUserIdMock.mockReturnValue({
      eq: mocks.eqTaskDateMock,
    });

    mocks.eqTaskDateMock.mockReturnValue({
      order: mocks.orderSortOrderMock,
    });

    mocks.orderSortOrderMock.mockReturnValue({
      order: mocks.orderCreatedAtMock,
    });
  });

  it("maps and sorts subtasks by sort_order", async () => {
    mocks.orderCreatedAtMock.mockResolvedValueOnce({
      data: [
        {
          id: "task-1",
          user_id: "user-1",
          task_text: "Plan launch",
          difficulty: "medium",
          xp_reward: 40,
          task_date: "2026-02-13",
          completed: false,
          completed_at: null,
          is_main_quest: false,
          scheduled_time: null,
          estimated_duration: null,
          recurrence_pattern: null,
          recurrence_days: null,
          is_recurring: false,
          reminder_enabled: false,
          reminder_minutes_before: 15,
          reminder_sent: false,
          parent_template_id: null,
          category: "mind",
          is_bonus: false,
          created_at: "2026-02-13T00:00:00.000Z",
          priority: null,
          energy_level: null,
          is_top_three: null,
          actual_time_spent: null,
          ai_generated: null,
          context_id: null,
          source: null,
          habit_source_id: null,
          epic_id: null,
          sort_order: 0,
          contact_id: null,
          auto_log_interaction: null,
          image_url: null,
          notes: null,
          location: null,
          epics: { title: "Growth Sprint" },
          contact: { id: "contact-1", name: "Jordan", avatar_url: null },
          task_attachments: [
            {
              id: "att-1",
              task_id: "task-1",
              file_url: "https://example.com/att-1.png",
              file_path: "user/att-1.png",
              file_name: "att-1.png",
              mime_type: "image/png",
              file_size_bytes: 1000,
              is_image: true,
              sort_order: 0,
              created_at: "2026-02-13T00:00:00.000Z",
            },
          ],
          subtasks: [
            { id: "s3", title: "Ship", completed: false, sort_order: 2 },
            { id: "s1", title: "Research", completed: true, sort_order: 0 },
            { id: "s2", title: "Draft", completed: false, sort_order: 1 },
          ],
        },
      ],
      error: null,
    });

    const result = await fetchDailyTasks("user-1", "2026-02-13");

    expect(mocks.selectMock).toHaveBeenCalledWith(expect.stringContaining("subtasks(id, title, completed, sort_order)"));
    expect(result).toHaveLength(1);
    expect(result[0].epic_title).toBe("Growth Sprint");
    expect(result[0].contact?.name).toBe("Jordan");
    expect(result[0].attachments?.[0]?.fileUrl).toBe("https://example.com/att-1.png");
    expect(result[0].subtasks?.map((subtask) => subtask.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("retries without task_attachments when embedded relation is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mocks.orderCreatedAtMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST200",
          message: "Could not find a relationship between 'daily_tasks' and 'task_attachments' in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "task-2",
            user_id: "user-1",
            task_text: "Fallback works",
            difficulty: "easy",
            xp_reward: 12,
            task_date: "2026-02-13",
            completed: false,
            completed_at: null,
            is_main_quest: false,
            scheduled_time: "09:00",
            estimated_duration: 30,
            recurrence_pattern: null,
            recurrence_days: null,
            is_recurring: false,
            reminder_enabled: false,
            reminder_minutes_before: 15,
            reminder_sent: false,
            parent_template_id: null,
            category: "mind",
            is_bonus: false,
            created_at: "2026-02-13T00:00:00.000Z",
            priority: null,
            energy_level: null,
            is_top_three: null,
            actual_time_spent: null,
            ai_generated: null,
            context_id: null,
            source: "manual",
            habit_source_id: null,
            epic_id: null,
            sort_order: 0,
            contact_id: null,
            auto_log_interaction: null,
            image_url: null,
            notes: null,
            location: null,
            epics: null,
            contact: null,
            subtasks: [],
          },
        ],
        error: null,
      });

    const result = await fetchDailyTasks("user-1", "2026-02-13");

    expect(mocks.selectMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("task_attachments("),
    );
    expect(mocks.selectMock).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining("task_attachments("),
    );
    expect(result).toHaveLength(1);
    expect(result[0].task_text).toBe("Fallback works");
    expect(result[0].attachments).toEqual([]);

    warnSpy.mockRestore();
  });

  it("throws non-relation errors without fallback", async () => {
    const nonRelationError = {
      code: "42501",
      message: "permission denied for table daily_tasks",
      details: null,
      hint: null,
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.orderCreatedAtMock.mockResolvedValueOnce({
      data: null,
      error: nonRelationError,
    });

    await expect(fetchDailyTasks("user-1", "2026-02-13")).rejects.toBe(nonRelationError);
    expect(mocks.selectMock).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});

describe("useTasksQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when disabled", () => {
    const { result } = renderHook(
      () => useTasksQuery(new Date("2026-02-13T00:00:00.000Z"), { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.tasks).toEqual([]);
    expect(mocks.selectMock).not.toHaveBeenCalled();
  });
});
