import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const toastMock = vi.fn();
  const showXPToastMock = vi.fn();
  const awardCustomXPMock = vi.fn();
  const awardDisciplineForHabitCompletionMock = vi.fn();
  const awardDisciplineForPlannedTaskOnTimeMock = vi.fn();
  const trackTaskCreationMock = vi.fn();
  const trackTaskCompletionMock = vi.fn();
  const trackResilienceEventMock = vi.fn();
  const queueTaskActionMock = vi.fn();
  const reportApiFailureMock = vi.fn();
  const resilienceState = {
    shouldQueueWrites: false,
    state: "healthy" as "healthy" | "offline" | "degraded" | "outage" | "recovering" | "recovered",
  };
  const createOfflinePlannerIdMock = vi.fn((prefix: string) => `${prefix}-local`);
  const getLocalHabitCompletionsForDateMock = vi.fn();
  const getLocalSubtasksForTaskMock = vi.fn();
  const getPlannerRecordMock = vi.fn();
  const getLocalTasksByDateMock = vi.fn();
  const removePlannerRecordMock = vi.fn();
  const removePlannerRecordsMock = vi.fn();
  const upsertPlannerRecordMock = vi.fn();
  const upsertPlannerRecordsMock = vi.fn();
  const companion = { id: "companion-1" } as { id: string } | null;

  const dailyTasksCountExecuteMock = vi.fn();
  const dailyTasksInsertMock = vi.fn();
  const dailyTasksInsertSingleMock = vi.fn();
  const dailyTasksDeleteExecuteMock = vi.fn();
  const dailyTasksFetchSchedulingSingleMock = vi.fn();
  const dailyTasksFetchByIdMaybeSingleMock = vi.fn();
  const dailyTasksUpdateMock = vi.fn();
  const dailyTasksUpdateExecuteMock = vi.fn();
  const taskAttachmentsDeleteExecuteMock = vi.fn();
  const taskAttachmentsInsertExecuteMock = vi.fn();
  const withTimeoutMock = vi.fn();
  const pollWithDeadlineMock = vi.fn();

  return {
    fromMock,
    toastMock,
    showXPToastMock,
    awardCustomXPMock,
    awardDisciplineForHabitCompletionMock,
    awardDisciplineForPlannedTaskOnTimeMock,
    trackTaskCreationMock,
    trackTaskCompletionMock,
    trackResilienceEventMock,
    queueTaskActionMock,
    reportApiFailureMock,
    resilienceState,
    createOfflinePlannerIdMock,
    getLocalHabitCompletionsForDateMock,
    getLocalSubtasksForTaskMock,
    getPlannerRecordMock,
    getLocalTasksByDateMock,
    removePlannerRecordMock,
    removePlannerRecordsMock,
    upsertPlannerRecordMock,
    upsertPlannerRecordsMock,
    companion,
    dailyTasksCountExecuteMock,
    dailyTasksInsertMock,
    dailyTasksInsertSingleMock,
    dailyTasksDeleteExecuteMock,
    dailyTasksFetchSchedulingSingleMock,
    dailyTasksFetchByIdMaybeSingleMock,
    dailyTasksUpdateMock,
    dailyTasksUpdateExecuteMock,
    taskAttachmentsDeleteExecuteMock,
    taskAttachmentsInsertExecuteMock,
    withTimeoutMock,
    pollWithDeadlineMock,
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
    companion: mocks.companion,
  }),
}));

vi.mock("@/hooks/useCompanionAttributes", () => ({
  useCompanionAttributes: () => ({
    awardDisciplineForHabitCompletion: mocks.awardDisciplineForHabitCompletionMock,
    awardDisciplineForPlannedTaskOnTime: mocks.awardDisciplineForPlannedTaskOnTimeMock,
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
    state: mocks.resilienceState.state,
    shouldQueueWrites: mocks.resilienceState.shouldQueueWrites,
    queueAction: vi.fn(),
    queueTaskAction: mocks.queueTaskActionMock,
    reportApiFailure: mocks.reportApiFailureMock,
  }),
}));

vi.mock("@/utils/resilienceTelemetry", () => ({
  trackResilienceEvent: (...args: unknown[]) => mocks.trackResilienceEventMock(...args),
}));

vi.mock("@/utils/asyncTimeout", async () => {
  const actual = await vi.importActual<typeof import("@/utils/asyncTimeout")>("@/utils/asyncTimeout");

  return {
    ...actual,
    withTimeout: (...args: Parameters<typeof actual.withTimeout>) => mocks.withTimeoutMock(...args),
    pollWithDeadline: (...args: Parameters<typeof actual.pollWithDeadline>) => mocks.pollWithDeadlineMock(...args),
  };
});

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (...args: unknown[]) => mocks.createOfflinePlannerIdMock(...args),
  getLocalHabitCompletionsForDate: (...args: unknown[]) => mocks.getLocalHabitCompletionsForDateMock(...args),
  getLocalSubtasksForTask: (...args: unknown[]) => mocks.getLocalSubtasksForTaskMock(...args),
  getPlannerRecord: (...args: unknown[]) => mocks.getPlannerRecordMock(...args),
  getLocalTasksByDate: (...args: unknown[]) => mocks.getLocalTasksByDateMock(...args),
  removePlannerRecord: (...args: unknown[]) => mocks.removePlannerRecordMock(...args),
  removePlannerRecords: (...args: unknown[]) => mocks.removePlannerRecordsMock(...args),
  upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecordMock(...args),
  upsertPlannerRecords: (...args: unknown[]) => mocks.upsertPlannerRecordsMock(...args),
}));

import {
  getTaskCompletionDisciplineAward,
  isTaskAttachmentsTableMissingError,
  isTaskCompletionOnTime,
  useTaskMutations,
} from "./useTaskMutations";
import { TimeoutError } from "@/utils/asyncTimeout";
import {
  RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR,
  RECURRENCE_REQUIRES_SCHEDULED_TIME_MESSAGE,
} from "@/utils/recurrenceValidation";

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

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
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

describe("task completion discipline helpers", () => {
  it("returns null for unscheduled task completions", () => {
    const completedAt = new Date("2026-02-20T14:15:00");

    expect(isTaskCompletionOnTime(null, completedAt)).toBeNull();
    expect(
      getTaskCompletionDisciplineAward({
        taskId: "task-1",
        taskDate: "2026-02-20",
        habitSourceId: null,
        scheduledTime: null,
        completedAt,
      }),
    ).toBeNull();
  });

  it("awards planned-task discipline when a scheduled quest is finished on time", () => {
    const completedAt = new Date("2026-02-20T09:25:00");

    expect(isTaskCompletionOnTime("09:00", completedAt)).toBe(true);
    expect(
      getTaskCompletionDisciplineAward({
        taskId: "task-1",
        taskDate: "2026-02-20",
        habitSourceId: null,
        scheduledTime: "09:00",
        completedAt,
      }),
    ).toEqual({
      kind: "planned_task_on_time",
      taskId: "task-1",
    });
  });

  it("keeps habit-sourced completions on the habit discipline path", () => {
    const completedAt = new Date("2026-02-20T09:25:00");

    expect(
      getTaskCompletionDisciplineAward({
        taskId: "task-1",
        taskDate: "2026-02-20",
        habitSourceId: "habit-1",
        scheduledTime: "09:00",
        completedAt,
      }),
    ).toEqual({
      kind: "habit_complete",
      habitId: "habit-1",
      date: "2026-02-20",
    });
  });
});

describe("useTaskMutations attachment handling", () => {
  afterEach(() => {
    vi.useRealTimers();
    if (originalOnlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resilienceState.shouldQueueWrites = false;
    mocks.resilienceState.state = "healthy";
    mocks.awardDisciplineForHabitCompletionMock.mockResolvedValue(undefined);
    mocks.awardDisciplineForPlannedTaskOnTimeMock.mockResolvedValue(undefined);
    mocks.getLocalHabitCompletionsForDateMock.mockResolvedValue([]);
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([]);
    mocks.getPlannerRecordMock.mockResolvedValue({
      id: "task-1",
      user_id: "user-1",
      task_text: "Ship feature",
      difficulty: "medium",
      xp_reward: 16,
      task_date: "2026-02-20",
      completed: false,
      completed_at: null,
      is_main_quest: false,
      scheduled_time: "09:00",
      estimated_duration: 30,
      recurrence_pattern: null,
      recurrence_days: null,
      recurrence_month_days: null,
      recurrence_custom_period: null,
      recurrence_end_date: null,
      is_recurring: false,
      reminder_enabled: false,
      reminder_minutes_before: 15,
      reminder_sent: false,
      parent_template_id: null,
      category: "mind",
      is_bonus: false,
      created_at: "2026-02-20T00:00:00.000Z",
      priority: null,
      is_top_three: null,
      actual_time_spent: null,
      ai_generated: null,
      context_id: null,
      source: "manual",
      habit_source_id: null,
      epic_id: null,
      sort_order: 0,
      contact_id: null,
      auto_log_interaction: true,
      image_url: null,
      notes: null,
      location: null,
      attachments: [],
      subtasks: [],
    });
    mocks.getLocalTasksByDateMock.mockResolvedValue([]);
    mocks.removePlannerRecordMock.mockResolvedValue(undefined);
    mocks.removePlannerRecordsMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordsMock.mockResolvedValue(undefined);

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
        task_date: "2026-02-20",
        scheduled_time: "09:00",
        habit_source_id: null,
        source: "manual",
        recurrence_pattern: null,
      },
      error: null,
    });
    mocks.dailyTasksFetchByIdMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    mocks.dailyTasksUpdateExecuteMock.mockResolvedValue({ error: null });
    mocks.taskAttachmentsDeleteExecuteMock.mockResolvedValue({ error: null });
    mocks.taskAttachmentsInsertExecuteMock.mockResolvedValue({ error: null });
    mocks.withTimeoutMock.mockImplementation(async (promiseOrFactory: Promise<unknown> | (() => Promise<unknown>)) => (
      typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory
    ));
    mocks.pollWithDeadlineMock.mockResolvedValue(null);
    mocks.queueTaskActionMock.mockResolvedValue("queued-1");
    mocks.dailyTasksInsertMock.mockImplementation(() => {
      const builder = {
        abortSignal: vi.fn(() => builder),
        select: vi.fn(() => ({
          single: mocks.dailyTasksInsertSingleMock,
        })),
      };

      return builder;
    });

    mocks.dailyTasksUpdateMock.mockReturnValue({
      eq: vi.fn(() => ({
        eq: mocks.dailyTasksUpdateExecuteMock,
      })),
    });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "daily_tasks") {
        return {
          select: vi.fn((selection?: string) => {
            if (selection?.includes("task_date, scheduled_time, habit_source_id, source")) {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: mocks.dailyTasksFetchSchedulingSingleMock,
                  })),
                })),
              };
            }

            if (selection === "*") {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: mocks.dailyTasksFetchByIdMaybeSingleMock,
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

  it("adds a plain quest live when online and healthy", async () => {
    setOnline(true);

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    let createdTask: any;
    await act(async () => {
      createdTask = await result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
      });
    });

    expect(createdTask?.id).toBe("task-1");
    expect(createdTask?.queued).not.toBe(true);
    expect(mocks.queueTaskActionMock).not.toHaveBeenCalled();
    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Quest added!" }));
    expect(mocks.trackResilienceEventMock).toHaveBeenCalledWith(
      "task_create_result",
      expect.objectContaining({
        queued: false,
        queueReason: null,
      }),
    );
  });

  it("normalizes legacy prefixed UUID-like fields before live quest creation", async () => {
    setOnline(true);
    const legacyTaskId = "task-e47e5651-7522-4888-a04d-6eff518fa4ba";
    const normalizedTaskId = "e47e5651-7522-4888-a04d-6eff518fa4ba";
    const legacyContactId = "contact-2F96D0D4-0B3D-4C91-8A11-0C685B392253";
    const normalizedContactId = "2f96d0d4-0b3d-4c91-8a11-0c685b392253";

    mocks.createOfflinePlannerIdMock.mockReturnValueOnce(legacyTaskId);
    mocks.dailyTasksInsertSingleMock.mockResolvedValueOnce({
      data: {
        id: normalizedTaskId,
        user_id: "user-1",
        task_text: "Ship feature",
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

    await act(async () => {
      await result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
        contactId: legacyContactId,
      });
    });

    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledWith(
      "daily_tasks",
      expect.objectContaining({ id: normalizedTaskId }),
    );
    expect(mocks.dailyTasksInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: normalizedTaskId,
        contact_id: normalizedContactId,
      }),
    );
  });

  it("prequeues a plain quest immediately when offline", async () => {
    setOnline(false);
    mocks.resilienceState.shouldQueueWrites = true;

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    let createdTask: any;
    await act(async () => {
      createdTask = await result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
      });
    });

    expect(createdTask).toEqual(expect.objectContaining({
      id: "task-local",
      queued: true,
      queueReason: "offline",
      syncPending: true,
    }));
    expect(mocks.dailyTasksInsertMock).not.toHaveBeenCalled();
    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledTimes(1);
    expect(mocks.queueTaskActionMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Quest saved offline",
      description: "We'll sync it when you're back online.",
    }));
  });

  it("still attempts a live quest insert while online during outage state", async () => {
    setOnline(true);
    mocks.resilienceState.state = "outage";

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    let createdTask: any;
    await act(async () => {
      createdTask = await result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
      });
    });

    expect(createdTask?.queued).not.toBe(true);
    expect(mocks.dailyTasksInsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.queueTaskActionMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Quest added!" }));
  });

  it("treats a timed-out insert as successful when the remote row appears during existence check", async () => {
    setOnline(true);
    mocks.withTimeoutMock.mockImplementationOnce(async (_promiseOrFactory, options) => {
      options?.onTimeout?.();
      throw new TimeoutError("create quest insert", 3000, "TASK_CREATE_TIMEOUT");
    });
    mocks.pollWithDeadlineMock.mockResolvedValueOnce({
      id: "task-local",
      user_id: "user-1",
      task_text: "Ship feature",
      difficulty: "medium",
      task_date: "2026-02-20",
      scheduled_time: "13:00",
      category: "mind",
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
      });
    });

    expect(createdTask?.id).toBe("task-local");
    expect(createdTask?.scheduled_time).toBe("13:00");
    expect(createdTask?.queued).not.toBe(true);
    expect(mocks.pollWithDeadlineMock).toHaveBeenCalledTimes(1);
    expect(mocks.queueTaskActionMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Quest added!" }));
  });

  it("queues exactly one create action when a timed-out insert never appears remotely", async () => {
    setOnline(true);
    mocks.withTimeoutMock.mockImplementationOnce(async (_promiseOrFactory, options) => {
      options?.onTimeout?.();
      throw new TimeoutError("create quest insert", 3000, "TASK_CREATE_TIMEOUT");
    });
    mocks.pollWithDeadlineMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    let createdTask: any;
    await act(async () => {
      createdTask = await result.current.addTask({
        taskText: "Ship feature",
        difficulty: "medium",
        taskDate: "2026-02-20",
      });
    });

    expect(createdTask).toEqual(expect.objectContaining({
      id: "task-local",
      queued: true,
      queueReason: "network_timeout",
      syncPending: true,
    }));
    expect(mocks.pollWithDeadlineMock).toHaveBeenCalledTimes(1);
    expect(mocks.queueTaskActionMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Quest saved locally. Server sync will retry automatically.",
    }));
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
      scheduledTime: "09:00",
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
        scheduledTime: "09:00",
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

  it("surfaces backend quest-limit errors without rewriting the message", async () => {
    mocks.dailyTasksInsertSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "P0001",
        message: "Maximum quest limit reached for this date (limit: 10)",
        details: null,
        hint: null,
      },
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.addTask({
        taskText: "Another quest",
        difficulty: "medium",
        taskDate: "2026-02-20",
      }),
    ).rejects.toMatchObject({
      message: "Maximum quest limit reached for this date (limit: 10)",
    });

    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to add quest" }));
  });

  it("removes the local quest record when live creation fails with a nonqueueable error", async () => {
    setOnline(true);
    mocks.dailyTasksInsertSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "22P02",
        message: "invalid input syntax for type uuid: \"task-e47e5651-7522-4888-a04d-6eff518fa4ba\"",
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
      }),
    ).rejects.toMatchObject({
      message: "invalid input syntax for type uuid: \"task-e47e5651-7522-4888-a04d-6eff518fa4ba\"",
    });

    expect(mocks.removePlannerRecordMock).toHaveBeenCalledWith("daily_tasks", "task-local");
    expect(mocks.queueTaskActionMock).not.toHaveBeenCalled();
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

  it("blocks recurring quest creation when no scheduled time is provided", async () => {
    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.addTask({
        taskText: "Recurring without time",
        difficulty: "medium",
        taskDate: "2026-02-20",
        scheduledTime: null,
        recurrencePattern: "daily",
      }),
    ).rejects.toMatchObject({
      message: RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR,
    });

    expect(mocks.dailyTasksInsertMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Failed to add quest",
      description: RECURRENCE_REQUIRES_SCHEDULED_TIME_MESSAGE,
    }));
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

  it("normalizes legacy prefixed task IDs before remote quest updates", async () => {
    const legacyTaskId = "task-e47e5651-7522-4888-a04d-6eff518fa4ba";
    const normalizedTaskId = "e47e5651-7522-4888-a04d-6eff518fa4ba";
    const eqUserMock = vi.fn().mockResolvedValue({ error: null });
    const eqIdMock = vi.fn((column: string, value: string) => {
      expect(column).toBe("id");
      expect(value).toBe(normalizedTaskId);
      return {
        eq: eqUserMock,
      };
    });

    mocks.dailyTasksUpdateMock.mockReturnValue({
      eq: eqIdMock,
    });
    mocks.getPlannerRecordMock.mockImplementation(async (_store: string, id: string) => {
      if (id !== legacyTaskId) return null;
      return {
        id: legacyTaskId,
        user_id: "user-1",
        task_text: "Ship feature",
        difficulty: "medium",
        xp_reward: 16,
        task_date: "2026-02-20",
        completed: false,
        completed_at: null,
        is_main_quest: false,
        scheduled_time: "09:00",
        estimated_duration: 30,
        recurrence_pattern: null,
        recurrence_days: null,
        recurrence_month_days: null,
        recurrence_custom_period: null,
        recurrence_end_date: null,
        is_recurring: false,
        reminder_enabled: false,
        reminder_minutes_before: 15,
        reminder_sent: false,
        parent_template_id: null,
        category: "mind",
        is_bonus: false,
        created_at: "2026-02-20T08:00:00.000Z",
        priority: null,
        is_top_three: null,
        actual_time_spent: null,
        ai_generated: null,
        context_id: null,
        source: "manual",
        habit_source_id: null,
        epic_id: null,
        sort_order: 0,
        contact_id: null,
        auto_log_interaction: true,
        image_url: null,
        notes: null,
        location: null,
        attachments: [],
        subtasks: [],
      };
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateTask({
        taskId: legacyTaskId,
        updates: {
          task_text: "Ship feature update",
        },
      });
    });

    expect(eqIdMock).toHaveBeenCalledTimes(1);
    expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Quest updated!" }));
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

  it("sets is_recurring=true when enabling recurrence in an update", async () => {
    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await result.current.updateTask({
      taskId: "task-1",
      updates: {
        recurrence_pattern: "daily",
      },
    });

    expect(mocks.dailyTasksUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      recurrence_pattern: "daily",
      is_recurring: true,
    }));
  });

  it("sets is_recurring=false when recurrence is cleared in an update", async () => {
    mocks.dailyTasksFetchSchedulingSingleMock.mockResolvedValue({
      data: {
        task_date: "2026-02-20",
        scheduled_time: "09:00",
        habit_source_id: null,
        source: "manual",
        recurrence_pattern: "daily",
      },
      error: null,
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await result.current.updateTask({
      taskId: "task-1",
      updates: {
        recurrence_pattern: null,
      },
    });

    expect(mocks.dailyTasksUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      recurrence_pattern: null,
      is_recurring: false,
    }));
  });

  it("blocks recurring quest updates when resulting task has no scheduled time", async () => {
    mocks.dailyTasksFetchSchedulingSingleMock.mockResolvedValue({
      data: {
        task_date: null,
        scheduled_time: null,
        habit_source_id: null,
        source: "inbox",
        recurrence_pattern: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useTaskMutations("2026-02-20"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.updateTask({
        taskId: "task-1",
        updates: {
          recurrence_pattern: "daily",
        },
      }),
    ).rejects.toMatchObject({
      message: RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR,
    });

    expect(mocks.dailyTasksUpdateMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Failed to update quest",
      description: RECURRENCE_REQUIRES_SCHEDULED_TIME_MESSAGE,
    }));
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
    mocks.dailyTasksFetchSchedulingSingleMock.mockResolvedValue({
      data: {
        task_date: null,
        scheduled_time: null,
        habit_source_id: null,
        source: "inbox",
        recurrence_pattern: null,
      },
      error: null,
    });

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
