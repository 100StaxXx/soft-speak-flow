import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_ME_URL = "https://graph.microsoft.com/v1.0/me";
const MICROSOFT_CALENDARS_URL = "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar";

const SCOPES = ["offline_access", "User.Read", "Calendars.ReadWrite"].join(" ");

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

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim() || null;
}

async function getAuthedUserId(supabaseAdmin: ReturnType<typeof createClient>, req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization bearer token");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user?.id) throw new Error("Unauthorized");
  return user.id;
}

async function refreshAccessTokenIfNeeded(
  supabase: ReturnType<typeof createClient>,
  connection: {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
  },
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const shouldRefresh =
    !connection.access_token ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

  if (!shouldRefresh && connection.access_token) return connection.access_token;

  if (!connection.refresh_token) {
    throw new Error("No refresh token available. Please reconnect your Outlook account.");
  }

  const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Failed to refresh Outlook token: ${details}`);
  }

  const tokens = await tokenResponse.json();
  const tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();

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

async function listOutlookCalendars(accessToken: string): Promise<Array<{ id: string; name: string; isDefaultCalendar: boolean }>> {
  const resp = await fetch(MICROSOFT_CALENDARS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Failed to list Outlook calendars: ${details}`);
  }

  const payload = await resp.json();
  const items = Array.isArray(payload.value) ? payload.value : [];

  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id || ""),
    name: String(item.name || "Untitled calendar"),
    isDefaultCalendar: Boolean(item.isDefaultCalendar),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Outlook Calendar integration not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);

    if (!action) return jsonResponse({ error: "Invalid action" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userId = await getAuthedUserId(supabase, req);

    if (action === "getAuthUrl") {
      const redirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      if (!redirectUri) {
        return jsonResponse({ error: "redirectUri is required" }, 400);
      }

      const state = btoa(JSON.stringify({ userId }));

      const authUrl = new URL(MICROSOFT_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("response_mode", "query");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("state", state);

      const url = authUrl.toString();
      return jsonResponse({ url, auth_url: url });
    }

    if (action === "exchangeCode") {
      const code = body?.code as string | undefined;
      const redirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      const requestedSyncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode);

      if (!code || !redirectUri) {
        return jsonResponse({ error: "code and redirectUri are required" }, 400);
      }

      const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          scope: SCOPES,
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

      const meResp = await fetch(MICROSOFT_ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let calendarEmail: string | null = null;
      if (meResp.ok) {
        const me = await meResp.json();
        calendarEmail = (me?.mail as string | undefined) || (me?.userPrincipalName as string | undefined) || null;
      }

      const calendars = await listOutlookCalendars(accessToken);
      const primary = calendars.find((c) => c.isDefaultCalendar) ?? calendars[0] ?? null;

      const { data: existing } = await supabase
        .from("user_calendar_connections")
        .select("id, refresh_token")
        .eq("user_id", userId)
        .eq("provider", "outlook")
        .maybeSingle();

      const { data: connection, error: upsertError } = await supabase
        .from("user_calendar_connections")
        .upsert(
          {
            user_id: userId,
            provider: "outlook",
            access_token: accessToken,
            refresh_token: refreshToken ?? existing?.refresh_token ?? null,
            token_expires_at: tokenExpiresAt,
            calendar_id: primary?.id ?? null,
            calendar_email: calendarEmail,
            primary_calendar_id: primary?.id ?? null,
            primary_calendar_name: primary?.name ?? null,
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

    const { data: connection, error: connectionError } = await supabase
      .from("user_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "outlook")
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
        .eq("provider", "outlook");

      if (deleteError) {
        return jsonResponse({ error: "Failed to disconnect calendar", details: deleteError.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (!connection || connectionError) {
      return jsonResponse({ error: "No Outlook Calendar connection found" }, 404);
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

    const accessToken = await refreshAccessTokenIfNeeded(supabase, connection, clientId, clientSecret);

    if (action === "refreshToken") {
      return jsonResponse({ success: true, accessToken });
    }

    if (action === "listCalendars") {
      const calendars = await listOutlookCalendars(accessToken);
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
        const calendars = await listOutlookCalendars(accessToken);
        resolvedName = calendars.find((c) => c.id === calendarId)?.name ?? calendarId;
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
