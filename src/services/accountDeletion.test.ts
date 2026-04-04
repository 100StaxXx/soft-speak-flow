import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAuthScopedClientState: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    rpc: mocks.rpc,
  },
}));

vi.mock("@/services/authScopedClientState", () => ({
  clearAuthScopedClientState: mocks.clearAuthScopedClientState,
}));

import { deleteCurrentAccount, isAccountDeletionAuthError } from "./accountDeletion";

describe("accountDeletion", () => {
  const queryClient = {} as never;
  const signOut = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue(undefined);
    mocks.clearAuthScopedClientState.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
        },
      },
      error: null,
    });
  });

  it("throws a session-expired error when there is no active session", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      deleteCurrentAccount({
        queryClient,
        userId: "user-1",
        signOut,
      }),
    ).rejects.toThrow("Session expired. Please sign in again.");

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("maps rpc auth failures to a session-expired error", async () => {
    mocks.rpc.mockResolvedValue({
      error: {
        message: "Unauthorized: You can only delete your own account",
      },
    });

    const error = await deleteCurrentAccount({
      queryClient,
      userId: "user-1",
      signOut,
    }).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Session expired. Please sign in again.");
    expect(isAccountDeletionAuthError(error)).toBe(true);
    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("maps technical rpc failures to a friendly temporary-unavailable message", async () => {
    mocks.rpc.mockResolvedValue({
      error: {
        code: "23503",
        message: "update or delete on table \"profiles\" violates foreign key constraint",
      },
    });

    const error = await deleteCurrentAccount({
      queryClient,
      userId: "user-1",
      signOut,
    }).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Account deletion is temporarily unavailable. Please try again later.");

    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("clears local state and signs out after rpc success", async () => {
    await expect(
      deleteCurrentAccount({
        queryClient,
        userId: "user-1",
        signOut,
      }),
    ).resolves.toEqual({
      warnings: [],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("delete_user_account", {
      p_user_id: "user-1",
    });
    expect(mocks.clearAuthScopedClientState).toHaveBeenCalledWith(queryClient, {
      previousUserId: "user-1",
      clearLegacyLocalState: true,
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
