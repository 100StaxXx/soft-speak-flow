import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const useTasksQueryMock = vi.fn();
  const useWidgetSyncMock = vi.fn();

  const authState = {
    user: { id: "user-1" } as { id: string } | null,
    status: "authenticated" as "loading" | "authenticated" | "unauthenticated" | "recovering",
  };

  const tasksState = {
    tasks: [{ id: "task-1" }],
    taskDate: "2026-02-22",
  };

  return {
    useTasksQueryMock,
    useWidgetSyncMock,
    authState,
    tasksState,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.authState.user,
    status: mocks.authState.status,
  }),
}));

vi.mock("@/hooks/useTasksQuery", () => ({
  useTasksQuery: (...args: unknown[]) => mocks.useTasksQueryMock(...args),
}));

vi.mock("@/hooks/useWidgetSync", () => ({
  useWidgetSync: (...args: unknown[]) => mocks.useWidgetSyncMock(...args),
}));

import { useGlobalWidgetSync } from "./useGlobalWidgetSync";

describe("useGlobalWidgetSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.user = { id: "user-1" };
    mocks.authState.status = "authenticated";
    mocks.tasksState.tasks = [{ id: "task-1" }];
    mocks.tasksState.taskDate = "2026-02-22";
    mocks.useTasksQueryMock.mockReturnValue(mocks.tasksState);
  });

  it("uses today's tasks query and syncs widget when a user exists", () => {
    renderHook(() => useGlobalWidgetSync());

    expect(mocks.useTasksQueryMock).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      mocks.tasksState.tasks,
      mocks.tasksState.taskDate,
      { enabled: true },
    );
  });

  it("disables querying and syncing when hook is disabled", () => {
    renderHook(() => useGlobalWidgetSync({ enabled: false }));

    expect(mocks.useTasksQueryMock).toHaveBeenCalledWith(undefined, { enabled: false });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      mocks.tasksState.tasks,
      mocks.tasksState.taskDate,
      { enabled: false },
    );
  });

  it("keeps sync enabled while auth is recovering when user exists", () => {
    mocks.authState.status = "recovering";

    renderHook(() => useGlobalWidgetSync());

    expect(mocks.useTasksQueryMock).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      mocks.tasksState.tasks,
      mocks.tasksState.taskDate,
      { enabled: true },
    );
  });

  it("disables querying and syncing when user is missing", () => {
    mocks.authState.user = null;
    mocks.authState.status = "unauthenticated";

    renderHook(() => useGlobalWidgetSync());

    expect(mocks.useTasksQueryMock).toHaveBeenCalledWith(undefined, { enabled: false });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      mocks.tasksState.tasks,
      mocks.tasksState.taskDate,
      { enabled: false },
    );
  });
});
