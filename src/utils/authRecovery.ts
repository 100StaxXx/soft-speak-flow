export const AUTH_REQUEST_TIMEOUT_MS = 15_000;
export const AUTH_SESSION_CHECK_TIMEOUT_MS = 35_000;

/** A waiting SDK queue must not keep the app's bootstrap promise alive forever. */
export const checkSessionWithDeadline = async <T>(check: () => Promise<T>): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(Object.assign(
          new Error("Saved sign-in check did not finish"), { code: "AUTH_SESSION_CHECK_TIMEOUT" },
        )), AUTH_SESSION_CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

export type AuthRecoveryIssue = "secure_storage" | "connection";
export const getAuthRecoveryIssue = (error: unknown): AuthRecoveryIssue => {
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if ((typeof code === "string" && code.startsWith("AUTH_STORAGE_")) ||
      (typeof message === "string" && /secure session|session storage key/i.test(message))) {
      return "secure_storage";
    }
  }
  return "connection";
};

/** Bound auth requests (including response bodies), not calendar/AI requests. */
export const createAuthRecoveryFetch = (
  supabaseUrl: string,
  fetchRequest: typeof fetch = (input, init) => globalThis.fetch(input, init),
): typeof fetch => {
  const authUrl = new URL("auth/v1/", `${supabaseUrl.replace(/\/$/, "")}/`);
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== authUrl.origin || !url.pathname.startsWith(authUrl.pathname)) {
      return fetchRequest(input, init);
    }

    const controller = new AbortController();
    const upstreamSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(upstreamSignal?.reason);
    upstreamSignal?.addEventListener("abort", abort, { once: true });
    if (upstreamSignal?.aborted) abort();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchRequest(input, { ...init, signal: controller.signal });
          // Headers arriving is not sufficient: a stalled body also holds the
          // SDK's session lock. Auth responses are small, non-streaming JSON.
          const body = await response.arrayBuffer();
          return new Response(body.byteLength ? body : null, {
            status: response.status, statusText: response.statusText, headers: response.headers,
          });
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            // Fetch errors are retryable to the SDK, preserving saved tokens.
            // Do not synthesize an unauthorized response or clear storage.
            reject(new Error("Sign-in connection timed out. Please retry."));
          }, AUTH_REQUEST_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", abort);
    }
  };
};

/** Recreate the SDK and native bridge without clearing either session store. */
export const restartAuthRecovery = () => window.location.reload();
