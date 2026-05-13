import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createSignedOAuthState, verifySignedOAuthState } from "../_shared/oauthState.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const NATIVE_CALLBACK_SCHEME_URL = "cosmiq://calendar/oauth/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

type SyncMode = "send_only" | "full_sync";
type OAuthSource = "web" | "native";

type Action =
  | "getAuthUrl"
  | "exchangeCode"
  | "status"
  | "listCalendars"
  | "setPrimaryCalendar"
  | "setSyncMode"
  | "disconnect"
  | "refreshToken";

class OAuthHttpError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status = 400, details?: string) {
    super(message);
    this.name = "OAuthHttpError";
    this.status = status;
    this.details = details;
  }
}

function toNativeCallbackErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to connect Google Calendar";
  }

  const details = error instanceof OAuthHttpError ? error.details ?? "" : "";
  const combined = `${error.message} ${details}`.toLowerCase();

  if (combined.includes("invalid or expired oauth state")) {
    return "Calendar connection expired. Please try again.";
  }

  if (combined.includes("redirect_uri") || combined.includes("redirect uri")) {
    return "Google rejected this callback URI. Please verify the calendar redirect settings for this build.";
  }

  if (
    combined.includes("authorization code is invalid") ||
    combined.includes("authorization code has expired") ||
    combined.includes("code has expired") ||
    combined.includes("code was already redeemed") ||
    combined.includes("code has already been redeemed")
  ) {
    return "Calendar connection expired or was already used. Please try connecting again.";
  }

  if (combined.includes("invalid_grant")) {
    return "The calendar provider rejected this authorization code. Please try connecting again.";
  }

  if (combined.includes("integration not configured")) {
    return "Google Calendar is not configured correctly on the server yet. Please contact support.";
  }

  return error.message || "Failed to connect Google Calendar";
}

function buildNativeCallbackRedirect(args: {
  status: "success" | "error";
  message?: string;
}): string {
  const params = new URLSearchParams({
    provider: "google",
    status: args.status,
  });

  if (args.message) {
    params.set("message", args.message);
  }

  return `${NATIVE_CALLBACK_SCHEME_URL}?${params.toString()}`;
}

function buildFunctionCallbackUrl(req: Request): string {
  const url = new URL(req.url);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  const callbackSuffix = "/callback";

  url.pathname = normalizedPath.endsWith(callbackSuffix)
    ? normalizedPath
    : `${normalizedPath}${callbackSuffix}`;
  url.search = "";
  url.hash = "";

  return url.toString();
}

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

function normalizeOAuthSource(source: unknown): OAuthSource {
  return source === "native" ? "native" : "web";
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

async function exchangeGoogleConnection(args: {
  supabase: any;
  req?: Request;
  code: string | undefined;
  redirectUri: string | undefined;
  state: string | undefined;
  requestedSyncModeFromBody: SyncMode | null;
  sourceFromBody?: unknown;
  internalFunctionSecret: string | undefined;
  googleClientId: string;
  googleClientSecret: string;
}): Promise<{
  success: true;
  connection: unknown;
  calendars: Array<{ id: string; summary: string; primary: boolean }>;
  calendarEmail: string | null;
}> {
  const {
    supabase,
    req,
    code,
    redirectUri: requestedRedirectUri,
    state,
    requestedSyncModeFromBody,
    sourceFromBody,
    internalFunctionSecret,
    googleClientId,
    googleClientSecret,
  } = args;

  if (!code) {
    throw new OAuthHttpError("code and redirectUri are required", 400);
  }

  let redirectUri = requestedRedirectUri?.trim();
  let userId = req ? await tryGetAuthedUserId(supabase, req) : null;
  let requestedSyncMode: SyncMode = normalizeSyncMode(requestedSyncModeFromBody);
  let requestedSource: OAuthSource = normalizeOAuthSource(sourceFromBody);

  if (state) {
    if (!internalFunctionSecret) {
      throw new OAuthHttpError("OAuth state validation is not configured", 500);
    }

    try {
      const verified = await verifySignedOAuthState({
        state,
        provider: "google",
        secret: internalFunctionSecret,
      });
      if (userId && verified.userId !== userId) {
        throw new OAuthHttpError("OAuth state does not match the authenticated user", 401);
      }
      userId = verified.userId;
      if (!requestedSyncModeFromBody) {
        requestedSyncMode = verified.syncMode;
      }
      requestedSource = verified.source;
      redirectUri = verified.redirectUri ?? redirectUri;
    } catch (error) {
      if (error instanceof OAuthHttpError) {
        throw error;
      }
      throw new OAuthHttpError("Invalid or expired OAuth state", 401);
    }
  } else if (!userId) {
    throw new OAuthHttpError("Invalid or expired OAuth state", 401);
  }

  if (!redirectUri) {
    throw new OAuthHttpError("code and redirectUri are required", 400);
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
    throw new OAuthHttpError("Failed to exchange authorization code", 400, details);
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
        platform: requestedSource === "native" ? "ios" : "web",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    )
    .select("id, provider, calendar_email, primary_calendar_id, primary_calendar_name, sync_mode, sync_enabled, platform")
    .single();

  if (upsertError) {
    throw new OAuthHttpError("Failed to store calendar connection", 500, upsertError.message);
  }

  return {
    success: true,
    connection,
    calendars,
    calendarEmail,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  const redirectResponse = (location: string) =>
    new Response(null, {
      status: 302,
      headers: { ...getCorsHeaders(req), Location: location },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
    const internalFunctionSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    if (!googleClientId || !googleClientSecret) {
      return jsonResponse({ error: "Google Calendar integration not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const requestUrl = new URL(req.url);

    if (req.method === "GET" && requestUrl.pathname.endsWith("/callback")) {
      const code = requestUrl.searchParams.get("code") ?? undefined;
      const state = requestUrl.searchParams.get("state") ?? undefined;
      const providerError = requestUrl.searchParams.get("error");
      const providerErrorDescription = requestUrl.searchParams.get("error_description");
      const redirectUri = buildFunctionCallbackUrl(req);

      if (providerError) {
        return redirectResponse(buildNativeCallbackRedirect({
          status: "error",
          message: providerErrorDescription || providerError,
        }));
      }

      try {
        await exchangeGoogleConnection({
          supabase,
          code,
          redirectUri,
          state,
          requestedSyncModeFromBody: null,
          sourceFromBody: "native",
          internalFunctionSecret,
          googleClientId,
          googleClientSecret,
        });

        return redirectResponse(buildNativeCallbackRedirect({
          status: "success",
          message: "Google Calendar connected successfully.",
        }));
      } catch (error) {
        return redirectResponse(buildNativeCallbackRedirect({
          status: "error",
          message: toNativeCallbackErrorMessage(error),
        }));
      }
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);

    if (!action) {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    if (action === "getAuthUrl") {
      const userId = await getAuthedUserId(supabase, req);
      const rawRedirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      const redirectUri = rawRedirectUri?.trim();
      const requestedSyncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode);
      const requestedSource = normalizeOAuthSource(body?.source ?? body?.calendar_source);
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
        source: requestedSource,
        redirectUri,
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

      try {
        const result = await exchangeGoogleConnection({
          supabase,
          req,
          code,
          redirectUri,
          state,
          requestedSyncModeFromBody,
          sourceFromBody: body?.source ?? body?.calendar_source,
          internalFunctionSecret,
          googleClientId,
          googleClientSecret,
        });
        return jsonResponse(result);
      } catch (error) {
        if (error instanceof OAuthHttpError) {
          return jsonResponse(
            {
              error: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
            error.status,
          );
        }
        throw error;
      }
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
