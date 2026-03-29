import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders } from "./cors.ts";
import { requireRequestAuth, type RequestAuth } from "./auth.ts";

export interface AbuseProtectionResult {
  allowed: boolean;
  code: string;
  retry_after_seconds: number | null;
  matched_profile: string;
  limit_user: number | null;
  remaining_user: number | null;
  reset_user_at: string | null;
  limit_ip: number | null;
  remaining_ip: number | null;
  reset_ip_at: string | null;
  limit_email: number | null;
  remaining_email: number | null;
  reset_email_at: string | null;
  cooldown_until: string | null;
}

export interface AbuseProtectedContext {
  auth: RequestAuth;
  supabase: SupabaseClient;
  requestId: string;
  ipAddress: string;
  protection: AbuseProtectionResult | null;
}

interface RateLimitWindow {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

interface SafeErrorOptions {
  status: number;
  code: string;
  error: string;
  requestId: string;
  retryAfterSeconds?: number | null;
  protection?: AbuseProtectionResult | null;
  extraHeaders?: HeadersInit;
}

interface AbuseProtectionOptions {
  profileKey: string;
  endpointName: string;
  userId?: string | null;
  emailTarget?: string | null;
  requestId: string;
  ipAddress?: string | null;
  blockedMessage?: string;
  metadata?: Record<string, unknown>;
}

interface ProtectedRequestOptions {
  profileKey: string;
  endpointName: string;
  allowServiceRole?: boolean;
  bypassServiceRoleRateLimit?: boolean;
  blockedMessage?: string;
  emailTarget?: string | null;
  metadata?: Record<string, unknown>;
}

interface AbuseEventOptions {
  eventType: "blocked_limit" | "blocked_cooldown" | "bypass_attempt" | "limiter_error" | "blocked_policy";
  endpointName: string;
  code: string;
  requestId: string;
  severity?: "low" | "medium" | "high" | "critical";
  profileKey?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  emailTarget?: string | null;
  retryAfterSeconds?: number | null;
  metadata?: Record<string, unknown>;
}

const AUTH_ERROR_MESSAGES: Record<number, { code: string; error: string }> = {
  401: { code: "UNAUTHORIZED", error: "Unauthorized" },
  403: { code: "FORBIDDEN", error: "Forbidden" },
  500: { code: "AUTH_UNAVAILABLE", error: "Request could not be authorized" },
};

export function normalizeEmailTarget(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function getClientIpAddress(req: Request): string {
  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const forwardedIp = req.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (forwardedIp) return forwardedIp;

  return "unknown";
}

export function createAbuseAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getPrimaryRateLimitWindow(protection: AbuseProtectionResult | null | undefined): RateLimitWindow | null {
  if (!protection) return null;

  const windows: RateLimitWindow[] = [
    {
      limit: protection.limit_user,
      remaining: protection.remaining_user,
      resetAt: protection.reset_user_at,
    },
    {
      limit: protection.limit_ip,
      remaining: protection.remaining_ip,
      resetAt: protection.reset_ip_at,
    },
    {
      limit: protection.limit_email,
      remaining: protection.remaining_email,
      resetAt: protection.reset_email_at,
    },
  ];

  return windows.find((window) =>
    window.limit !== null && (window.remaining !== null || window.resetAt !== null)
  ) ?? null;
}

export function createSafeErrorResponse(req: Request, options: SafeErrorOptions): Response {
  const corsHeaders = getCorsHeaders(req);
  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-Request-Id": options.requestId,
  });

  if (options.extraHeaders) {
    for (const [key, value] of new Headers(options.extraHeaders).entries()) {
      headers.set(key, value);
    }
  }

  if (options.retryAfterSeconds && options.retryAfterSeconds > 0) {
    headers.set("Retry-After", String(options.retryAfterSeconds));
  }

  const primaryWindow = getPrimaryRateLimitWindow(options.protection);
  if (primaryWindow && primaryWindow.limit !== null) {
    headers.set("X-RateLimit-Limit", String(primaryWindow.limit));
  }
  if (primaryWindow && primaryWindow.remaining !== null) {
    headers.set("X-RateLimit-Remaining", String(primaryWindow.remaining));
  }
  if (primaryWindow?.resetAt) {
    headers.set("X-RateLimit-Reset", primaryWindow.resetAt);
  }
  if (options.protection?.matched_profile) {
    headers.set("X-RateLimit-Profile", options.protection.matched_profile);
  }

  return new Response(
    JSON.stringify({
      error: options.error,
      code: options.code,
      requestId: options.requestId,
      ...(options.retryAfterSeconds && options.retryAfterSeconds > 0
        ? { retryAfterSeconds: options.retryAfterSeconds }
        : {}),
    }),
    {
      status: options.status,
      headers,
    },
  );
}

export async function recordAbuseEvent(
  supabase: SupabaseClient,
  options: AbuseEventOptions,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_abuse_event", {
      p_event_type: options.eventType,
      p_endpoint_name: options.endpointName,
      p_code: options.code,
      p_request_id: options.requestId,
      p_severity: options.severity ?? "medium",
      p_profile_key: options.profileKey ?? null,
      p_user_id: options.userId ?? null,
      p_ip_address: options.ipAddress ?? null,
      p_email_target: normalizeEmailTarget(options.emailTarget),
      p_retry_after_seconds: options.retryAfterSeconds ?? null,
      p_metadata: options.metadata ?? {},
    });

    if (error) {
      console.error("[abuseProtection] Failed to record abuse event", error);
    }
  } catch (error) {
    console.error("[abuseProtection] Abuse event logging threw", error);
  }
}

export async function applyAbuseProtection(
  req: Request,
  supabase: SupabaseClient,
  options: AbuseProtectionOptions,
): Promise<Response | { requestId: string; ipAddress: string; protection: AbuseProtectionResult }> {
  const { data, error } = await supabase.rpc("consume_abuse_protection", {
    p_profile_key: options.profileKey,
    p_endpoint_name: options.endpointName,
    p_user_id: options.userId ?? null,
      p_ip_address: options.ipAddress ?? null,
    p_email_target: normalizeEmailTarget(options.emailTarget),
    p_request_id: options.requestId,
    p_metadata: options.metadata ?? {},
  });

  if (error) {
    console.error("[abuseProtection] consume_abuse_protection failed", error);
    await recordAbuseEvent(supabase, {
      eventType: "limiter_error",
      endpointName: options.endpointName,
      code: "abuse_check_failed",
      requestId: options.requestId,
      severity: "critical",
      profileKey: options.profileKey,
      userId: options.userId,
      ipAddress: options.ipAddress ?? null,
      emailTarget: options.emailTarget,
      metadata: {
        ...options.metadata,
        message: error.message,
      },
    });

    return createSafeErrorResponse(req, {
      status: 503,
      code: "ABUSE_CHECK_FAILED",
      error: "Request could not be processed right now",
      requestId: options.requestId,
    });
  }

  const protection = (Array.isArray(data) ? data[0] : data) as AbuseProtectionResult | null;

  if (!protection) {
    await recordAbuseEvent(supabase, {
      eventType: "limiter_error",
      endpointName: options.endpointName,
      code: "abuse_check_missing_result",
      requestId: options.requestId,
      severity: "critical",
      profileKey: options.profileKey,
      userId: options.userId,
      ipAddress: options.ipAddress ?? null,
      emailTarget: options.emailTarget,
      metadata: options.metadata,
    });

    return createSafeErrorResponse(req, {
      status: 503,
      code: "ABUSE_CHECK_FAILED",
      error: "Request could not be processed right now",
      requestId: options.requestId,
    });
  }

  if (!protection.allowed) {
    const code = protection.code === "cooldown_active" ? "COOLDOWN_ACTIVE" : "RATE_LIMITED";
    return createSafeErrorResponse(req, {
      status: 429,
      code,
      error: options.blockedMessage ?? "Too many requests. Please try again later.",
      requestId: options.requestId,
      retryAfterSeconds: protection.retry_after_seconds,
      protection,
    });
  }

  return {
    requestId: options.requestId,
    ipAddress: options.ipAddress ?? "unknown",
    protection,
  };
}

export async function requireProtectedRequest(
  req: Request,
  options: ProtectedRequestOptions,
): Promise<Response | AbuseProtectedContext> {
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIpAddress(req);

  let supabase: SupabaseClient;
  try {
    supabase = createAbuseAdminClient();
  } catch (error) {
    console.error("[abuseProtection] Failed to create admin client", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "SERVICE_MISCONFIGURED",
      error: "Request could not be processed right now",
      requestId,
    });
  }

  const auth = await requireRequestAuth(req, getCorsHeaders(req));
  if (auth instanceof Response) {
    const authError = AUTH_ERROR_MESSAGES[auth.status] ?? {
      code: "AUTH_FAILED",
      error: "Request could not be authorized",
    };

    return createSafeErrorResponse(req, {
      status: auth.status,
      code: authError.code,
      error: authError.error,
      requestId,
    });
  }

  if (auth.isServiceRole && options.allowServiceRole === false) {
    return createSafeErrorResponse(req, {
      status: 403,
      code: "FORBIDDEN",
      error: "Forbidden",
      requestId,
    });
  }

  let protection: AbuseProtectionResult | null = null;

  if (!(auth.isServiceRole && options.bypassServiceRoleRateLimit !== false)) {
    const abuseResult = await applyAbuseProtection(req, supabase, {
      profileKey: options.profileKey,
      endpointName: options.endpointName,
      userId: auth.userId,
      emailTarget: options.emailTarget,
      requestId,
      ipAddress,
      blockedMessage: options.blockedMessage,
      metadata: options.metadata,
    });

    if (abuseResult instanceof Response) {
      return abuseResult;
    }

    protection = abuseResult.protection;
  }

  return {
    auth,
    supabase,
    requestId,
    ipAddress,
    protection,
  };
}

export async function logBypassAttempt(
  supabase: SupabaseClient,
  req: Request,
  options: {
    endpointName: string;
    requestId: string;
    profileKey?: string | null;
    actingUserId?: string | null;
    emailTarget?: string | null;
    code: string;
    metadata?: Record<string, unknown>;
  },
): Promise<Response> {
  await recordAbuseEvent(supabase, {
    eventType: "bypass_attempt",
    endpointName: options.endpointName,
    code: options.code,
    requestId: options.requestId,
    severity: "high",
    profileKey: options.profileKey ?? null,
    userId: options.actingUserId ?? null,
    ipAddress: getClientIpAddress(req),
    emailTarget: options.emailTarget ?? null,
    metadata: options.metadata,
  });

  return createSafeErrorResponse(req, {
    status: 403,
    code: "FORBIDDEN",
    error: "Forbidden",
    requestId: options.requestId,
  });
}
