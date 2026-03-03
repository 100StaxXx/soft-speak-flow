import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const toastMock = vi.fn();
  const showXPToastMock = vi.fn();
  const awardCustomXPMock = vi.fn();
  const updateDisciplineFromRitualMock = vi.fn();
  const trackTaskCreationMock = vi.fn();
  const trackTaskCompletionMock = vi.fn();
  const queueTaskActionMock = vi.fn();
  const reportApiFailureMock = vi.fn();

  const dailyTasksCountExecuteMock = vi.fn();
  const dailyTasksInsertMock = vi.fn();
  const dailyTasksInsertSingleMock = vi.fn();
  const dailyTasksDeleteExecuteMock = vi.fn();
  const dailyTasksFetchSchedulingSingleMock = vi.fn();
  const dailyTasksUpdateMock = vi.fn();
  const dailyTasksUpdateExecuteMock = vi.fn();
  const taskAttachmentsDeleteExecuteMock = vi.fn();
  const taskAttachmentsInsertExecuteMock = vi.fn();

  return {
    fromMock,
    toastMock,
    showXPToastMock,
    awardCustomXPMock,
    updateDisciplineFromRitualMock,
    trackTaskCreationMock,
    trackTaskCompletionMock,
    queueTaskActionMock,
    reportApiFailureMock,
    dailyTasksCountExecuteMock,
    dailyTasksInsertMock,
    dailyTasksInsertSingleMock,
    dailyTasksDeleteExecuteMock,
    dailyTasksFetchSchedulingSingleMock,
    dailyTasksUpdateMock,
    dailyTasksUpdateExecuteMock,
    taskAttachmentsDeleteExecuteMock,
    taskAttachmentsInsertExecuteMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
  }),
}));

vi.mock("@/hooks/useCompanionAttributes", () => ({
  useCompanionAttributes: () => ({
    updateDisciplineFromRitual: mocks.updateDisciplineFromRitualMock,
  }),
}));

vi.mock("@/contexts/XPContext", () => ({
  useXPToast: () => ({
    showXPToast: mocks.showXPToastMock,
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: mocks.awardCustomXPMock,
  }),
}));

vi.mock("@/hooks/useSchedulingLearner", () => ({
  useSchedulingLearner: () => ({
    trackTaskCompletion: mocks.trackTaskCompletionMock,
    trackTaskCreation: mocks.trackTaskCreationMock,
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    shouldQueueWrites: false,
    queueTaskAction: mocks.queueTaskActionMock,
    reportApiFailure: mocks.reportApiFailureMock,
  }),
}));

import {
  isTaskAttachmentsTableMissingError,
  useTaskMutations,
} from "./useTaskMutations";

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

const buildAttachment = () => ({
  fileUrl: "https://example.com/attachment.png",
  filePath: "user-1/attachment.png",
  fileName: "attachment.png",
  mimeType: "image/png",
  fileSizeBytes: 1234,
  isImage: true,
  sortOrder: 0,
});

const taskAttachmentsMissingTableError = {
  code: "PGRST205",
  message: "Could not find the table 'public.task_attachments' in the schema cache",
  details: null,
  hint: null,
};

const dailyTasksRecurrenceColumnsMissingError = {
  code: "PGRST204",
  message: "Could not find the 'recurrence_custom_period' column of 'daily_tasks' in the schema cache",
  details: null,
  hint: null,
};

describe("isTaskAttachmentsTableMissingError", () => {
  it("returns true for missing task_attachments schema-cache errors", () => {
    expect(isTaskAttachmentsTableMissingError(taskAttachmentsMissingTableError)).toBe(true);
  });

  it("returns false for generic insert errors", () => {
    expect(
      isTaskAttachmentsTableMissingError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: null,
        hint: null,
      }),
    ).toBe(false);
  });
});

describe("useTaskMutations attachment handling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.dailyTasksCountExecuteMock.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.dailyTasksInsertSingleMock.mockResolvedValue({
      data: {
        id: "task-1",
        user_id: "user-1",
        task_text: "Ship feature",
        difficulty: "medium",
        task_date: "2026-02-20",
        scheduled_time: "13:00",
        category: "mind",
      },
      error: null,
    });
    mocks.dailyTasksDeleteExecuteMock.mockResolvedValue({ error: null });
    mocks.dailyTasksFetchSchedulingSingleMock.mockResolvedValue({
      data: {
        task_date: null,
        scheduled_time: null,
        habit_source_id: null,
        source: "inbox",
      },
      error: null,
    });
    mocks.dailyTasksUpdateExecuteMock.mockResolvedValue({ error: null });
    mocks.taskAttachmentsDeleteExecuteMock.mockResolvedValue({ error: null });
    mocks.taskAttachmentsInsertExecuteMock.mockResolvedValue({ error: null });
    mocks.dailyTasksInsertMock.mockImplementation(() => ({
      select: vi.fn(() => ({
        single: mocks.dailyTasksInsertSingleMock,
      })),
    }));

    mocks.dailyTasksUpdateMock.mockReturnValue({
      eq: vi.fn(() => ({
        eq: mocks.dailyTasksUpdateExecuteMock,
      })),
    });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "daily_tasks") {
        return {
          select: vi.fn((selection?: string) => {
            if (selection === "task_date, scheduled_time, habit_source_id, source") {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: mocks.dailyTasksFetchSchedulingSingleMock,
                  })),
                })),
              };
            }

            return {
              eq: vi.fn(() => ({
                eq: mocks.dailyTasksCountExecuteMock,
                is: mocks.dailyTasksCountExecuteMock,
              })),
            };
          }),
          insert: mocks.dailyTasksInsertMock,
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mocks.dailyTasksDeleteExecuteMock,
            })),
          })),
          update: mocks.dailyTasksUpdateMock,
        };
      }

      if (table === "task_attachments") {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mocks.taskAttachmentsDeleteExecuteMock,
            })),
          })),
          insert: mocks.taskAttachmentsInsertExecuteMock,
        };
      }

      if (table === "subtasks") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(),
            is: vi.fn(),
          })),
        })),
        insert: vi.fn(),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(),
          })),
        })),
      };
    });
  });

  it("creates a quest when task_attachments table is missing and shows warning", async () => {
    mocks.taskAttachmentsDeleteExecuteMock.mockResolvedValue({
      error: taskAttachmentsMissingTableError,
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    let createdTask: any;
    await act(async () => {
      createdTask = await result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
        attachments: [buildAttachment()],
      });
    });

    expect(createdTask?.id).toBe("task-1");
    expect(createdTask?.attachmentsSkippedDueToSchema).toBe(true);
    expect(mocks.taskAttachmentsInsertExecuteMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Quest added!" }));
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Attachments unavailable" }));
  });

  it("retries basic custom-week creation without month recurrence columns when schema lags", async () => {
    mocks.dailyTasksInsertSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: dailyTasksRecurrenceColumnsMissingError,
      })
      .mockResolvedValueOnce({
        data: {
          id: "task-retry-1",
          user_id: "user-1",
          task_text: "Custom week quest",
          difficulty: "medium",
          task_date: "2026-02-20",
          scheduled_time: "13:00",
          category: "mind",
        },
        error: null,
      });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    const createdTask = await result.current.addTask({
      taskText: "Custom week quest",
      difficulty: "medium",
      taskDate: "2026-02-20",
      recurrencePattern: "custom",
      recurrenceDays: [1],
      recurrenceCustomPeriod: "week",
    });

    expect(createdTask?.id).toBe("task-retry-1");
    expect(mocks.dailyTasksInsertMock).toHaveBeenCalledTimes(2);
    expect(mocks.dailyTasksInsertMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        recurrence_pattern: "custom",
        recurrence_custom_period: "week",
      }),
    );
    expect(mocks.dailyTasksInsertMock.mock.calls[1]?.[0]).toEqual(
      expect.not.objectContaining({
        recurrence_custom_period: expect.anything(),
        recurrence_month_days: expect.anything(),
      }),
    );
  });

  it("blocks month-based recurrence creation when required recurrence columns are unavailable", async () => {
    mocks.dailyTasksInsertSingleMock.mockResolvedValueOnce({
      data: null,
      error: dailyTasksRecurrenceColumnsMissingError,
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.addTask({
        taskText: "Monthly quest",
        difficulty: "medium",
        taskDate: "2026-02-20",
        recurrencePattern: "custom",
        recurrenceCustomPeriod: "month",
        recurrenceMonthDays: [5],
      }),
    ).rejects.toMatchObject({
      message: "Monthly recurrence is temporarily unavailable until backend update completes.",
    });

    expect(mocks.dailyTasksInsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to add quest" }));
  });

  it("fails quest creation and rolls back when attachment persistence has non-schema errors", async () => {
    mocks.taskAttachmentsInsertExecuteMock.mockResolvedValue({
      error: {
        code: "23514",
        message: "insert failed",
        details: null,
        hint: null,
      },
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
        attachments: [buildAttachment()],
      }),
    ).rejects.toMatchObject({ message: "insert failed" });

    expect(mocks.taskAttachmentsInsertExecuteMock).toHaveBeenCalledTimes(1);
    expect(mocks.dailyTasksDeleteExecuteMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to add quest" }));
  });

  it("updates quest fields and skips attachment persistence when task_attachments is unavailable", async () => {
    mocks.taskAttachmentsDeleteExecuteMock.mockResolvedValue({
      error: taskAttachmentsMissingTableError,
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    let updateResult: any;
    await act(async () => {
      updateResult = await result.current.updateTask({
        taskId: "task-1",
        updates: {
          task_text: "Ship feature update",
          attachments: [buildAttachment()],
        },
      });
    });

    expect(updateResult?.attachmentsSkippedDueToSchema).toBe(true);
    expect(mocks.dailyTasksUpdateExecuteMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Quest updated!" }));
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Attachments unavailable" }));
  });

  it("retries non-month recurrence updates when recurrence columns are unavailable", async () => {
    mocks.dailyTasksUpdateExecuteMock
      .mockResolvedValueOnce({ error: dailyTasksRecurrenceColumnsMissingError })
      .mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await result.current.updateTask({
      taskId: "task-1",
      updates: {
        recurrence_pattern: "custom",
        recurrence_days: [1, 3],
        recurrence_custom_period: "week",
      },
    });

    expect(mocks.dailyTasksUpdateMock).toHaveBeenCalledTimes(2);
    expect(mocks.dailyTasksUpdateMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        recurrence_pattern: "custom",
        recurrence_custom_period: "week",
      }),
    );
    expect(mocks.dailyTasksUpdateMock.mock.calls[1]?.[0]).toEqual(
      expect.not.objectContaining({
        recurrence_custom_period: expect.anything(),
        recurrence_month_days: expect.anything(),
      }),
    );
  });

  it("retries restore for non-month recurrence when recurrence columns are unavailable", async () => {
    mocks.dailyTasksInsertSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: dailyTasksRecurrenceColumnsMissingError,
      })
      .mockResolvedValueOnce({
        data: {
          id: "task-restore-1",
          user_id: "user-1",
          task_text: "Restored quest",
          task_date: "2026-02-20",
        },
        error: null,
      });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    const restored = await result.current.restoreTask({
      task_text: "Restored quest",
      task_date: "2026-02-20",
      recurrence_pattern: "custom",
      recurrence_days: [0, 2],
      recurrence_custom_period: "week",
    });

    expect(restored?.id).toBe("task-restore-1");
    expect(mocks.dailyTasksInsertMock).toHaveBeenCalledTimes(2);
    expect(mocks.dailyTasksInsertMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        recurrence_pattern: "custom",
        recurrence_custom_period: "week",
      }),
    );
    expect(mocks.dailyTasksInsertMock.mock.calls[1]?.[0]).toEqual(
      expect.not.objectContaining({
        recurrence_custom_period: expect.anything(),
        recurrence_month_days: expect.anything(),
      }),
    );
  });

  it("moves timed inbox updates into quests with today's date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T08:25:00"));

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateTask({
        taskId: "task-1",
        updates: {
          task_date: null,
          scheduled_time: "09:00",
        },
      });
    });

    expect(mocks.dailyTasksUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      task_date: "2026-02-24",
      scheduled_time: "09:00",
      source: "manual",
    }));
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Moved to Quests",
      description: "Added a time, so this quest is now scheduled in Quests.",
    }));
    expect(mocks.toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Time removed" }));
  });
});
