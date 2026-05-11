import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { sendAPNSNotification } from "../_shared/apns.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignupRequestBody {
  email?: unknown;
  website?: unknown;
  source?: unknown;
  referrer?: unknown;
}

interface SignupRow {
  id: string;
  email: string;
}

interface DeviceTokenRow {
  id: string;
  user_id: string;
  device_token: string;
  updated_at: string | null;
  installation_id: string | null;
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return EMAIL_REGEX.test(normalized) ? normalized : null;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function getClientIpAddress(req: Request): string {
  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;

  return "unknown";
}

function readConfiguredOwnerUserIds(): string[] {
  const raw = Deno.env.get("EARLY_ACCESS_NOTIFICATION_USER_IDS") ??
    Deno.env.get("OWNER_NOTIFICATION_USER_IDS") ??
    Deno.env.get("OWNER_NOTIFICATION_USER_ID") ??
    "";

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function resolveOwnerUserIds(supabase: any): Promise<string[]> {
  const configured = readConfiguredOwnerUserIds();
  if (configured.length > 0) {
    return [...new Set(configured)];
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (error) {
    console.error("[early-access-signup] admin role lookup failed", error);
    return [];
  }

  return [...new Set(((data as Array<{ user_id: string }> | null) ?? []).map((row) => row.user_id))];
}

function pickNewestByInstallation(rows: DeviceTokenRow[]): DeviceTokenRow[] {
  const byKey = new Map<string, DeviceTokenRow>();

  for (const row of rows) {
    const key = row.installation_id?.trim() || row.device_token;
    const current = byKey.get(key);
    const currentTime = current?.updated_at ? Date.parse(current.updated_at) : 0;
    const rowTime = row.updated_at ? Date.parse(row.updated_at) : 0;

    if (!current || rowTime >= currentTime) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()];
}

async function notifyOwners(
  supabase: any,
  signup: SignupRow,
): Promise<{ status: string; error: string | null; sentCount: number }> {
  const ownerUserIds = await resolveOwnerUserIds(supabase);
  if (ownerUserIds.length === 0) {
    return { status: "no_owner_configured", error: null, sentCount: 0 };
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from("push_device_tokens")
    .select("id, user_id, device_token, updated_at, installation_id")
    .in("user_id", ownerUserIds)
    .eq("platform", "ios")
    .order("updated_at", { ascending: false });

  if (tokenError) {
    return { status: "token_lookup_failed", error: tokenError.message, sentCount: 0 };
  }

  const tokens = pickNewestByInstallation((tokenRows as DeviceTokenRow[] | null) ?? []);
  if (tokens.length === 0) {
    return { status: "no_owner_device_token", error: null, sentCount: 0 };
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const token of tokens) {
    try {
      const result = await sendAPNSNotification(token.device_token, {
        title: "New Cosmiq early access signup",
        body: signup.email,
        data: {
          type: "early_access_signup",
          signup_id: signup.id,
          email: signup.email,
        },
      });

      if (result.success) {
        sentCount += 1;
      } else {
        errors.push(result.reason ?? `apns_status_${result.status}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (sentCount > 0) {
    return {
      status: errors.length > 0 ? "sent_with_errors" : "sent",
      error: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      sentCount,
    };
  }

  return {
    status: "send_failed",
    error: errors.slice(0, 3).join("; ") || "Unknown APNs failure",
    sentCount: 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(req, { error: "Signup service is not configured" }, 500);
  }

  let body: SignupRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse(req, { error: "Invalid request body" }, 400);
  }

  const honeypot = normalizeOptionalText(body.website, 200);
  if (honeypot) {
    return jsonResponse(req, { success: true, status: "received" });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonResponse(req, { error: "Enter a valid email address." }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const userAgent = req.headers.get("user-agent") ?? null;
  const { data: signup, error: signupError } = await supabase.rpc("record_early_access_signup", {
    p_email: email,
    p_source: normalizeOptionalText(body.source, 200),
    p_referrer: normalizeOptionalText(body.referrer, 500),
    p_user_agent: userAgent,
    p_request_metadata: {
      ip_address: getClientIpAddress(req),
      origin: req.headers.get("origin"),
      created_from: "landing_page",
    },
  });

  if (signupError || !signup) {
    console.error("[early-access-signup] failed to record signup", signupError);
    return jsonResponse(req, { error: "Could not save that email. Try again in a moment." }, 500);
  }

  const notification = await notifyOwners(supabase, signup as SignupRow);

  await supabase
    .from("early_access_signups")
    .update({
      owner_notification_status: notification.status,
      owner_notification_error: notification.error,
      owner_notified_at: notification.sentCount > 0 ? new Date().toISOString() : null,
    })
    .eq("id", (signup as SignupRow).id);

  return jsonResponse(req, {
    success: true,
    status: "saved",
    notificationStatus: notification.status,
  });
});
