import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAuthScopedClientState: vi.fn(),
  getSession: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    functions: {
      invoke: mocks.invoke,
    },
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

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("maps auth failures to a session-expired error", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Unauthorized",
        code: "ACCOUNT_DELETION_AUTH_REQUIRED",
        status: 401,
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );

    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: response,
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

  it("maps backend failures to a friendly temporary-unavailable message", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Account deletion is temporarily unavailable. Please try again later.",
        code: "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
        status: 500,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: response,
      },
    });

    const error = await deleteCurrentAccount({
      queryClient,
      userId: "user-1",
      signOut,
    }).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Account deletion is temporarily unavailable. Please try again later.");
    expect((error as Error).message).not.toContain("Edge Function returned a non-2xx status code");

    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("returns normalized warnings on success", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        warnings: [
          {
            code: "storage_cleanup_warning",
            message: "Cleanup will finish in the background.",
            details: { bucket: "evolution-cards" },
          },
        ],
      },
      error: null,
    });

    await expect(
      deleteCurrentAccount({
        queryClient,
        userId: "user-1",
        signOut,
      }),
    ).resolves.toEqual({
      warnings: [
        {
          code: "storage_cleanup_warning",
          message: "Cleanup will finish in the background.",
          details: { bucket: "evolution-cards" },
        },
      ],
    });

    expect(mocks.clearAuthScopedClientState).toHaveBeenCalledWith(queryClient, {
      previousUserId: "user-1",
      clearLegacyLocalState: true,
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
