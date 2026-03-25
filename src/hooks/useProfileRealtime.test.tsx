import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
  const removeChannelMock = vi.fn();
  const subscribeMock = vi.fn();
  const onMock = vi.fn();
  const channelMock = vi.fn();
  const state = {
    user: { id: "user-123" } as { id: string } | null,
    callback: null as null | (() => void),
  };

  return {
    invalidateQueriesMock,
    removeChannelMock,
    subscribeMock,
    onMock,
    channelMock,
    state,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueriesMock,
  }),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: mocks.state.user,
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channelMock,
    removeChannel: mocks.removeChannelMock,
  },
}));

import { useProfileRealtime } from "./useProfileRealtime";

describe("useProfileRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.user = { id: "user-123" };
    mocks.state.callback = null;

    mocks.onMock.mockImplementation((_event, _config, callback: () => void) => {
      mocks.state.callback = callback;
      return {
        on: mocks.onMock,
        subscribe: mocks.subscribeMock,
      };
    });

    mocks.subscribeMock.mockReturnValue({
      unsubscribe: vi.fn(),
    });

    mocks.channelMock.mockReturnValue({
      on: mocks.onMock,
    });
  });

  it("invalidates profile-derived queries when the signed-in profile changes", async () => {
    renderHook(() => useProfileRealtime());

    expect(mocks.channelMock).toHaveBeenCalledWith("profile-sync-user-123");
    expect(mocks.state.callback).toBeTypeOf("function");

    await act(async () => {
      mocks.state.callback?.();
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["mentor"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["mentor-page-data"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["mentor-personality"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["selected-mentor"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["streak-freezes"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["subscription"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["referral-stats"] });
  });
});
