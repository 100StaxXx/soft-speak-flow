import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllLocalTasksForUserMock: vi.fn(),
  getLocalSubtasksForTaskMock: vi.fn(),
  fetchExplicitPersonalQuestTemplatesMock: vi.fn(),
  savePersonalQuestTemplateMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  getAllLocalTasksForUser: (...args: unknown[]) => mocks.getAllLocalTasksForUserMock(...args),
  getLocalSubtasksForTask: (...args: unknown[]) => mocks.getLocalSubtasksForTaskMock(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
}));

vi.mock("@/features/quests/services/personalQuestTemplates", async () => {
  const actual = await vi.importActual<typeof import("@/features/quests/services/personalQuestTemplates")>(
    "@/features/quests/services/personalQuestTemplates",
  );

  return {
    ...actual,
    fetchExplicitPersonalQuestTemplates: (...args: unknown[]) => mocks.fetchExplicitPersonalQuestTemplatesMock(...args),
    savePersonalQuestTemplate: (...args: unknown[]) => mocks.savePersonalQuestTemplateMock(...args),
  };
});

import { usePersonalQuestTemplates } from "./usePersonalQuestTemplates";

const buildTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Deep work block",
  difficulty: "medium",
  xp_reward: 16,
  task_date: "2026-01-15",
  completed: false,
  completed_at: null,
  is_main_quest: false,
  scheduled_time: "09:00",
  estimated_duration: 90,
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
  created_at: "2026-01-15T09:00:00.000Z",
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
  contact: null,
  image_url: null,
  attachments: [],
  notes: "Default note",
  location: null,
  subtasks: [],
  ...overrides,
});

describe("usePersonalQuestTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([]);
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([]);
    mocks.fetchExplicitPersonalQuestTemplatesMock.mockResolvedValue([]);
    mocks.savePersonalQuestTemplateMock.mockResolvedValue({
      id: "explicit-template-1",
      user_id: "user-1",
      source_common_template_id: "work-deep-work-block",
      normalized_title: "deep work sprint",
      title: "Deep Work Sprint",
      difficulty: "hard",
      estimated_duration: 75,
      notes: "Save the customized version",
      subtasks: ["Choose one priority", "Block distractions"],
      created_at: "2026-01-20T09:00:00.000Z",
      updated_at: "2026-01-20T09:00:00.000Z",
    });
  });

  it("groups repeated titles case-insensitively and requires a minimum frequency of two", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({ id: "task-a", task_text: "Deep work block" }),
      buildTask({ id: "task-b", task_text: "  deep   work block  ", created_at: "2026-01-16T09:00:00.000Z" }),
      buildTask({ id: "task-c", task_text: "Single use quest", created_at: "2026-01-17T09:00:00.000Z" }),
    ]);

    const { result } = renderHook(() => usePersonalQuestTemplates());

    await waitFor(() => {
      expect(result.current.templates).toHaveLength(1);
    });

    expect(result.current.templates[0]).toMatchObject({
      title: "deep work block",
      frequency: 2,
      templateOrigin: "personal_derived",
    });
  });

  it("excludes habit-sourced, recurring, ai-generated, onboarding, and plan-my-day tasks", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({ id: "allowed-1", task_text: "Weekly review", created_at: "2026-01-10T09:00:00.000Z" }),
      buildTask({ id: "allowed-2", task_text: "Weekly review", created_at: "2026-01-11T09:00:00.000Z", source: "voice" }),
      buildTask({ id: "habit-1", task_text: "Hydrate", habit_source_id: "habit-1" }),
      buildTask({ id: "habit-2", task_text: "Hydrate", habit_source_id: "habit-1", created_at: "2026-01-16T09:00:00.000Z" }),
      buildTask({ id: "ai-1", task_text: "AI plan task", ai_generated: true }),
      buildTask({ id: "ai-2", task_text: "AI plan task", ai_generated: true, created_at: "2026-01-18T09:00:00.000Z" }),
      buildTask({ id: "recurring-1", task_text: "Morning prep", source: "recurring" }),
      buildTask({ id: "recurring-2", task_text: "Morning prep", source: "recurring", created_at: "2026-01-19T09:00:00.000Z" }),
      buildTask({ id: "onboarding-1", task_text: "Intro quest", source: "onboarding" }),
      buildTask({ id: "onboarding-2", task_text: "Intro quest", source: "onboarding", created_at: "2026-01-20T09:00:00.000Z" }),
      buildTask({ id: "plan-1", task_text: "Plan quest", source: "plan_my_day" }),
      buildTask({ id: "plan-2", task_text: "Plan quest", source: "plan_my_day", created_at: "2026-01-21T09:00:00.000Z" }),
    ]);

    const { result } = renderHook(() => usePersonalQuestTemplates());

    await waitFor(() => {
      expect(result.current.templates).toHaveLength(1);
    });

    expect(result.current.templates[0].title).toBe("Weekly review");
    expect(result.current.templates[0].templateOrigin).toBe("personal_derived");
  });

  it("merges explicit templates and lets them override derived templates with the same normalized title", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({
        id: "deep-old",
        task_text: "Deep work block",
        difficulty: "easy",
        estimated_duration: 45,
        notes: "Old note",
        created_at: "2026-01-10T09:00:00.000Z",
      }),
      buildTask({
        id: "deep-new",
        task_text: "Deep work block",
        difficulty: "hard",
        estimated_duration: 120,
        notes: "Newest note",
        created_at: "2026-01-19T09:00:00.000Z",
      }),
      buildTask({
        id: "weekly-1",
        task_text: "Weekly review",
        created_at: "2026-01-11T09:00:00.000Z",
      }),
      buildTask({
        id: "weekly-2",
        task_text: "Weekly review",
        created_at: "2026-01-12T09:00:00.000Z",
      }),
      buildTask({
        id: "weekly-3",
        task_text: "Weekly review",
        created_at: "2026-01-13T09:00:00.000Z",
      }),
    ]);

    mocks.fetchExplicitPersonalQuestTemplatesMock.mockResolvedValue([
      {
        id: "explicit-deep-work",
        user_id: "user-1",
        source_common_template_id: "work-deep-work-block",
        normalized_title: "deep work block",
        title: "Deep Work Sprint",
        difficulty: "hard",
        estimated_duration: 75,
        notes: "Customized note",
        subtasks: ["Choose one priority", "Shut the door"],
        created_at: "2026-01-18T09:00:00.000Z",
        updated_at: "2026-01-19T09:00:00.000Z",
      },
    ]);

    mocks.getLocalSubtasksForTaskMock.mockImplementation(async (taskId: string) => {
      if (taskId === "deep-new") {
        return [
          { id: "subtask-2", title: "Silence notifications", sort_order: 1 },
          { id: "subtask-1", title: "Choose one priority", sort_order: 0 },
        ];
      }

      return [];
    });

    const { result } = renderHook(() => usePersonalQuestTemplates());

    await waitFor(() => {
      expect(result.current.templates).toHaveLength(2);
    });

    expect(result.current.templates.map((template) => template.title)).toEqual([
      "Weekly review",
      "Deep Work Sprint",
    ]);

    expect(result.current.templates[1]).toMatchObject({
      id: "explicit-deep-work",
      templateOrigin: "personal_explicit",
      difficulty: "hard",
      estimatedDuration: 75,
      notes: "Customized note",
      subtasks: ["Choose one priority", "Shut the door"],
      frequency: 2,
      sourceCommonTemplateId: "work-deep-work-block",
    });
  });

  it("saves an explicit personal template and refreshes the merged list", async () => {
    const { result } = renderHook(() => usePersonalQuestTemplates());

    await waitFor(() => {
      expect(result.current.templates).toEqual([]);
    });

    mocks.fetchExplicitPersonalQuestTemplatesMock.mockResolvedValue([
      {
        id: "explicit-template-1",
        user_id: "user-1",
        source_common_template_id: "work-deep-work-block",
        normalized_title: "deep work sprint",
        title: "Deep Work Sprint",
        difficulty: "hard",
        estimated_duration: 75,
        notes: "Save the customized version",
        subtasks: ["Choose one priority", "Block distractions"],
        created_at: "2026-01-20T09:00:00.000Z",
        updated_at: "2026-01-20T09:00:00.000Z",
      },
    ]);

    await act(async () => {
      await result.current.saveTemplate({
        sourceCommonTemplateId: "work-deep-work-block",
        title: "Deep Work Sprint",
        difficulty: "hard",
        estimatedDuration: 75,
        notes: "Save the customized version",
        subtasks: ["Choose one priority", "Block distractions"],
      });
    });

    expect(mocks.savePersonalQuestTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      title: "Deep Work Sprint",
    }));

    await waitFor(() => {
      expect(result.current.templates[0]).toMatchObject({
        id: "explicit-template-1",
        templateOrigin: "personal_explicit",
        title: "Deep Work Sprint",
      });
    });
  });
});
