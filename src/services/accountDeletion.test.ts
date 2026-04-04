import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAuthScopedClientState: vi.fn(),
  getSession: vi.fn(),
  invoke: vi.fn(),
  parseFunctionInvokeError: vi.fn(),
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

vi.mock("@/utils/supabaseFunctionErrors", () => ({
  parseFunctionInvokeError: mocks.parseFunctionInvokeError,
}));

import { deleteCurrentAccount, isAccountDeletionAuthError } from "./accountDeletion";

describe("accountDeletion", () => {
  const queryClient = {} as never;
  const signOut = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue(undefined);
    mocks.clearAuthScopedClientState.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    mocks.parseFunctionInvokeError.mockResolvedValue({
      category: "unknown",
      status: 500,
      message: undefined,
      backendMessage: undefined,
      code: undefined,
      responsePayload: undefined,
      retryAfterSeconds: undefined,
      upstreamStatus: undefined,
      upstreamError: undefined,
      isOffline: false,
      name: undefined,
    });
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

  it("maps edge function auth failures to a session-expired error", async () => {
    const rawError = new Error("Unauthorized");
    mocks.invoke.mockResolvedValue({
      data: null,
      error: rawError,
    });
    mocks.parseFunctionInvokeError.mockResolvedValue({
      category: "auth",
      status: 401,
      message: "Unauthorized",
      backendMessage: "Unauthorized",
      code: "ACCOUNT_DELETION_AUTH_REQUIRED",
      responsePayload: {
        error: "Unauthorized",
        code: "ACCOUNT_DELETION_AUTH_REQUIRED",
      },
      retryAfterSeconds: undefined,
      upstreamStatus: undefined,
      upstreamError: undefined,
      isOffline: false,
      name: "FunctionsHttpError",
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

  it("maps technical edge function failures to a friendly temporary-unavailable message", async () => {
    const rawError = new Error("Edge function returned a non-2xx status code");
    mocks.invoke.mockResolvedValue({
      data: null,
      error: rawError,
    });
    mocks.parseFunctionInvokeError.mockResolvedValue({
      category: "http",
      status: 500,
      message: "Edge function returned a non-2xx status code",
      backendMessage: "Account deletion is temporarily unavailable. Please try again later.",
      code: "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
      responsePayload: {
        error: "Account deletion is temporarily unavailable. Please try again later.",
        code: "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
      },
      retryAfterSeconds: undefined,
      upstreamStatus: undefined,
      upstreamError: undefined,
      isOffline: false,
      name: "FunctionsHttpError",
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

  it("clears local state and signs out after edge function success", async () => {
    const warnings = [{ code: "storage_cleanup_partial", message: "Some files are still cleaning up." }];
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        warnings,
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
      warnings,
    });

    expect(mocks.invoke).toHaveBeenCalledWith("delete-user", {
      headers: {
        Authorization: "Bearer access-token",
      },
    });
    expect(mocks.clearAuthScopedClientState).toHaveBeenCalledWith(queryClient, {
      previousUserId: "user-1",
      clearLegacyLocalState: true,
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
