import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSignedOAuthState, verifySignedOAuthState } from "../_shared/oauthState.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

type SyncMode = "send_only" | "full_sync";

type Action =
  | "getAuthUrl"
  | "exchangeCode"
  | "status"
  | "listCalendars"
  | "setPrimaryCalendar"
  | "setSyncMode"
  | "disconnect"
  | "refreshToken";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeAction(raw: string | undefined): Action | null {
  if (!raw) return null;
  const map: Record<string, Action> = {
    getAuthUrl: "getAuthUrl",
    get_auth_url: "getAuthUrl",
    exchangeCode: "exchangeCode",
    exchange_code: "exchangeCode",
    status: "status",
    listCalendars: "listCalendars",
    list_calendars: "listCalendars",
    setPrimaryCalendar: "setPrimaryCalendar",
    set_primary_calendar: "setPrimaryCalendar",
    setSyncMode: "setSyncMode",
    set_sync_mode: "setSyncMode",
    disconnect: "disconnect",
    refreshToken: "refreshToken",
    refresh_token: "refreshToken",
  };
  return map[raw] ?? null;
}

function normalizeSyncMode(mode: unknown): SyncMode {
  return mode === "full_sync" ? "full_sync" : "send_only";
}

function isSyncMode(mode: unknown): mode is SyncMode {
  return mode === "send_only" || mode === "full_sync";
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim() || null;
}

async function getAuthedUserId(supabaseAdmin: any, req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("Missing Authorization bearer token");
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user?.id) {
    throw new Error("Unauthorized");
  }

  return user.id;
}

async function tryGetAuthedUserId(
  supabaseAdmin: any,
  req: Request,
): Promise<string | null> {
  try {
    return await getAuthedUserId(supabaseAdmin, req);
  } catch {
    return null;
  }
}

async function refreshAccessTokenIfNeeded(
  supabase: any,
  connection: {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
  },
  googleClientId: string,
  googleClientSecret: string,
): Promise<string> {
  const existingAccessToken = connection.access_token;
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;

  const shouldRefresh =
    !existingAccessToken ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

  if (!shouldRefresh && existingAccessToken) {
    return existingAccessToken;
  }

  if (!connection.refresh_token) {
    throw new Error("No refresh token available. Please reconnect your Google account.");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Failed to refresh Google token: ${details}`);
  }

  const tokens = await tokenResponse.json();
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("user_calendar_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (updateError) {
    throw new Error(`Failed to persist refreshed token: ${updateError.message}`);
  }

  return tokens.access_token as string;
}

async function listGoogleCalendars(accessToken: string): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const resp = await fetch(GOOGLE_CALENDAR_LIST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Failed to list Google calendars: ${details}`);
  }

  const payload = await resp.json();
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id || "primary"),
    summary: String(item.summary || item.id || "Untitled calendar"),
    primary: Boolean(item.primary),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
    const internalFunctionSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    if (!googleClientId || !googleClientSecret) {
      return jsonResponse({ error: "Google Calendar integration not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);

    if (!action) {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "getAuthUrl") {
      const userId = await getAuthedUserId(supabase, req);
      const redirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      const requestedSyncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode);
      if (!redirectUri) {
        return jsonResponse({ error: "redirectUri is required" }, 400);
      }

      if (!internalFunctionSecret) {
        return jsonResponse({ error: "OAuth state signing is not configured" }, 500);
      }

      const state = await createSignedOAuthState({
        provider: "google",
        userId,
        syncMode: requestedSyncMode,
        secret: internalFunctionSecret,
      });

      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set("client_id", googleClientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      const url = authUrl.toString();
      return jsonResponse({ url, auth_url: url });
    }

    if (action === "exchangeCode") {
      const code = body?.code as string | undefined;
      const redirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      const state = body?.state as string | undefined;
      const requestedSyncModeFromBody = isSyncMode(body?.syncMode ?? body?.sync_mode)
        ? (body?.syncMode ?? body?.sync_mode)
        : null;

      if (!code || !redirectUri) {
        return jsonResponse({ error: "code and redirectUri are required" }, 400);
      }

      let userId = await tryGetAuthedUserId(supabase, req);
      let requestedSyncMode: SyncMode = normalizeSyncMode(requestedSyncModeFromBody);

      if (!userId) {
        if (!internalFunctionSecret) {
          return jsonResponse({ error: "OAuth state validation is not configured" }, 500);
        }

        try {
          const verified = await verifySignedOAuthState({
            state,
            provider: "google",
            secret: internalFunctionSecret,
          });
          userId = verified.userId;
          if (!requestedSyncModeFromBody) {
            requestedSyncMode = verified.syncMode;
          }
        } catch {
          return jsonResponse({ error: "Invalid or expired OAuth state" }, 401);
        }
      }

      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const details = await tokenResponse.text();
        return jsonResponse({ error: "Failed to exchange authorization code", details }, 400);
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token as string;
      const refreshToken = (tokens.refresh_token as string | undefined) ?? null;
      const tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();

      let calendarEmail: string | null = null;
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        calendarEmail = (userInfo?.email as string | undefined) ?? null;
      }

      const calendars = await listGoogleCalendars(accessToken);
      const primary = calendars.find((c) => c.primary) ?? calendars[0] ?? { id: "primary", summary: "Primary", primary: true };

      const { data: existing } = await supabase
        .from("user_calendar_connections")
        .select("id, refresh_token")
        .eq("user_id", userId)
        .eq("provider", "google")
        .maybeSingle();

      const { data: connection, error: upsertError } = await supabase
        .from("user_calendar_connections")
        .upsert(
          {
            user_id: userId,
            provider: "google",
            access_token: accessToken,
            refresh_token: refreshToken ?? existing?.refresh_token ?? null,
            token_expires_at: tokenExpiresAt,
            calendar_id: primary.id,
            calendar_email: calendarEmail,
            primary_calendar_id: primary.id,
            primary_calendar_name: primary.summary,
            sync_enabled: true,
            sync_mode: requestedSyncMode,
            platform: "web",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" },
        )
        .select("id, provider, calendar_email, primary_calendar_id, primary_calendar_name, sync_mode, sync_enabled, platform")
        .single();

      if (upsertError) {
        return jsonResponse({ error: "Failed to store calendar connection", details: upsertError.message }, 500);
      }

      return jsonResponse({
        success: true,
        connection,
        calendars,
        calendarEmail,
      });
    }

    const userId = await getAuthedUserId(supabase, req);

    const { data: connection, error: connectionError } = await supabase
      .from("user_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();

    if (action === "status") {
      if (connectionError) {
        return jsonResponse({ error: "Failed to fetch connection status" }, 500);
      }

      const isTokenExpired = connection?.token_expires_at
        ? new Date(connection.token_expires_at).getTime() <= Date.now()
        : false;

      return jsonResponse({
        connected: Boolean(connection),
        tokenExpired: isTokenExpired,
        calendarEmail: connection?.calendar_email ?? null,
        primaryCalendarId: connection?.primary_calendar_id ?? null,
        primaryCalendarName: connection?.primary_calendar_name ?? null,
        syncEnabled: connection?.sync_enabled ?? false,
        syncMode: connection?.sync_mode ?? "send_only",
        lastSyncedAt: connection?.last_synced_at ?? null,
        connectedAt: connection?.created_at ?? null,
      });
    }

    if (action === "disconnect") {
      const { error: deleteError } = await supabase
        .from("user_calendar_connections")
        .delete()
        .eq("user_id", userId)
        .eq("provider", "google");

      if (deleteError) {
        return jsonResponse({ error: "Failed to disconnect calendar", details: deleteError.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (!connection || connectionError) {
      return jsonResponse({ error: "No Google Calendar connection found" }, 404);
    }

    if (action === "setSyncMode") {
      const syncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode);
      const { error } = await supabase
        .from("user_calendar_connections")
        .update({ sync_mode: syncMode, updated_at: new Date().toISOString() })
        .eq("id", connection.id);

      if (error) {
        return jsonResponse({ error: "Failed to update sync mode", details: error.message }, 500);
      }

      return jsonResponse({ success: true, syncMode });
    }

    if (action === "refreshToken") {
      const accessToken = await refreshAccessTokenIfNeeded(supabase, connection, googleClientId, googleClientSecret);
      return jsonResponse({ success: true, accessToken });
    }

    const accessToken = await refreshAccessTokenIfNeeded(supabase, connection, googleClientId, googleClientSecret);

    if (action === "listCalendars") {
      const calendars = await listGoogleCalendars(accessToken);
      return jsonResponse({ calendars });
    }

    if (action === "setPrimaryCalendar") {
      const calendarId = (body?.calendarId || body?.calendar_id) as string | undefined;
      const calendarName = (body?.calendarName || body?.calendar_name) as string | undefined;

      if (!calendarId) {
        return jsonResponse({ error: "calendarId is required" }, 400);
      }

      let resolvedName = calendarName ?? null;
      if (!resolvedName) {
        const calendars = await listGoogleCalendars(accessToken);
        resolvedName = calendars.find((c) => c.id === calendarId)?.summary ?? calendarId;
      }

      const { error } = await supabase
        .from("user_calendar_connections")
        .update({
          primary_calendar_id: calendarId,
          primary_calendar_name: resolvedName,
          calendar_id: calendarId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      if (error) {
        return jsonResponse({ error: "Failed to set primary calendar", details: error.message }, 500);
      }

      return jsonResponse({ success: true, primaryCalendarId: calendarId, primaryCalendarName: resolvedName });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
