import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { applyAbuseProtection, createAbuseAdminClient, createSafeErrorResponse, getClientIpAddress, normalizeEmailTarget } from "../_shared/abuseProtection.ts";
import { findMissingRequiredEnv, logAuthEvent, logAuthSafeError, readSafeErrorResponseContext, toAuthErrorMessage } from "../_shared/authLogging.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

type AuthGatewayAction =
  | "sign_in_password"
  | "sign_up_password"
  | "reset_password";

interface AuthGatewayRequest {
  action?: AuthGatewayAction;
  email?: string;
  password?: string;
  redirectTo?: string;
  timezone?: string;
}

interface AuthGatewayDeps {
  createAdminClient: () => any;
  createAnonClient: (supabaseUrl: string, supabaseAnonKey: string) => any;
  applyAbuseProtectionFn: typeof applyAbuseProtection;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_ENV_KEYS = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

const defaultDeps: AuthGatewayDeps = {
  createAdminClient: () => createAbuseAdminClient(),
  createAnonClient: (supabaseUrl: string, supabaseAnonKey: string) => createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }),
  applyAbuseProtectionFn: applyAbuseProtection,
};

function jsonSuccess(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function sanitizeAuthError(message: string | undefined, fallback: string): string {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("invalid login credentials") || normalized.includes("invalid_grant")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Check your email to finish signing in.";
  }

  return fallback;
}

interface SupabaseProviderError {
  code?: string;
  message?: string;
  status?: number;
  weak_password?: {
    message?: string;
    reasons?: string[];
  };
}

function isLikelyTechnicalSignUpMessage(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";

  return (
    normalized.includes("database error") ||
    normalized.includes("unexpected_failure") ||
    normalized.includes("internal server error") ||
    normalized.includes("smtp") ||
    normalized.includes("hook") ||
    normalized.includes("500")
  );
}

function getWeakPasswordMessage(error: SupabaseProviderError): string {
  const reasons = Array.isArray(error.weak_password?.reasons)
    ? error.weak_password.reasons
        .filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
        .map((reason) => reason.trim().replace(/[.]+$/, ""))
    : [];

  if (reasons.length > 0) {
    return `Choose a stronger password. ${reasons.join("; ")}.`;
  }

  const providerMessage = error.weak_password?.message?.trim();
  if (providerMessage) {
    return providerMessage;
  }

  return "Choose a stronger password. Use at least 8 characters with a mix of letters, numbers, or symbols.";
}

function sanitizeSignUpError(error: unknown): {
  status: number;
  code: string;
  error: string;
} {
  const providerError = (error ?? {}) as SupabaseProviderError;
  const providerCode = providerError.code?.toLowerCase() ?? "";
  const providerMessage = toAuthErrorMessage(error).trim();
  const normalized = providerMessage.toLowerCase();

  if (
    providerCode === "email_exists" ||
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return {
      status: 409,
      code: "EMAIL_ALREADY_REGISTERED",
      error: "An account with this email already exists. Try signing in instead.",
    };
  }

  if (
    providerCode === "email_address_invalid" ||
    (providerCode === "validation_failed" && normalized.includes("email")) ||
    normalized.includes("invalid email") ||
    normalized.includes("email address") && normalized.includes("invalid") ||
    normalized.includes("must be a valid email")
  ) {
    return {
      status: providerError.status ?? 400,
      code: "INVALID_EMAIL",
      error: "Enter a valid email address.",
    };
  }

  if (
    providerCode === "weak_password" ||
    (providerCode === "validation_failed" && normalized.includes("password")) ||
    normalized.includes("weak password")
  ) {
    return {
      status: providerError.status ?? 400,
      code: "WEAK_PASSWORD",
      error: getWeakPasswordMessage(providerError),
    };
  }

  if (
    providerCode === "over_request_rate_limit" ||
    providerCode === "over_email_send_rate_limit" ||
    normalized.includes("rate limit") ||
    (normalized.includes("security purposes") && normalized.includes("request this"))
  ) {
    return {
      status: providerError.status ?? 429,
      code: "SIGN_UP_RATE_LIMITED",
      error: "Too many sign-up attempts. Please wait a moment and try again.",
    };
  }

  if (
    providerCode === "email_provider_disabled" ||
    providerCode === "signup_disabled" ||
    normalized.includes("email signups are disabled") ||
    normalized.includes("signups not allowed")
  ) {
    return {
      status: providerError.status ?? 503,
      code: "EMAIL_SIGNUPS_DISABLED",
      error: "Email sign-up is currently unavailable. Please try again later.",
    };
  }

  if (
    providerCode === "email_address_not_authorized" ||
    normalized.includes("email address is not authorized")
  ) {
    return {
      status: providerError.status ?? 400,
      code: "EMAIL_NOT_AUTHORIZED",
      error: "We can't send sign-up emails to that address right now. Please use a different email or contact support.",
    };
  }

  if (providerCode === "user_banned") {
    return {
      status: providerError.status ?? 403,
      code: "USER_BANNED",
      error: "This email can't create an account right now. Contact support if this seems wrong.",
    };
  }

  if (providerMessage && !isLikelyTechnicalSignUpMessage(providerMessage)) {
    return {
      status: providerError.status ?? 400,
      code: "SIGN_UP_FAILED",
      error: providerMessage,
    };
  }

  return {
    status: providerError.status ?? 400,
    code: "SIGN_UP_FAILED",
    error: "Unable to create account right now. Please try again in a moment.",
  };
}

function buildRequestContext(
  action: string | undefined,
  ipAddress: string,
  payload?: AuthGatewayRequest | null,
): Record<string, unknown> {
  return {
    action,
    clientIpKnown: ipAddress !== "unknown",
    emailProvided: Boolean(normalizeEmailTarget(payload?.email)),
    passwordProvided: typeof payload?.password === "string" && payload.password.length > 0,
    redirectToProvided: typeof payload?.redirectTo === "string" && payload.redirectTo.length > 0,
    timezoneProvided: typeof payload?.timezone === "string" && payload.timezone.length > 0,
  };
}

export async function handleAuthGateway(
  req: Request,
  deps: AuthGatewayDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const requestId = crypto.randomUUID();
  const ipAddress = getClientIpAddress(req);
  let payload: AuthGatewayRequest | undefined;
  let action: string | undefined;

  const createLoggedSafeErrorResponse = (
    options: {
      status: number;
      code: string;
      error: string;
      retryAfterSeconds?: number | null;
    },
    context: Record<string, unknown> = {},
  ): Response => {
    logAuthSafeError("auth-gateway", {
      requestId,
      status: options.status,
      code: options.code,
      error: options.error,
      context,
    });

    return createSafeErrorResponse(req, {
      requestId,
      ...options,
    });
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const missingEnvKeys = findMissingRequiredEnv([...REQUIRED_ENV_KEYS]);

    if (!supabaseUrl || !supabaseAnonKey || missingEnvKeys.length > 0) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "SERVICE_MISCONFIGURED",
        error: "Request could not be processed right now",
      }, {
        action,
        clientIpKnown: ipAddress !== "unknown",
        missingEnvKeys: missingEnvKeys.join(","),
      });
    }

    try {
      payload = await req.json() as AuthGatewayRequest;
    } catch {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "INVALID_REQUEST",
        error: "Invalid request payload",
      }, {
        action,
        clientIpKnown: ipAddress !== "unknown",
      });
    }

    action = payload.action;
    const email = normalizeEmailTarget(payload.email);
    const requestContext = buildRequestContext(action, ipAddress, payload);

    if (!action || !["sign_in_password", "sign_up_password", "reset_password"].includes(action)) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "INVALID_ACTION",
        error: "Invalid request payload",
      }, requestContext);
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "INVALID_EMAIL",
        error: "Enter a valid email address",
      }, requestContext);
    }

    let adminClient: any;
    try {
      adminClient = deps.createAdminClient();
      logAuthEvent("auth-gateway", "info", "Admin client ready", {
        requestId,
        action,
        clientIpKnown: ipAddress !== "unknown",
      });
    } catch (error) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "SERVICE_MISCONFIGURED",
        error: "Request could not be processed right now",
      }, {
        ...requestContext,
        errorMessage: toAuthErrorMessage(error),
      });
    }

    if (action === "sign_in_password") {
      if (!payload.password || payload.password.length < 8) {
        return createLoggedSafeErrorResponse({
          status: 400,
          code: "INVALID_PASSWORD",
          error: "Enter a valid password",
        }, requestContext);
      }

      const ipProtection = await deps.applyAbuseProtectionFn(req, adminClient, {
        profileKey: "auth.sign_in",
        endpointName: "auth-gateway:sign_in_password",
        requestId,
        ipAddress,
        emailTarget: email,
        blockedMessage: "Too many sign-in attempts. Please try again later.",
        metadata: {
          action,
          phase: "pre_auth",
        },
      });

      if (ipProtection instanceof Response) {
        logAuthEvent("auth-gateway", ipProtection.status >= 500 ? "error" : "warn", "Pre-auth abuse protection blocked request", {
          ...requestContext,
          phase: "pre_auth",
          ...(await readSafeErrorResponseContext(ipProtection)),
        });
        return ipProtection;
      }

      const supabase = deps.createAnonClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: payload.password,
      });

      if (error || !data.session || !data.user) {
        return createLoggedSafeErrorResponse({
          status: 401,
          code: "INVALID_CREDENTIALS",
          error: sanitizeAuthError(error?.message, "Invalid email or password."),
        }, {
          ...requestContext,
          phase: "provider_auth",
        });
      }

      const userProtection = await deps.applyAbuseProtectionFn(req, adminClient, {
        profileKey: "auth.sign_in",
        endpointName: "auth-gateway:sign_in_password",
        requestId,
        userId: data.user.id,
        ipAddress: null,
        blockedMessage: "Too many sign-in attempts. Please try again later.",
        metadata: {
          action,
          phase: "post_auth",
        },
      });

      if (userProtection instanceof Response) {
        logAuthEvent("auth-gateway", userProtection.status >= 500 ? "error" : "warn", "Post-auth abuse protection blocked request", {
          ...requestContext,
          phase: "post_auth",
          userId: data.user.id,
          ...(await readSafeErrorResponseContext(userProtection)),
        });
        return userProtection;
      }

      return jsonSuccess(req, {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
      });
    }

    if (action === "sign_up_password") {
      if (!payload.password || payload.password.length < 8) {
        return createLoggedSafeErrorResponse({
          status: 400,
          code: "INVALID_PASSWORD",
          error: "Enter a valid password",
        }, requestContext);
      }

      const protection = await deps.applyAbuseProtectionFn(req, adminClient, {
        profileKey: "auth.sign_up",
        endpointName: "auth-gateway:sign_up_password",
        requestId,
        ipAddress,
        emailTarget: email,
        blockedMessage: "Too many sign-up attempts. Please try again later.",
        metadata: {
          action,
        },
      });

      if (protection instanceof Response) {
        logAuthEvent("auth-gateway", protection.status >= 500 ? "error" : "warn", "Pre-auth abuse protection blocked request", {
          ...requestContext,
          phase: "pre_auth",
          ...(await readSafeErrorResponseContext(protection)),
        });
        return protection;
      }

      const supabase = deps.createAnonClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: payload.password,
        options: {
          emailRedirectTo: payload.redirectTo,
          data: {
            timezone: payload.timezone || "UTC",
          },
        },
      });

      if (error) {
        const safeSignUpError = sanitizeSignUpError(error);
        logAuthEvent("auth-gateway", "error", "Supabase password sign-up failed", {
          ...requestContext,
          requestId,
          phase: "provider_auth",
          providerErrorMessage: error.message,
          providerErrorCode: error.code,
          providerErrorStatus: error.status,
        });
        return createLoggedSafeErrorResponse({
          status: safeSignUpError.status,
          code: safeSignUpError.code,
          error: safeSignUpError.error,
        }, {
          ...requestContext,
          phase: "provider_auth",
        });
      }

      return jsonSuccess(req, {
        access_token: data.session?.access_token ?? null,
        refresh_token: data.session?.refresh_token ?? null,
        user: data.user ?? null,
        requiresEmailConfirmation: !data.session,
      });
    }

    const protection = await deps.applyAbuseProtectionFn(req, adminClient, {
      profileKey: "auth.reset_password",
      endpointName: "auth-gateway:reset_password",
      requestId,
      ipAddress,
      emailTarget: email,
      blockedMessage: "Too many password reset requests. Please try again later.",
      metadata: {
        action,
      },
    });

    if (protection instanceof Response) {
      logAuthEvent("auth-gateway", protection.status >= 500 ? "error" : "warn", "Password reset abuse protection blocked request", {
        ...requestContext,
        phase: "pre_auth",
        ...(await readSafeErrorResponseContext(protection)),
      });
      return protection;
    }

    const supabase = deps.createAnonClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: payload.redirectTo,
    });

    if (error) {
      logAuthEvent("auth-gateway", "error", "Supabase password reset request failed", {
        ...requestContext,
        requestId,
        phase: "provider_auth",
        providerErrorMessage: error.message,
      });
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "RESET_PASSWORD_FAILED",
        error: "Unable to process that request right now",
      }, {
        ...requestContext,
        phase: "provider_auth",
      });
    }

    return jsonSuccess(req, {
      success: true,
    });
  } catch (error) {
    return createLoggedSafeErrorResponse({
      status: 500,
      code: "AUTH_GATEWAY_FAILED",
      error: "Request could not be processed right now",
    }, {
      ...buildRequestContext(action, ipAddress, payload),
      errorMessage: toAuthErrorMessage(error),
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleAuthGateway(req));
}
