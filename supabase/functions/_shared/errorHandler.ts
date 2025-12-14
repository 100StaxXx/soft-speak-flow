// Shared error handler for database and Supabase errors
// Handles common error codes like 42P01 (undefined table)

export interface ErrorResponse {
  message: string;
  status: number;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Handles database and Supabase errors, providing user-friendly messages
 * @param error - The error object from Supabase or database
 * @returns Formatted error response
 */
export function handleDatabaseError(error: unknown): ErrorResponse {
  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("unauthorized") || message.includes("jwt") || message.includes("token")) {
      return {
        message: "Session expired. Please sign in again.",
        status: 401,
      };
    }
    return {
      message: error.message,
      status: 500,
    };
  }

  // Handle Supabase error objects
  if (typeof error === "object" && error !== null) {
    const supabaseError = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    const code = supabaseError.code;
    const message = supabaseError.message || "Unknown error";
    let status = 500;
    let userMessage = message;

    // Handle specific PostgreSQL error codes
    switch (code) {
      case "42P01": // undefined_table
        userMessage = `Database table not found. This usually means a migration hasn't been applied.`;
        if (supabaseError.details) {
          userMessage += ` Details: ${supabaseError.details}`;
        }
        if (supabaseError.hint) {
          userMessage += ` Hint: ${supabaseError.hint}`;
        }
        status = 500;
        break;

      case "42P02": // undefined_parameter
        userMessage = `Database parameter not found: ${supabaseError.details || message}`;
        status = 500;
        break;

      case "42703": // undefined_column
        userMessage = `Database column not found. This usually means a migration hasn't been applied.`;
        if (supabaseError.details) {
          userMessage += ` Details: ${supabaseError.details}`;
        }
        status = 500;
        break;

      case "42883": // undefined_function
        userMessage = `Database function not found. This usually means a migration hasn't been applied.`;
        if (supabaseError.details) {
          userMessage += ` Details: ${supabaseError.details}`;
        }
        status = 500;
        break;

      case "23505": // unique_violation
        userMessage = "A record with this information already exists.";
        status = 409;
        break;

      case "23503": // foreign_key_violation
        userMessage = "Referenced record does not exist.";
        status = 400;
        break;

      case "23502": // not_null_violation
        userMessage = "Required field is missing.";
        status = 400;
        break;

      case "PGRST116": // PostgREST not found
        userMessage = "The requested resource was not found.";
        status = 404;
        break;

      default:
        // Check for auth-related errors
        if (message.toLowerCase().includes("unauthorized") || 
            message.toLowerCase().includes("jwt") || 
            message.toLowerCase().includes("token") ||
            message.toLowerCase().includes("session")) {
          userMessage = "Session expired. Please sign in again.";
          status = 401;
        }
        break;
    }

    return {
      message: userMessage,
      status,
      code,
      details: supabaseError.details,
      hint: supabaseError.hint,
    };
  }

  // Fallback for unknown error types
  return {
    message: "An unexpected error occurred",
    status: 500,
  };
}

/**
 * Creates a JSON error response for HTTP responses
 * @param error - The error object
 * @param req - The request object (for CORS headers)
 * @returns Response object
 */
export function createErrorResponse(
  error: unknown,
  req: Request,
  corsHeaders: Record<string, string> = {}
): Response {
  const errorResponse = handleDatabaseError(error);
  
  const payload: Record<string, unknown> = {
    success: false,
    error: errorResponse.message,
  };

  if (errorResponse.code) {
    payload.code = errorResponse.code;
  }
  if (errorResponse.details) {
    payload.details = errorResponse.details;
  }
  if (errorResponse.hint) {
    payload.hint = errorResponse.hint;
  }

  return new Response(JSON.stringify(payload), {
    status: errorResponse.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Logs error with context for debugging
 * @param error - The error object
 * @param context - Additional context about where the error occurred
 */
export function logError(error: unknown, context?: string): void {
  const errorResponse = handleDatabaseError(error);
  const logMessage = context 
    ? `[${context}] ${errorResponse.message}`
    : errorResponse.message;
  
  console.error(logMessage, {
    code: errorResponse.code,
    details: errorResponse.details,
    hint: errorResponse.hint,
    error: error instanceof Error ? error.stack : error,
  });
}
