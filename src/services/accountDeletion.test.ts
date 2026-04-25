import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAuthScopedClientState: vi.fn(),
  getSession: vi.fn(),
  invoke: vi.fn(),
  parseFunctionInvokeError: vi.fn(),
  toUserFacingFunctionError: vi.fn(),
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
  toUserFacingFunctionError: mocks.toUserFacingFunctionError,
}));

import {
  deleteCurrentAccount,
  getAccountDeletionErrorMetadata,
  getAccountDeletionFailureMessage,
  isAccountDeletionAuthError,
} from "./accountDeletion";

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
    mocks.toUserFacingFunctionError.mockReturnValue("Unable to delete your account. Please try again.");
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
    expect(getAccountDeletionErrorMetadata(error)).toEqual({
      code: "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
      status: 500,
    });

    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("preserves requestId and stage from edge function transport failures", async () => {
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
      code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
      responsePayload: {
        error: "Account deletion is temporarily unavailable. Please try again later.",
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        requestId: "req-delete-1",
        stage: "storage_cleanup",
        failureReason: "permission",
      },
      requestId: "req-delete-1",
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

    expect(getAccountDeletionErrorMetadata(error)).toEqual({
      code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
      status: 500,
      requestId: "req-delete-1",
      stage: "storage_cleanup",
      failureReason: "permission",
    });
    expect(getAccountDeletionFailureMessage(error)).toBe(
      "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
    );
  });

  it("infers a stage-specific failure from the edge function code when stage is omitted", async () => {
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
      code: "ACCOUNT_DELETION_RELATIONAL_CLEANUP_FAILED",
      responsePayload: {
        error: "Account deletion is temporarily unavailable. Please try again later.",
        code: "ACCOUNT_DELETION_RELATIONAL_CLEANUP_FAILED",
        requestId: "req-delete-code-only",
      },
      requestId: "req-delete-code-only",
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

    expect(getAccountDeletionErrorMetadata(error)).toEqual({
      code: "ACCOUNT_DELETION_RELATIONAL_CLEANUP_FAILED",
      status: 500,
      requestId: "req-delete-code-only",
      stage: "relational_cleanup",
    });
    expect(getAccountDeletionFailureMessage(error)).toBe(
      "We couldn't finish removing your account data, so your account wasn't removed. Please try again.",
    );
  });

  it("maps non-success function payloads without clearing local state", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        success: false,
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        error: "Account deletion is temporarily unavailable. Please try again later.",
        requestId: "req-delete-2",
        stage: "storage_cleanup",
        failureReason: "storage_api",
      },
      error: null,
    });

    const error = await deleteCurrentAccount({
      queryClient,
      userId: "user-1",
      signOut,
    }).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Account deletion is temporarily unavailable. Please try again later.");
    expect(getAccountDeletionErrorMetadata(error)).toEqual({
      code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
      requestId: "req-delete-2",
      stage: "storage_cleanup",
      failureReason: "storage_api",
    });
    expect(getAccountDeletionFailureMessage(error)).toBe(
      "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
    );
    expect(mocks.clearAuthScopedClientState).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("infers a stage-specific failure from a non-success payload code when stage is omitted", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        success: false,
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        error: "Account deletion is temporarily unavailable. Please try again later.",
        requestId: "req-delete-payload-code-only",
      },
      error: null,
    });

    const error = await deleteCurrentAccount({
      queryClient,
      userId: "user-1",
      signOut,
    }).catch((caughtError) => caughtError);

    expect(getAccountDeletionErrorMetadata(error)).toEqual({
      code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
      requestId: "req-delete-payload-code-only",
      stage: "storage_cleanup",
    });
    expect(getAccountDeletionFailureMessage(error)).toBe(
      "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
    );
  });

  it("clears local state and signs out after edge function success", async () => {
    const warnings = [{ code: "storage_cleanup_partial", message: "Some files are still cleaning up." }];
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        requestId: "req-delete-success-1",
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
      requestId: "req-delete-success-1",
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
