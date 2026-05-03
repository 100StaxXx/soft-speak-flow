type SupabaseMutationResult = {
  error: unknown | null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return typeof error === "string" ? error : "";
};

const getErrorCode = (error: unknown): string => {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
};

const isMissingSchemaColumnError = (error: unknown, column: string): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    getErrorCode(error) === "PGRST204" &&
    message.includes(column.toLowerCase()) &&
    message.includes("schema cache")
  );
};

export const runDailyTaskCleanupUpdate = async (
  update: Record<string, unknown>,
  buildQuery: (
    updatePayload: Record<string, unknown>,
  ) => PromiseLike<SupabaseMutationResult>,
): Promise<void> => {
  const { error } = await buildQuery(update);
  if (!error) return;

  const fallback = { ...update };
  let shouldRetry = false;

  for (const column of ["epic_title", "excluded_from_planner_at"]) {
    if (column in fallback && isMissingSchemaColumnError(error, column)) {
      delete fallback[column];
      shouldRetry = true;
    }
  }

  if (!shouldRetry) throw error;

  const { error: retryError } = await buildQuery(fallback);
  if (retryError) throw retryError;
};
