import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { applyAbuseProtection, createAbuseAdminClient, createSafeErrorResponse, getClientIpAddress, normalizeEmailTarget } from "../_shared/abuseProtection.ts";
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

export async function handleAuthGateway(
  req: Request,
  deps: AuthGatewayDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const requestId = crypto.randomUUID();
  const ipAddress = getClientIpAddress(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "SERVICE_MISCONFIGURED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    let payload: AuthGatewayRequest;
    try {
      payload = await req.json() as AuthGatewayRequest;
    } catch {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_REQUEST",
        error: "Invalid request payload",
        requestId,
      });
    }

    const action = payload.action;
    const email = normalizeEmailTarget(payload.email);

    if (!action || !["sign_in_password", "sign_up_password", "reset_password"].includes(action)) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_ACTION",
        error: "Invalid request payload",
        requestId,
      });
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_EMAIL",
        error: "Enter a valid email address",
        requestId,
      });
    }

    const adminClient = deps.createAdminClient();

    if (action === "sign_in_password") {
      if (!payload.password || payload.password.length < 8) {
        return createSafeErrorResponse(req, {
          status: 400,
          code: "INVALID_PASSWORD",
          error: "Enter a valid password",
          requestId,
        });
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
        return ipProtection;
      }

      const supabase = deps.createAnonClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: payload.password,
      });

      if (error || !data.session || !data.user) {
        return createSafeErrorResponse(req, {
          status: 401,
          code: "INVALID_CREDENTIALS",
          error: sanitizeAuthError(error?.message, "Invalid email or password."),
          requestId,
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
        return createSafeErrorResponse(req, {
          status: 400,
          code: "INVALID_PASSWORD",
          error: "Enter a valid password",
          requestId,
        });
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
        return createSafeErrorResponse(req, {
          status: 400,
          code: "SIGN_UP_FAILED",
          error: "Unable to create account.",
          requestId,
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
      return protection;
    }

    const supabase = deps.createAnonClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: payload.redirectTo,
    });

    if (error) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "RESET_PASSWORD_FAILED",
        error: "Unable to process that request right now",
        requestId,
      });
    }

    return jsonSuccess(req, {
      success: true,
    });
  } catch (error) {
    console.error("[auth-gateway] Unexpected error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "AUTH_GATEWAY_FAILED",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleAuthGateway(req));
}
