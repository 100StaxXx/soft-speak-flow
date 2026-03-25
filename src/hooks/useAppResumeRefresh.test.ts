import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const refetchQueriesMock = vi.fn().mockResolvedValue(undefined);
  const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
  const addListenerMock = vi.fn();
  const removeListenerMock = vi.fn().mockResolvedValue(undefined);
  const loggerDebugMock = vi.fn();
  const loggerWarnMock = vi.fn();
  const state = {
    native: true,
    appStateHandler: null as null | ((payload: { isActive: boolean }) => Promise<void>),
  };

  return {
    refetchQueriesMock,
    invalidateQueriesMock,
    addListenerMock,
    removeListenerMock,
    loggerDebugMock,
    loggerWarnMock,
    state,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    refetchQueries: mocks.refetchQueriesMock,
    invalidateQueries: mocks.invalidateQueriesMock,
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.state.native,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addListenerMock,
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: mocks.loggerDebugMock,
    warn: mocks.loggerWarnMock,
  },
}));

import { useAppResumeRefresh } from "./useAppResumeRefresh";

describe("useAppResumeRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.native = true;
    mocks.state.appStateHandler = null;

    mocks.addListenerMock.mockImplementation(
      async (_event: string, callback: (payload: { isActive: boolean }) => Promise<void>) => {
        mocks.state.appStateHandler = callback;
        return { remove: mocks.removeListenerMock };
      },
    );
  });

  it("refreshes mentor and companion queries when the native app resumes", async () => {
    renderHook(() => useAppResumeRefresh());

    expect(mocks.addListenerMock).toHaveBeenCalledWith("appStateChange", expect.any(Function));

    await act(async () => {
      await mocks.state.appStateHandler?.({ isActive: true });
    });

    expect(mocks.refetchQueriesMock).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["mentor-page-data"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["selected-mentor"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["streak-freezes"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["companion"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["companion-health"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["companion-care-signals"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["current-evolution-card"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["evolution-cards"] });
  });
});
