export interface FunctionInvokeErrorSummary {
  name: string | null;
  message: string;
  status: number | null;
  body: string | null;
}

function getContextResponse(error: unknown): Response | null {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return null;
  }

  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : null;
}

function getErrorName(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown function invoke error";
}

export async function summarizeFunctionInvokeError(
  error: unknown,
  bodyLimit = 400,
): Promise<FunctionInvokeErrorSummary> {
  const contextResponse = getContextResponse(error);
  let body: string | null = null;

  if (contextResponse) {
    try {
      const raw = await contextResponse.clone().text();
      const trimmed = raw.trim();
      body = trimmed.length > bodyLimit ? `${trimmed.slice(0, bodyLimit)}...` : trimmed;
    } catch {
      body = null;
    }
  }

  return {
    name: getErrorName(error),
    message: getErrorMessage(error),
    status: contextResponse?.status ?? null,
    body,
  };
}
