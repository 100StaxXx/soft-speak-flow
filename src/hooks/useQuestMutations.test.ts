import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useTaskMutationsMock: vi.fn(),
}));

vi.mock("./useTaskMutations", () => ({
  useTaskMutations: (...args: unknown[]) => mocks.useTaskMutationsMock(...args),
}));

import { useQuestMutations } from "./useQuestMutations";

describe("useQuestMutations", () => {
  it("reuses the legacy task mutation hook behind canonical quest method names", () => {
    const addTask = vi.fn();
    const updateTask = vi.fn();
    const toggleTask = vi.fn();

    mocks.useTaskMutationsMock.mockReturnValue({
      addTask,
      toggleTask,
      deleteTask: vi.fn(),
      restoreTask: vi.fn(),
      setMainQuest: vi.fn(),
      updateTask,
      reorderTasks: vi.fn(),
      moveTaskToSection: vi.fn(),
      moveTaskToDate: vi.fn(),
      isAdding: false,
      isToggling: true,
      isDeleting: false,
      isRestoring: false,
      isUpdating: true,
      isReordering: false,
      isMoving: false,
      isMovingDate: false,
    });

    const { result } = renderHook(() => useQuestMutations("2026-04-22"));

    expect(mocks.useTaskMutationsMock).toHaveBeenCalledWith("2026-04-22");
    expect(result.current.createQuest).toBe(addTask);
    expect(result.current.updateQuest).toBe(updateTask);
    expect(result.current.toggleQuest).toBe(toggleTask);
    expect(result.current.isToggling).toBe(true);
    expect(result.current.isUpdating).toBe(true);
  });
});
