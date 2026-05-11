import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createSignedOAuthState, verifySignedOAuthState } from "../_shared/oauthState.ts";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_ME_URL = "https://graph.microsoft.com/v1.0/me";
const MICROSOFT_CALENDARS_URL = "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar";
const MICROSOFT_TASK_LISTS_URL = "https://graph.microsoft.com/v1.0/me/todo/lists?$select=id,displayName,wellknownListName";
const NATIVE_CALLBACK_SCHEME_URL = "cosmiq://calendar/oauth/callback";

const SCOPES = ["offline_access", "User.Read", "Calendars.ReadWrite", "Tasks.ReadWrite"].join(" ");

type SyncMode = "send_only" | "full_sync";
type OAuthSource = "web" | "native";

type Action =
  | "getAuthUrl"
  | "exchangeCode"
  | "status"
  | "listCalendars"
  | "listTaskLists"
  | "setPrimaryCalendar"
  | "setPrimaryTaskList"
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
    return "Failed to connect Outlook Calendar";
  }

  const details = error instanceof OAuthHttpError ? error.details ?? "" : "";
  const combined = `${error.message} ${details}`.toLowerCase();

  if (combined.includes("invalid or expired oauth state")) {
    return "Calendar connection expired. Please try again.";
  }

  if (
    combined.includes("redirect_uri") ||
    combined.includes("invalid_grant") ||
    combined.includes("aadsts50011")
  ) {
    return "Outlook rejected this callback URI. Please verify the calendar redirect settings for this build.";
  }

  if (combined.includes("integration not configured")) {
    return "Outlook Calendar is not configured on the server yet. Please contact support.";
  }

  return error.message || "Failed to connect Outlook Calendar";
}

function buildNativeCallbackRedirect(args: {
  status: "success" | "error";
  message?: string;
}): string {
  const params = new URLSearchParams({
    provider: "outlook",
    status: args.status,
  });

  if (args.message) {
    params.set("message", args.message);
  }

  return `${NATIVE_CALLBACK_SCHEME_URL}?${params.toString()}`;
}

function buildFunctionCallbackUrl(req: Request): string {
  const url = new URL(req.url);
  url.pathname = url.pathname.endsWith("/")
    ? `${url.pathname}callback`
    : `${url.pathname}/callback`;
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
    listTaskLists: "listTaskLists",
    list_task_lists: "listTaskLists",
    setPrimaryCalendar: "setPrimaryCalendar",
    set_primary_calendar: "setPrimaryCalendar",
    setPrimaryTaskList: "setPrimaryTaskList",
    set_primary_task_list: "setPrimaryTaskList",
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
  if (!token) throw new Error("Missing Authorization bearer token");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user?.id) throw new Error("Unauthorized");
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

async function listOutlookTaskLists(
  accessToken: string,
): Promise<Array<{ id: string; name: string; isDefaultTaskList: boolean }>> {
  const resp = await fetch(MICROSOFT_TASK_LISTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Failed to list Outlook task lists: ${details}`);
  }

  const payload = await resp.json();
  const items = Array.isArray(payload.value) ? payload.value : [];

  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id || ""),
    name: String(item.displayName || "Untitled list"),
    isDefaultTaskList: String(item.wellknownListName || "").toLowerCase() === "defaultlist",
  }));
}

async function exchangeOutlookConnection(args: {
  supabase: any;
  req?: Request;
  code: string | undefined;
  redirectUri: string | undefined;
  state: string | undefined;
  requestedSyncModeFromBody: SyncMode | null;
  sourceFromBody?: unknown;
  internalFunctionSecret: string | undefined;
  clientId: string;
  clientSecret: string;
}): Promise<{
  success: true;
  connection: unknown;
  calendars: Array<{ id: string; name: string; isDefaultCalendar: boolean }>;
  taskLists: Array<{ id: string; name: string; isDefaultTaskList: boolean }>;
  calendarEmail: string | null;
}> {
  const {
    supabase,
    req,
    code,
    redirectUri,
    state,
    requestedSyncModeFromBody,
    sourceFromBody,
    internalFunctionSecret,
    clientId,
    clientSecret,
  } = args;

  if (!code || !redirectUri) {
    throw new OAuthHttpError("code and redirectUri are required", 400);
  }

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
        provider: "outlook",
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
    } catch (error) {
      if (error instanceof OAuthHttpError) {
        throw error;
      }
      throw new OAuthHttpError("Invalid or expired OAuth state", 401);
    }
  } else if (!userId) {
    throw new OAuthHttpError("Invalid or expired OAuth state", 401);
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
    throw new OAuthHttpError("Failed to exchange authorization code", 400, details);
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
  let taskLists: Array<{ id: string; name: string; isDefaultTaskList: boolean }> = [];
  try {
    taskLists = await listOutlookTaskLists(accessToken);
  } catch {
    taskLists = [];
  }
  const primaryTaskList = taskLists.find((list) => list.isDefaultTaskList) ?? taskLists[0] ?? null;

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
        primary_task_list_id: primaryTaskList?.id ?? null,
        primary_task_list_name: primaryTaskList?.name ?? null,
        sync_enabled: true,
        sync_mode: requestedSyncMode,
        platform: requestedSource === "native" ? "ios" : "web",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    )
    .select(
      "id, provider, calendar_email, primary_calendar_id, primary_calendar_name, primary_task_list_id, primary_task_list_name, sync_mode, sync_enabled, platform",
    )
    .single();

  if (upsertError) {
    throw new OAuthHttpError("Failed to store calendar connection", 500, upsertError.message);
  }

  return {
    success: true,
    connection,
    calendars,
    taskLists,
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
    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");
    const internalFunctionSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Outlook Calendar integration not configured" }, 500);
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
        await exchangeOutlookConnection({
          supabase,
          code,
          redirectUri,
          state,
          requestedSyncModeFromBody: null,
          sourceFromBody: "native",
          internalFunctionSecret,
          clientId,
          clientSecret,
        });

        return redirectResponse(buildNativeCallbackRedirect({
          status: "success",
          message: "Outlook Calendar connected successfully.",
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

    if (!action) return jsonResponse({ error: "Invalid action" }, 400);

    if (action === "getAuthUrl") {
      const userId = await getAuthedUserId(supabase, req);
      const redirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      const requestedSyncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode);
      const requestedSource = normalizeOAuthSource(body?.source ?? body?.calendar_source);
      if (!redirectUri) {
        return jsonResponse({ error: "redirectUri is required" }, 400);
      }

      if (!internalFunctionSecret) {
        return jsonResponse({ error: "OAuth state signing is not configured" }, 500);
      }

      const state = await createSignedOAuthState({
        provider: "outlook",
        userId,
        syncMode: requestedSyncMode,
        source: requestedSource,
        secret: internalFunctionSecret,
      });

      const authUrl = new URL(MICROSOFT_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("response_mode", "query");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("state", state);

      const url = authUrl.toString();
      return jsonResponse({ url, auth_url: url, redirect_uri: redirectUri });
    }

    if (action === "exchangeCode") {
      const code = body?.code as string | undefined;
      const redirectUri = (body?.redirectUri || body?.redirect_uri) as string | undefined;
      const state = body?.state as string | undefined;
      const requestedSyncModeFromBody = isSyncMode(body?.syncMode ?? body?.sync_mode)
        ? (body?.syncMode ?? body?.sync_mode)
        : null;

      try {
        const result = await exchangeOutlookConnection({
          supabase,
          req,
          code,
          redirectUri,
          state,
          requestedSyncModeFromBody,
          sourceFromBody: body?.source ?? body?.calendar_source,
          internalFunctionSecret,
          clientId,
          clientSecret,
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
        primaryTaskListId: connection?.primary_task_list_id ?? null,
        primaryTaskListName: connection?.primary_task_list_name ?? null,
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

    if (action === "listTaskLists") {
      const taskLists = await listOutlookTaskLists(accessToken);
      return jsonResponse({ taskLists });
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

    if (action === "setPrimaryTaskList") {
      const taskListId = (body?.taskListId || body?.task_list_id) as string | undefined;
      const taskListName = (body?.taskListName || body?.task_list_name) as string | undefined;

      if (!taskListId) {
        return jsonResponse({ error: "taskListId is required" }, 400);
      }

      let resolvedName = taskListName ?? null;
      if (!resolvedName) {
        const taskLists = await listOutlookTaskLists(accessToken);
        resolvedName = taskLists.find((list) => list.id === taskListId)?.name ?? taskListId;
      }

      const { error } = await supabase
        .from("user_calendar_connections")
        .update({
          primary_task_list_id: taskListId,
          primary_task_list_name: resolvedName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      if (error) {
        return jsonResponse({ error: "Failed to set primary task list", details: error.message }, 500);
      }

      return jsonResponse({ success: true, primaryTaskListId: taskListId, primaryTaskListName: resolvedName });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
