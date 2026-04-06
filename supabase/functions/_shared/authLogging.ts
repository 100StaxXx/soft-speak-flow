type AuthLogLevel = "info" | "warn" | "error";

type AuthLogContext = Record<string, unknown>;

function compactContext(context: AuthLogContext = {}): AuthLogContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );
}

export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}

export function findMissingRequiredEnv(keys: string[]): string[] {
  return keys.filter((key) => {
    const value = Deno.env.get(key);
    return !(typeof value === "string" && value.trim().length > 0);
  });
}

export function logAuthEvent(
  scope: string,
  level: AuthLogLevel,
  message: string,
  context: AuthLogContext = {},
): void {
  const payload = compactContext(context);
  const args: unknown[] = [`[${scope}] ${message}`];

  if (Object.keys(payload).length > 0) {
    args.push(payload);
  }

  switch (level) {
    case "info":
      console.info(...args);
      return;
    case "warn":
      console.warn(...args);
      return;
    case "error":
      console.error(...args);
      return;
  }
}

export function logAuthSafeError(
  scope: string,
  options: {
    status: number;
    code: string;
    error: string;
    requestId: string;
    context?: AuthLogContext;
  },
): void {
  logAuthEvent(scope, options.status >= 500 ? "error" : "warn", options.error, {
    requestId: options.requestId,
    status: options.status,
    code: options.code,
    ...(options.context ?? {}),
  });
}

export async function readSafeErrorResponseContext(response: Response): Promise<AuthLogContext> {
  const requestId = response.headers.get("X-Request-Id") ?? undefined;
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  try {
    const body = await response.clone().json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const payload = body as Record<string, unknown>;
      return compactContext({
        status: response.status,
        code: typeof payload.code === "string" ? payload.code : undefined,
        error:
          typeof payload.error === "string"
            ? payload.error
            : typeof payload.message === "string"
              ? payload.message
              : undefined,
        requestId:
          typeof payload.requestId === "string"
            ? payload.requestId
            : requestId,
        retryAfterSeconds:
          typeof payload.retryAfterSeconds === "number"
            ? payload.retryAfterSeconds
            : typeof payload.retry_after_seconds === "number"
              ? payload.retry_after_seconds
              : retryAfterSeconds,
      });
    }
  } catch {
    // Ignore response parse failures and fall back to headers/status only.
  }

  return compactContext({
    status: response.status,
    requestId,
    retryAfterSeconds:
      typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : undefined,
  });
}
