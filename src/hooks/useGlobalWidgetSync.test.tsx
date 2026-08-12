import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const useAdaptiveDailyFormationMock = vi.fn();
  const useWidgetSyncMock = vi.fn();

  const authState = {
    user: { id: "user-1" } as { id: string } | null,
    status: "authenticated" as "loading" | "authenticated" | "unauthenticated" | "recovering",
  };

  const formationState = {
    assignment: {
      assignmentId: "assignment-1",
      taskId: "task-1",
      practiceDate: "2026-02-22",
      practice: {
        id: "formation-01",
        category: "Faith",
        title: "Begin with gratitude",
        action: "Name three gifts and thank God for each one.",
        benefit: "Trains attention toward grace.",
        minutes: 3,
        xpReward: 10,
      },
      selectionReason: "Prepared for today",
      completedAt: null,
    },
    isLoading: false,
  };

  const profileWallpaper = {
    imageUrl: "https://example.com/profile-wallpaper.jpg",
    dateKey: "2026-02-22",
  };

  return {
    useAdaptiveDailyFormationMock,
    useWidgetSyncMock,
    authState,
    formationState,
    profileWallpaper,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.authState.user,
    status: mocks.authState.status,
  }),
}));

vi.mock("@/hooks/useAdaptiveDailyFormation", () => ({
  useAdaptiveDailyFormation: (...args: unknown[]) => mocks.useAdaptiveDailyFormationMock(...args),
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
    mocks.formationState.assignment.taskId = "task-1";
    mocks.formationState.assignment.completedAt = null;
    mocks.formationState.isLoading = false;
    mocks.useAdaptiveDailyFormationMock.mockReturnValue(mocks.formationState);
  });

  it("syncs one prepared daily practice instead of custom tasks", () => {
    renderHook(() => useGlobalWidgetSync());

    expect(mocks.useAdaptiveDailyFormationMock).toHaveBeenCalledWith({ enabled: true });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      [expect.objectContaining({
        id: "task-1",
        user_id: "user-1",
        source: "faithful_step",
        task_date: "2026-02-22",
        xp_reward: 10,
      })],
      mocks.formationState.assignment.practiceDate,
      { enabled: true, profileWallpaper: null },
    );
  });

  it("disables querying and syncing when hook is disabled", () => {
    renderHook(() => useGlobalWidgetSync({ enabled: false }));

    expect(mocks.useAdaptiveDailyFormationMock).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      [expect.objectContaining({ source: "faithful_step" })],
      mocks.formationState.assignment.practiceDate,
      { enabled: false, profileWallpaper: null },
    );
  });

  it("keeps sync enabled while auth is recovering when user exists", () => {
    mocks.authState.status = "recovering";

    renderHook(() => useGlobalWidgetSync());

    expect(mocks.useAdaptiveDailyFormationMock).toHaveBeenCalledWith({ enabled: true });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      [expect.objectContaining({ source: "faithful_step" })],
      mocks.formationState.assignment.practiceDate,
      { enabled: true, profileWallpaper: null },
    );
  });

  it("disables querying and syncing when user is missing", () => {
    mocks.authState.user = null;
    mocks.authState.status = "unauthenticated";

    renderHook(() => useGlobalWidgetSync());

    expect(mocks.useAdaptiveDailyFormationMock).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      [],
      mocks.formationState.assignment.practiceDate,
      { enabled: false, profileWallpaper: null },
    );
  });

  it("passes profile wallpaper metadata through to widget sync", () => {
    renderHook(() => useGlobalWidgetSync({ profileWallpaper: mocks.profileWallpaper }));

    expect(mocks.useWidgetSyncMock).toHaveBeenCalledWith(
      [expect.objectContaining({ source: "faithful_step" })],
      mocks.formationState.assignment.practiceDate,
      { enabled: true, profileWallpaper: mocks.profileWallpaper },
    );
  });
});
