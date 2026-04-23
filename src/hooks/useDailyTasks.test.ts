import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useTasksQueryMock: vi.fn(),
  useQuestMutationsMock: vi.fn(),
}));

vi.mock("./useTasksQuery", () => ({
  useTasksQuery: (...args: unknown[]) => mocks.useTasksQueryMock(...args),
}));

vi.mock("./useQuestMutations", () => ({
  useQuestMutations: (...args: unknown[]) => mocks.useQuestMutationsMock(...args),
}));

import { useDailyTasks } from "./useDailyTasks";

describe("useDailyTasks", () => {
  it("keeps the legacy task-shaped API while sourcing mutations from quest wrappers", () => {
    const createQuest = vi.fn();
    const updateQuest = vi.fn();
    const selectedDate = new Date("2026-04-22T12:00:00.000Z");

    mocks.useTasksQueryMock.mockReturnValue({
      tasks: [{ id: "task-1" }],
      isLoading: false,
      taskDate: "2026-04-22",
      completedCount: 1,
      totalCount: 3,
    });

    mocks.useQuestMutationsMock.mockReturnValue({
      createQuest,
      toggleQuest: vi.fn(),
      deleteQuest: vi.fn(),
      setMainQuest: vi.fn(),
      updateQuest,
      reorderQuests: vi.fn(),
      moveQuestToSection: vi.fn(),
      moveQuestToDate: vi.fn(),
      restoreQuest: vi.fn(),
      isAdding: false,
      isToggling: false,
      isDeleting: false,
      isUpdating: true,
      isReordering: false,
      isMoving: false,
      isMovingDate: false,
      isRestoring: false,
    });

    const { result } = renderHook(() => useDailyTasks(selectedDate, { enabled: false }));

    expect(mocks.useTasksQueryMock).toHaveBeenCalledWith(selectedDate, { enabled: false });
    expect(mocks.useQuestMutationsMock).toHaveBeenCalledWith("2026-04-22");
    expect(result.current.addTask).toBe(createQuest);
    expect(result.current.updateTask).toBe(updateQuest);
    expect(result.current.tasks).toEqual([{ id: "task-1" }]);
    expect(result.current.completedCount).toBe(1);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.isUpdating).toBe(true);
  });
});
